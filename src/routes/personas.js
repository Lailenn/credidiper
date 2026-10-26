import { Router } from 'express';
import { todos, uno, ejecutar } from '../db.js';
import { requireRol } from '../auth.js';
import * as v from '../validar.js';

const router = Router();

router.get('/', async (req, res) => {
  res.json(await todos('SELECT * FROM personas ORDER BY activo DESC, nombre'));
});

router.post('/', requireRol('admin'), async (req, res) => {
  const nombre = v.texto(req.body.nombre, 'nombre', { max: 60 });
  if (await uno('SELECT 1 FROM personas WHERE nombre = ?', [nombre])) {
    return res.status(409).json({ error: 'Ya existe una persona con ese nombre' });
  }
  const { id } = await ejecutar('INSERT INTO personas (nombre) VALUES (?)', [nombre]);
  res.status(201).json(await uno('SELECT * FROM personas WHERE id = ?', [id]));
});

router.patch('/:id', requireRol('admin'), async (req, res) => {
  const personaId = v.id(req.params.id, 'id');
  const actual = await uno('SELECT * FROM personas WHERE id = ?', [personaId]);
  if (!actual) return res.status(404).json({ error: 'Persona no encontrada' });
  const nombre = req.body.nombre !== undefined ? v.texto(req.body.nombre, 'nombre', { max: 60 }) : actual.nombre;
  const activo = req.body.activo !== undefined ? (req.body.activo ? 1 : 0) : actual.activo;
  if (await uno('SELECT 1 FROM personas WHERE nombre = ? AND id != ?', [nombre, personaId])) {
    return res.status(409).json({ error: 'Ya existe una persona con ese nombre' });
  }
  await ejecutar('UPDATE personas SET nombre = ?, activo = ? WHERE id = ?', [nombre, activo, personaId]);
  res.json(await uno('SELECT * FROM personas WHERE id = ?', [personaId]));
});

export default router;
