import { Router } from 'express';
import { todos, ejecutar, saldoTarjeta, redondear } from '../db.js';
import { requireRol } from '../auth.js';
import * as v from '../validar.js';

const router = Router();

// Todas las tarjetas con su saldo en una sola consulta
router.get('/', async (req, res) => {
  const filas = await todos(`
    SELECT t.*,
      COALESCE((SELECT SUM(monto) FROM gastos WHERE tarjeta_id = t.id AND estado = 'confirmado'), 0) AS confirmados,
      COALESCE((SELECT SUM(monto) FROM gastos WHERE tarjeta_id = t.id AND estado = 'pendiente'), 0) AS pendientes
    FROM tarjetas t ORDER BY t.nombre
  `);
  res.json(filas.map((t) => ({
    ...t,
    confirmados: redondear(t.confirmados),
    pendientes: redondear(t.pendientes),
    disponible: redondear(t.limite - t.saldo_inicial - t.confirmados),
  })));
});

router.get('/:id', async (req, res) => {
  const tarjeta = await saldoTarjeta(v.id(req.params.id, 'id'));
  if (!tarjeta) return res.status(404).json({ error: 'Tarjeta no encontrada' });
  res.json(tarjeta);
});

router.post('/', requireRol('admin'), async (req, res) => {
  const nombre = v.texto(req.body.nombre, 'nombre');
  const limite = v.dinero(req.body.limite, 'límite');
  const saldoInicial = v.dinero(req.body.saldo_inicial ?? 0, 'saldo inicial');
  if (saldoInicial > limite) throw new v.ErrorValidacion('El saldo inicial no puede superar el límite');
  const { id } = await ejecutar('INSERT INTO tarjetas (nombre, limite, saldo_inicial) VALUES (?, ?, ?)', [nombre, limite, saldoInicial]);
  res.status(201).json(await saldoTarjeta(id));
});

router.patch('/:id', requireRol('admin'), async (req, res) => {
  const tarjetaId = v.id(req.params.id, 'id');
  const actual = await saldoTarjeta(tarjetaId);
  if (!actual) return res.status(404).json({ error: 'Tarjeta no encontrada' });

  const nombre = req.body.nombre !== undefined ? v.texto(req.body.nombre, 'nombre') : actual.nombre;
  const limite = req.body.limite !== undefined ? v.dinero(req.body.limite, 'límite') : actual.limite;
  const saldoInicial = req.body.saldo_inicial !== undefined ? v.dinero(req.body.saldo_inicial, 'saldo inicial') : actual.saldo_inicial;
  const estado = req.body.estado !== undefined ? v.opcion(req.body.estado, 'estado', ['activa', 'bloqueada']) : actual.estado;
  if (limite - saldoInicial < actual.confirmados) {
    throw new v.ErrorValidacion('Con ese límite los gastos confirmados quedarían por encima del crédito');
  }

  await ejecutar('UPDATE tarjetas SET nombre = ?, limite = ?, saldo_inicial = ?, estado = ? WHERE id = ?',
    [nombre, limite, saldoInicial, estado, tarjetaId]);
  res.json(await saldoTarjeta(tarjetaId));
});

export default router;
