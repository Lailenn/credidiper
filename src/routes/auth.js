import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { uno, ejecutar } from '../db.js';
import { requireAuth, crearSesion, cerrarSesion, tokenDe } from '../auth.js';
import * as v from '../validar.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { correo, password, recordar } = req.body ?? {};
  const usuario = typeof correo === 'string'
    ? await uno('SELECT id, password_hash, activo FROM usuarios WHERE correo = ?', [correo.trim()])
    : null;
  if (!usuario || typeof password !== 'string' || !bcrypt.compareSync(password, usuario.password_hash)) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }
  if (!usuario.activo) return res.status(403).json({ error: 'Tu usuario está desactivado' });
  // "Recordarme": la sesión dura 30 días; si no, un día
  res.json({ token: await crearSesion(usuario.id, Boolean(recordar)) });
});

router.post('/logout', async (req, res) => {
  await cerrarSesion(tokenDe(req));
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => res.json(req.usuario));

router.patch('/password', requireAuth, async (req, res) => {
  const actual = v.texto(req.body.actual, 'contraseña actual');
  const nueva = v.texto(req.body.nueva, 'contraseña nueva');
  if (nueva.length < 8 || !/\p{L}/u.test(nueva) || !/\d/.test(nueva)) {
    throw new v.ErrorValidacion('La contraseña nueva debe tener al menos 8 caracteres e incluir letras y números');
  }
  const { password_hash } = await uno('SELECT password_hash FROM usuarios WHERE id = ?', [req.usuario.id]);
  if (!bcrypt.compareSync(actual, password_hash)) return res.status(400).json({ error: 'La contraseña actual no es correcta' });
  await ejecutar('UPDATE usuarios SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(nueva, 10), req.usuario.id]);
  res.json({ ok: true });
});

export default router;
