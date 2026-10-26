import { Router } from 'express';
import { db, saldoTarjeta } from '../db.js';
import { requireRol } from '../auth.js';
import * as v from '../validar.js';

const router = Router();

router.get('/', (req, res) => {
  const ids = db.prepare('SELECT id FROM tarjetas ORDER BY nombre').all();
  res.json(ids.map(({ id }) => saldoTarjeta(id)));
});

router.get('/:id', (req, res) => {
  const tarjeta = saldoTarjeta(v.id(req.params.id, 'id'));
  if (!tarjeta) return res.status(404).json({ error: 'Tarjeta no encontrada' });
  res.json(tarjeta);
});

router.post('/', requireRol('admin'), (req, res) => {
  const nombre = v.texto(req.body.nombre, 'nombre');
  const limite = v.dinero(req.body.limite, 'límite');
  const saldoInicial = v.dinero(req.body.saldo_inicial ?? 0, 'saldo inicial');
  if (saldoInicial > limite) throw new v.ErrorValidacion('El saldo inicial no puede superar el límite');
  const { lastInsertRowid } = db.prepare('INSERT INTO tarjetas (nombre, limite, saldo_inicial) VALUES (?, ?, ?)')
    .run(nombre, limite, saldoInicial);
  res.status(201).json(saldoTarjeta(lastInsertRowid));
});

router.patch('/:id', requireRol('admin'), (req, res) => {
  const tarjetaId = v.id(req.params.id, 'id');
  const actual = saldoTarjeta(tarjetaId);
  if (!actual) return res.status(404).json({ error: 'Tarjeta no encontrada' });

  const nombre = req.body.nombre !== undefined ? v.texto(req.body.nombre, 'nombre') : actual.nombre;
  const limite = req.body.limite !== undefined ? v.dinero(req.body.limite, 'límite') : actual.limite;
  const saldoInicial = req.body.saldo_inicial !== undefined ? v.dinero(req.body.saldo_inicial, 'saldo inicial') : actual.saldo_inicial;
  const estado = req.body.estado !== undefined ? v.opcion(req.body.estado, 'estado', ['activa', 'bloqueada']) : actual.estado;
  if (limite - saldoInicial < actual.confirmados) {
    throw new v.ErrorValidacion('Con ese límite los gastos confirmados quedarían por encima del crédito');
  }

  db.prepare('UPDATE tarjetas SET nombre = ?, limite = ?, saldo_inicial = ?, estado = ? WHERE id = ?')
    .run(nombre, limite, saldoInicial, estado, tarjetaId);
  res.json(saldoTarjeta(tarjetaId));
});

export default router;
