import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { requireRol } from '../auth.js';
import * as v from '../validar.js';

const router = Router();
router.use(requireRol('admin'));

router.get('/', (req, res) => {
  res.json(db.prepare(`
    SELECT u.id, u.nombre, u.correo, r.nombre AS rol, u.activo
    FROM usuarios u JOIN roles r ON r.id = u.rol_id
    ORDER BY u.nombre
  `).all());
});

router.post('/', (req, res) => {
  const nombre = v.texto(req.body.nombre, 'nombre');
  const correo = v.texto(req.body.correo, 'correo');
  const password = v.texto(req.body.password, 'contraseña');
  const rol = v.opcion(req.body.rol, 'rol', ['admin', 'usuario']);
  if (password.length < 6) throw new v.ErrorValidacion('La contraseña debe tener al menos 6 caracteres');
  if (db.prepare('SELECT 1 FROM usuarios WHERE correo = ?').get(correo)) {
    return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
  }
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO usuarios (nombre, correo, password_hash, rol_id)
    VALUES (?, ?, ?, (SELECT id FROM roles WHERE nombre = ?))
  `).run(nombre, correo, bcrypt.hashSync(password, 10), rol);
  res.status(201).json({ id: Number(lastInsertRowid) });
});

router.patch('/:id', (req, res) => {
  const usuarioId = v.id(req.params.id, 'id');
  if (usuarioId === req.usuario.id) {
    return res.status(400).json({ error: 'Para tu propio usuario usa "Mi cuenta"' });
  }
  const cambios = [];
  const valores = [];
  if (req.body.activo !== undefined) {
    cambios.push('activo = ?');
    valores.push(req.body.activo ? 1 : 0);
  }
  if (req.body.password !== undefined) {
    const password = v.texto(req.body.password, 'contraseña');
    if (password.length < 6) throw new v.ErrorValidacion('La contraseña debe tener al menos 6 caracteres');
    cambios.push('password_hash = ?');
    valores.push(bcrypt.hashSync(password, 10));
  }
  if (req.body.rol !== undefined) {
    cambios.push('rol_id = (SELECT id FROM roles WHERE nombre = ?)');
    valores.push(v.opcion(req.body.rol, 'rol', ['admin', 'usuario']));
  }
  if (!cambios.length) return res.status(400).json({ error: 'No hay cambios' });
  const { changes } = db.prepare(`UPDATE usuarios SET ${cambios.join(', ')} WHERE id = ?`).run(...valores, usuarioId);
  if (!changes) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ ok: true });
});

export default router;
