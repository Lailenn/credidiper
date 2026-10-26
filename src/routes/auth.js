import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import * as v from '../validar.js';

const router = Router();
const TREINTA_DIAS = 30 * 24 * 60 * 60 * 1000;

router.post('/login', (req, res) => {
  const { correo, password, recordar } = req.body ?? {};
  const usuario = typeof correo === 'string'
    ? db.prepare('SELECT id, password_hash, activo FROM usuarios WHERE correo = ?').get(correo.trim())
    : null;
  if (!usuario || typeof password !== 'string' || !bcrypt.compareSync(password, usuario.password_hash)) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }
  if (!usuario.activo) return res.status(403).json({ error: 'Tu usuario está desactivado' });

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'No se pudo iniciar sesión' });
    req.session.usuarioId = usuario.id;
    // "Recordarme": la sesión dura 30 días; si no, se cierra al cerrar el navegador
    req.session.cookie.maxAge = recordar ? TREINTA_DIAS : null;
    res.json({ ok: true });
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', requireAuth, (req, res) => res.json(req.usuario));

router.patch('/password', requireAuth, (req, res) => {
  const actual = v.texto(req.body.actual, 'contraseña actual');
  const nueva = v.texto(req.body.nueva, 'contraseña nueva');
  if (nueva.length < 6) throw new v.ErrorValidacion('La contraseña nueva debe tener al menos 6 caracteres');
  const { password_hash } = db.prepare('SELECT password_hash FROM usuarios WHERE id = ?').get(req.usuario.id);
  if (!bcrypt.compareSync(actual, password_hash)) return res.status(400).json({ error: 'La contraseña actual no es correcta' });
  db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(nueva, 10), req.usuario.id);
  res.json({ ok: true });
});

export default router;
