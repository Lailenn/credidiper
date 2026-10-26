import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { db, saldoTarjeta } from '../db.js';
import { esAdmin } from '../auth.js';
import { CARPETA_FACTURAS, NOMBRE_ARCHIVO } from './facturas.js';
import * as v from '../validar.js';

const router = Router();

const SELECT_GASTOS = `
  SELECT g.*, u.nombre AS usuario, t.nombre AS tarjeta, p.nombre AS persona,
         f.id IS NOT NULL AS tiene_factura, f.fecha_subida, f.texto_ocr
  FROM gastos g
  JOIN usuarios u ON u.id = g.usuario_id
  JOIN tarjetas t ON t.id = g.tarjeta_id
  LEFT JOIN personas p ON p.id = g.persona_id
  LEFT JOIN facturas f ON f.gasto_id = g.id
`;

const MES = /^\d{4}-\d{2}$/;

// El administrador ve todos los gastos; cada usuario solo los que registró
router.get('/', (req, res) => {
  const filtros = [];
  const valores = [];
  if (!esAdmin(req)) {
    filtros.push('g.usuario_id = ?');
    valores.push(req.usuario.id);
  }
  if (req.query.tarjeta_id) {
    filtros.push('g.tarjeta_id = ?');
    valores.push(v.id(req.query.tarjeta_id, 'tarjeta'));
  }
  if (req.query.persona_id) {
    filtros.push('g.persona_id = ?');
    valores.push(v.id(req.query.persona_id, 'persona'));
  }
  if (req.query.estado) {
    filtros.push('g.estado = ?');
    valores.push(v.opcion(req.query.estado, 'estado', ['pendiente', 'confirmado', 'anulado']));
  }
  if (req.query.mes) {
    if (!MES.test(req.query.mes)) throw new v.ErrorValidacion('El mes debe tener formato AAAA-MM');
    filtros.push('substr(g.fecha_compra, 1, 7) = ?');
    valores.push(req.query.mes);
  }
  if (req.query.q) {
    filtros.push("(g.comercio LIKE ? ESCAPE '\\' OR p.nombre LIKE ? ESCAPE '\\')");
    const patron = `%${String(req.query.q).replace(/[\\%_]/g, '\\$&')}%`;
    valores.push(patron, patron);
  }
  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  res.json(db.prepare(`${SELECT_GASTOS} ${where} ORDER BY g.fecha_compra DESC, g.id DESC`).all(...valores)
    .map(({ texto_ocr, ...g }) => g));
});

router.get('/:id', (req, res) => {
  const gasto = db.prepare(`${SELECT_GASTOS} WHERE g.id = ?`).get(v.id(req.params.id, 'id'));
  if (!gasto || (!esAdmin(req) && gasto.usuario_id !== req.usuario.id)) {
    return res.status(404).json({ error: 'Gasto no encontrado' });
  }
  res.json(gasto);
});

// Al guardar, el gasto queda confirmado y se descuenta del disponible (el usuario ya revisó los datos)
router.post('/', (req, res) => {
  const tarjetaId = v.id(req.body.tarjeta_id, 'tarjeta');
  const personaId = v.id(req.body.persona_id, 'persona');
  const comercio = v.texto(req.body.comercio, 'comercio');
  const fechaCompra = v.fecha(req.body.fecha_compra, 'fecha de compra');
  const monto = v.dinero(req.body.monto, 'monto', { minExclusivo: true });
  const nota = typeof req.body.nota === 'string' && req.body.nota.trim() ? v.texto(req.body.nota, 'nota', { max: 500 }) : null;

  const archivo = req.body.archivo || null;
  if (archivo) {
    if (!NOMBRE_ARCHIVO.test(archivo) || !fs.existsSync(path.join(CARPETA_FACTURAS, archivo))) {
      throw new v.ErrorValidacion('La imagen de la factura no es válida, vuelve a subirla');
    }
    if (db.prepare('SELECT 1 FROM facturas WHERE ruta_archivo = ?').get(archivo)) {
      throw new v.ErrorValidacion('Esa factura ya está asociada a otro gasto');
    }
  }

  const tarjeta = saldoTarjeta(tarjetaId);
  if (!tarjeta) return res.status(404).json({ error: 'Tarjeta no encontrada' });
  if (tarjeta.estado !== 'activa') return res.status(422).json({ error: 'La tarjeta está bloqueada' });
  if (!db.prepare('SELECT 1 FROM personas WHERE id = ? AND activo = 1').get(personaId)) {
    return res.status(422).json({ error: 'Selecciona una persona válida' });
  }
  if (monto > tarjeta.disponible) {
    return res.status(422).json({ error: `El monto supera el disponible de la tarjeta ($${tarjeta.disponible.toFixed(2)})` });
  }

  // Evita registrar dos veces la misma compra
  const duplicado = db.prepare(`
    SELECT id FROM gastos
    WHERE tarjeta_id = ? AND comercio = ? COLLATE NOCASE AND fecha_compra = ? AND monto = ? AND estado != 'anulado'
  `).get(tarjetaId, comercio, fechaCompra, monto);
  if (duplicado && !req.body.forzar) {
    return res.status(409).json({ error: 'Ya existe un gasto igual (mismo comercio, fecha y monto)', duplicado_id: duplicado.id });
  }

  db.exec('BEGIN');
  try {
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO gastos (usuario_id, tarjeta_id, persona_id, comercio, fecha_compra, monto, estado, nota, creado_en)
      VALUES (?, ?, ?, ?, ?, ?, 'confirmado', ?, datetime('now', 'localtime'))
    `).run(req.usuario.id, tarjetaId, personaId, comercio, fechaCompra, monto, nota);
    if (archivo) {
      const textoOcr = typeof req.body.texto_ocr === 'string' ? req.body.texto_ocr.slice(0, 10000) : null;
      db.prepare(`
        INSERT INTO facturas (gasto_id, ruta_archivo, texto_ocr, fecha_subida) VALUES (?, ?, ?, datetime('now', 'localtime'))
      `).run(lastInsertRowid, archivo, textoOcr);
    }
    db.exec('COMMIT');
    res.status(201).json({ gasto: db.prepare(`${SELECT_GASTOS} WHERE g.id = ?`).get(lastInsertRowid), tarjeta: saldoTarjeta(tarjetaId) });
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
});

// Transiciones permitidas: pendiente -> confirmado | anulado, confirmado -> anulado
router.patch('/:id/estado', (req, res) => {
  const gastoId = v.id(req.params.id, 'id');
  const nuevo = v.opcion(req.body.estado, 'estado', ['confirmado', 'anulado']);
  const gasto = db.prepare('SELECT * FROM gastos WHERE id = ?').get(gastoId);
  if (!gasto || (!esAdmin(req) && gasto.usuario_id !== req.usuario.id)) {
    return res.status(404).json({ error: 'Gasto no encontrado' });
  }
  if (gasto.estado === nuevo || gasto.estado === 'anulado') {
    return res.status(409).json({ error: `El gasto ya está ${gasto.estado}` });
  }
  if (nuevo === 'confirmado') {
    const tarjeta = saldoTarjeta(gasto.tarjeta_id);
    if (gasto.monto > tarjeta.disponible) {
      return res.status(422).json({ error: `El monto supera el disponible de la tarjeta ($${tarjeta.disponible.toFixed(2)})` });
    }
  }
  // La condición sobre el estado anterior impide confirmar dos veces el mismo gasto
  db.prepare('UPDATE gastos SET estado = ? WHERE id = ? AND estado = ?').run(nuevo, gastoId, gasto.estado);
  res.json({ gasto: db.prepare(`${SELECT_GASTOS} WHERE g.id = ?`).get(gastoId), tarjeta: saldoTarjeta(gasto.tarjeta_id) });
});

export default router;
