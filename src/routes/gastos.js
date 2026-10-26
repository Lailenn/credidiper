import { Router } from 'express';
import { todos, uno, ejecutar, lote, saldoTarjeta, ahoraLocal, SQL_DISPONIBLE } from '../db.js';
import { esAdmin } from '../auth.js';
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
const buscarGasto = (id) => uno(`${SELECT_GASTOS} WHERE g.id = ?`, [id]);
const errorDisponible = (disponible) => `El monto supera el disponible de la tarjeta ($${disponible.toFixed(2)})`;

// El administrador ve todos los gastos; cada usuario solo los que registró
router.get('/', async (req, res) => {
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
  const gastos = await todos(`${SELECT_GASTOS} ${where} ORDER BY g.fecha_compra DESC, g.id DESC`, valores);
  res.json(gastos.map(({ texto_ocr, ...g }) => g));
});

router.get('/:id', async (req, res) => {
  const gasto = await buscarGasto(v.id(req.params.id, 'id'));
  if (!gasto || (!esAdmin(req) && gasto.usuario_id !== req.usuario.id)) {
    return res.status(404).json({ error: 'Gasto no encontrado' });
  }
  res.json(gasto);
});

// Al guardar, el gasto queda confirmado y se descuenta del disponible (el usuario ya revisó los datos)
router.post('/', async (req, res) => {
  const tarjetaId = v.id(req.body.tarjeta_id, 'tarjeta');
  const personaId = v.id(req.body.persona_id, 'persona');
  const comercio = v.texto(req.body.comercio, 'comercio');
  const fechaCompra = v.fecha(req.body.fecha_compra, 'fecha de compra');
  const monto = v.dinero(req.body.monto, 'monto', { minExclusivo: true });
  const nota = typeof req.body.nota === 'string' && req.body.nota.trim() ? v.texto(req.body.nota, 'nota', { max: 500 }) : null;

  const archivo = typeof req.body.archivo === 'string' && req.body.archivo ? req.body.archivo : null;
  if (archivo && !(await uno('SELECT 1 FROM subidas WHERE id = ?', [archivo]))) {
    throw new v.ErrorValidacion('La imagen de la factura ya no está disponible, vuelve a subirla');
  }

  const tarjeta = await saldoTarjeta(tarjetaId);
  if (!tarjeta) return res.status(404).json({ error: 'Tarjeta no encontrada' });
  if (tarjeta.estado !== 'activa') return res.status(422).json({ error: 'La tarjeta está bloqueada' });
  if (!(await uno('SELECT 1 FROM personas WHERE id = ? AND activo = 1', [personaId]))) {
    return res.status(422).json({ error: 'Selecciona una persona válida' });
  }
  if (monto > tarjeta.disponible) return res.status(422).json({ error: errorDisponible(tarjeta.disponible) });

  // Evita registrar dos veces la misma compra
  const duplicado = await uno(`
    SELECT id FROM gastos
    WHERE tarjeta_id = ? AND comercio = ? COLLATE NOCASE AND fecha_compra = ? AND monto = ? AND estado != 'anulado'
  `, [tarjetaId, comercio, fechaCompra, monto]);
  if (duplicado && !req.body.forzar) {
    return res.status(409).json({ error: 'Ya existe un gasto igual (mismo comercio, fecha y monto)', duplicado_id: duplicado.id });
  }

  // Todo en una transacción. El INSERT vuelve a comprobar el disponible, por si otra persona
  // registró un gasto al mismo tiempo; la factura pasa de "subidas" a "facturas".
  // changes() = 1 en las sentencias siguientes asegura que solo se ejecuten si la anterior sí insertó.
  const creado = ahoraLocal();
  const sentencias = [[`
    INSERT INTO gastos (usuario_id, tarjeta_id, persona_id, comercio, fecha_compra, monto, estado, nota, creado_en)
    SELECT ?, ?, ?, ?, ?, ?, 'confirmado', ?, ?
    WHERE (SELECT ${SQL_DISPONIBLE} FROM tarjetas t WHERE t.id = ?) >= ?
  `, [req.usuario.id, tarjetaId, personaId, comercio, fechaCompra, monto, nota, creado, tarjetaId, monto]],
  ['SELECT changes() AS insertado, last_insert_rowid() AS id']];
  if (archivo) {
    sentencias.push(
      [`INSERT INTO facturas (gasto_id, ruta_archivo, imagen, tipo, texto_ocr, fecha_subida)
        SELECT last_insert_rowid(), '', imagen, tipo, texto, ? FROM subidas WHERE id = ? AND changes() = 1`, [creado, archivo]],
      ['DELETE FROM subidas WHERE id = ? AND changes() = 1', [archivo]],
    );
  }
  const resultados = await lote(sentencias);
  const { insertado, id } = resultados[1].rows[0];
  if (!insertado) {
    const actual = await saldoTarjeta(tarjetaId);
    return res.status(422).json({ error: errorDisponible(actual.disponible) });
  }
  res.status(201).json({ gasto: await buscarGasto(Number(id)), tarjeta: await saldoTarjeta(tarjetaId) });
});

// Transiciones permitidas: pendiente -> confirmado | anulado, confirmado -> anulado
router.patch('/:id/estado', async (req, res) => {
  const gastoId = v.id(req.params.id, 'id');
  const nuevo = v.opcion(req.body.estado, 'estado', ['confirmado', 'anulado']);
  const gasto = await uno('SELECT * FROM gastos WHERE id = ?', [gastoId]);
  if (!gasto || (!esAdmin(req) && gasto.usuario_id !== req.usuario.id)) {
    return res.status(404).json({ error: 'Gasto no encontrado' });
  }
  if (gasto.estado === nuevo || gasto.estado === 'anulado') {
    return res.status(409).json({ error: `El gasto ya está ${gasto.estado}` });
  }
  if (nuevo === 'confirmado') {
    const tarjeta = await saldoTarjeta(gasto.tarjeta_id);
    if (gasto.monto > tarjeta.disponible) return res.status(422).json({ error: errorDisponible(tarjeta.disponible) });
  }
  // La condición sobre el estado anterior impide confirmar dos veces el mismo gasto
  await ejecutar('UPDATE gastos SET estado = ? WHERE id = ? AND estado = ?', [nuevo, gastoId, gasto.estado]);
  res.json({ gasto: await buscarGasto(gastoId), tarjeta: await saldoTarjeta(gasto.tarjeta_id) });
});

export default router;
