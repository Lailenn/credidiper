import { Router } from 'express';
import { todos, uno, ejecutar, redondear, ahoraLocal } from '../db.js';
import { requireRol } from '../auth.js';
import * as v from '../validar.js';

const router = Router();

// Cada persona con su cuenta: lo que gastó con la tarjeta (gastos confirmados), lo que ha depositado y lo que debe
const SELECT_PERSONAS = `
  SELECT p.*,
    COALESCE((SELECT SUM(monto) FROM gastos WHERE persona_id = p.id AND estado = 'confirmado'), 0) AS gastado,
    COALESCE((SELECT SUM(monto) FROM pagos WHERE persona_id = p.id), 0) AS pagado,
    (SELECT MAX(fecha) FROM pagos WHERE persona_id = p.id) AS ultimo_pago
  FROM personas p
`;
const conSaldo = (p) => ({
  ...p,
  gastado: redondear(p.gastado),
  pagado: redondear(p.pagado),
  saldo: redondear(p.gastado - p.pagado),
});
const buscarPersona = async (id) => {
  const p = await uno(`${SELECT_PERSONAS} WHERE p.id = ?`, [id]);
  return p && conSaldo(p);
};

router.get('/', async (req, res) => {
  res.json((await todos(`${SELECT_PERSONAS} ORDER BY p.activo DESC, p.nombre`)).map(conSaldo));
});

router.get('/:id', async (req, res) => {
  const persona = await buscarPersona(v.id(req.params.id, 'id'));
  if (!persona) return res.status(404).json({ error: 'Persona no encontrada' });
  res.json(persona);
});

// Movimientos de una persona: sus compras (aumentan lo que debe) y sus depósitos (lo reducen), del más reciente al más antiguo
router.get('/:id/movimientos', async (req, res) => {
  const personaId = v.id(req.params.id, 'id');
  if (!(await uno('SELECT 1 FROM personas WHERE id = ?', [personaId]))) {
    return res.status(404).json({ error: 'Persona no encontrada' });
  }
  const movimientos = await todos(`
    SELECT 'gasto' AS tipo, id, fecha_compra AS fecha, comercio AS descripcion, monto, nota, creado_en
    FROM gastos WHERE persona_id = ? AND estado = 'confirmado'
    UNION ALL
    SELECT 'pago' AS tipo, id, fecha, COALESCE('Depósito · ref. ' || referencia, 'Depósito') AS descripcion, monto, nota, creado_en
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

// Registrar un depósito de la persona
router.post('/:id/pagos', requireRol('admin'), async (req, res) => {
  const personaId = v.id(req.params.id, 'id');
  if (!(await uno('SELECT 1 FROM personas WHERE id = ?', [personaId]))) {
    return res.status(404).json({ error: 'Persona no encontrada' });
  }
  const monto = v.dinero(req.body.monto, 'monto', { minExclusivo: true });
  const fecha = v.fecha(req.body.fecha, 'fecha');
  const opcional = (valor, campo, max) => (typeof valor === 'string' && valor.trim() ? v.texto(valor, campo, { max }) : null);
  const referencia = opcional(req.body.referencia, 'referencia', 60);
  const nota = opcional(req.body.nota, 'nota', 300);
  const { id } = await ejecutar(
    'INSERT INTO pagos (persona_id, monto, fecha, referencia, nota, creado_en) VALUES (?, ?, ?, ?, ?, ?)',
    [personaId, monto, fecha, referencia, nota, ahoraLocal()],
  );
  res.status(201).json({ id, persona: await buscarPersona(personaId) });
});

// Borrar un depósito registrado por error
router.delete('/:id/pagos/:pagoId', requireRol('admin'), async (req, res) => {
  const personaId = v.id(req.params.id, 'id');
  const { cambios } = await ejecutar('DELETE FROM pagos WHERE id = ? AND persona_id = ?', [v.id(req.params.pagoId, 'depósito'), personaId]);
  if (!cambios) return res.status(404).json({ error: 'Depósito no encontrado' });
  res.json({ persona: await buscarPersona(personaId) });
});

export default router;
