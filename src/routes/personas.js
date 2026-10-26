import { Router } from 'express';
import { db } from '../db.js';
import { requireRol } from '../auth.js';
import * as v from '../validar.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM personas ORDER BY activo DESC, nombre').all());
});

router.post('/', requireRol('admin'), (req, res) => {
  const nombre = v.texto(req.body.nombre, 'nombre', { max: 60 });
  if (db.prepare('SELECT 1 FROM personas WHERE nombre = ?').get(nombre)) {
    return res.status(409).json({ error: 'Ya existe una persona con ese nombre' });
  }
  const { lastInsertRowid } = db.prepare('INSERT INTO personas (nombre) VALUES (?)').run(nombre);
  res.status(201).json(db.prepare('SELECT * FROM personas WHERE id = ?').get(lastInsertRowid));
});

router.patch('/:id', requireRol('admin'), (req, res) => {
  const personaId = v.id(req.params.id, 'id');
  const actual = db.prepare('SELECT * FROM personas WHERE id = ?').get(personaId);
  if (!actual) return res.status(404).json({ error: 'Persona no encontrada' });
  const nombre = req.body.nombre !== undefined ? v.texto(req.body.nombre, 'nombre', { max: 60 }) : actual.nombre;
  const activo = req.body.activo !== undefined ? (req.body.activo ? 1 : 0) : actual.activo;
  if (db.prepare('SELECT 1 FROM personas WHERE nombre = ? AND id != ?').get(nombre, personaId)) {
    return res.status(409).json({ error: 'Ya existe una persona con ese nombre' });
  }
  db.prepare('UPDATE personas SET nombre = ?, activo = ? WHERE id = ?').run(nombre, activo, personaId);
  res.json(db.prepare('SELECT * FROM personas WHERE id = ?').get(personaId));
});

export default router;
