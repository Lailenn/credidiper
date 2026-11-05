import { Router } from 'express';
import { todos, uno, ejecutar, SQL_PERSONAS, conSaldo, cuentaPersona } from '../db.js';
import { requireRol } from '../auth.js';
import { crearDeposito, anularDeposito } from './depositos.js';
import * as v from '../validar.js';

const router = Router();

// La cuenta de cada persona (gastado, depositado y saldo) se calcula en db.js, la misma para todas las pantallas
const buscarPersona = cuentaPersona;

router.get('/', async (req, res) => {
  res.json((await todos(`${SQL_PERSONAS} ORDER BY p.activo DESC, p.nombre`)).map(conSaldo));
});

router.get('/:id', async (req, res) => {
  const persona = await buscarPersona(v.id(req.params.id, 'id'));
  if (!persona) return res.status(404).json({ error: 'Persona no encontrada' });
  res.json(persona);
});

// Movimientos de una persona: sus compras (aumentan lo que debe) y sus depósitos (lo reducen), del más reciente al más antiguo.
// Los depósitos anulados se incluyen marcados: no cuentan en el saldo, pero quedan en el historial.
router.get('/:id/movimientos', async (req, res) => {
  const personaId = v.id(req.params.id, 'id');
  if (!(await uno('SELECT 1 FROM personas WHERE id = ?', [personaId]))) {
    return res.status(404).json({ error: 'Persona no encontrada' });
  }
  const movimientos = await todos(`
    SELECT 'gasto' AS tipo, id, fecha_compra AS fecha, comercio AS descripcion, monto, nota, creado_en,
           NULL AS metodo, NULL AS referencia, 0 AS tiene_comprobante, 0 AS anulado
    FROM gastos WHERE persona_id = ? AND estado = 'confirmado'
    UNION ALL
    SELECT 'pago' AS tipo, id, fecha, 'Depósito' AS descripcion, monto, nota, creado_en,
           metodo, referencia, comprobante IS NOT NULL AS tiene_comprobante, anulado
    FROM pagos WHERE persona_id = ?
    ORDER BY fecha DESC, creado_en DESC
  `, [personaId, personaId]);
  res.json(movimientos);
});

router.post('/', requireRol('admin'), async (req, res) => {
  const nombre = v.texto(req.body.nombre, 'nombre', { max: 60 });
  if (await uno('SELECT 1 FROM personas WHERE nombre = ?', [nombre])) {
    return res.status(409).json({ error: 'Ya existe una persona con ese nombre' });
  }
  const { id } = await ejecutar('INSERT INTO personas (nombre) VALUES (?)', [nombre]);
  res.status(201).json(await buscarPersona(id));
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
  res.json(await buscarPersona(personaId));
});

// Rutas anteriores de depósitos: la pantalla ahora usa /api/depositos. Se conservan para que la
// versión publicada siga funcionando mientras se actualiza. Borrar ya no elimina: anula el depósito.
router.post('/:id/pagos', requireRol('admin'), async (req, res) => {
  const { deposito, persona } = await crearDeposito(v.id(req.params.id, 'id'), req.body);
  res.status(201).json({ id: deposito.id, deposito, persona });
});

router.delete('/:id/pagos/:pagoId', requireRol('admin'), async (req, res) => {
  const { persona } = await anularDeposito(v.id(req.params.pagoId, 'depósito'), v.id(req.params.id, 'id'));
  res.json({ persona });
});

export default router;
