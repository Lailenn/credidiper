import { Router } from 'express';
import { todos, ejecutar, saldoTarjeta, redondear } from '../db.js';
import { requireRol } from '../auth.js';
import * as v from '../validar.js';

const router = Router();

// Solo se guardan los últimos 4 dígitos (para reconocer la tarjeta), nunca el número completo
const ultimos4 = (valor) => {
  const digitos = String(valor ?? '').trim();
  if (!digitos) return null;
  if (!/^\d{4}$/.test(digitos)) throw new v.ErrorValidacion('Escribe solo los últimos 4 dígitos de la tarjeta');
  return digitos;
};
const titular = (valor) => String(valor ?? '').trim().replace(/\s+/g, ' ').slice(0, 40) || null;
const vencimiento = (valor) => {
  const texto = String(valor ?? '').trim();
  if (!texto) return null;
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(texto)) throw new v.ErrorValidacion('Escribe el vencimiento como MM/AA, por ejemplo 04/29');
  return texto;
};

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
  const { id } = await ejecutar(
    'INSERT INTO tarjetas (nombre, limite, saldo_inicial, ultimos4, titular, vencimiento) VALUES (?, ?, ?, ?, ?, ?)',
    [nombre, limite, saldoInicial, ultimos4(req.body.ultimos4), titular(req.body.titular), vencimiento(req.body.vencimiento)],
  );
  res.status(201).json(await saldoTarjeta(id));
});

router.patch('/:id', requireRol('admin'), async (req, res) => {
  const tarjetaId = v.id(req.params.id, 'id');
  const actual = await saldoTarjeta(tarjetaId);
  if (!actual) return res.status(404).json({ error: 'Tarjeta no encontrada' });

  const nombre = req.body.nombre !== undefined ? v.texto(req.body.nombre, 'nombre') : actual.nombre;
  const limite = req.body.limite !== undefined ? v.dinero(req.body.limite, 'límite') : actual.limite;
  const saldoInicial = req.body.saldo_inicial !== undefined ? v.dinero(req.body.saldo_inicial, 'saldo inicial') : actual.saldo_inicial;
  const digitos = req.body.ultimos4 !== undefined ? ultimos4(req.body.ultimos4) : actual.ultimos4;
  const nombreTitular = req.body.titular !== undefined ? titular(req.body.titular) : actual.titular;
  const vence = req.body.vencimiento !== undefined ? vencimiento(req.body.vencimiento) : actual.vencimiento;
  const estado = req.body.estado !== undefined ? v.opcion(req.body.estado, 'estado', ['activa', 'bloqueada']) : actual.estado;
  if (limite - saldoInicial < actual.confirmados) {
    throw new v.ErrorValidacion('Con ese límite los gastos confirmados quedarían por encima del crédito');
  }

  await ejecutar(
    'UPDATE tarjetas SET nombre = ?, limite = ?, saldo_inicial = ?, estado = ?, ultimos4 = ?, titular = ?, vencimiento = ? WHERE id = ?',
    [nombre, limite, saldoInicial, estado, digitos, nombreTitular, vence, tarjetaId],
  );
  res.json(await saldoTarjeta(tarjetaId));
});

export default router;
