import { Router } from 'express';
import { todos, uno, ejecutar, lote, redondear, ahoraLocal, mesActual, SQL_PERSONAS, conSaldo, cuentaPersona } from '../db.js';
import { requireRol } from '../auth.js';
import * as v from '../validar.js';

// Depósitos y abonos: el dinero que cada persona te entrega para pagar lo que compró con tu tarjeta.
// No es el pago que tú haces al banco. Cada depósito cuenta para el mes de su fecha.
const router = Router();

export const METODOS = ['efectivo', 'transferencia', 'deposito'];
const MES = /^\d{4}-\d{2}$/;

const SELECT_DEPOSITOS = `
  SELECT d.id, d.persona_id, p.nombre AS persona, d.monto, d.fecha, d.metodo, d.referencia, d.nota,
         d.comprobante IS NOT NULL AS tiene_comprobante, d.anulado, d.anulado_en, d.creado_en
  FROM pagos d JOIN personas p ON p.id = d.persona_id
`;

const opcional = (valor, campo, max) => (typeof valor === 'string' && valor.trim() ? v.texto(valor, campo, { max }) : null);

// Registra un depósito (también lo usa la ruta antigua /api/personas/:id/pagos).
// Si trae "archivo", la foto del comprobante subida antes con /api/facturas pasa a quedar guardada en el depósito.
export async function crearDeposito(personaId, cuerpo) {
  if (!(await uno('SELECT 1 FROM personas WHERE id = ?', [personaId]))) {
    throw Object.assign(new v.ErrorValidacion('Persona no encontrada'), { status: 404 });
  }
  const monto = v.dinero(cuerpo.monto, 'importe', { minExclusivo: true });
  const fecha = v.fecha(cuerpo.fecha, 'fecha');
  const metodo = cuerpo.metodo ? v.opcion(cuerpo.metodo, 'método de pago', METODOS) : null;
  const referencia = opcional(cuerpo.referencia, 'referencia', 60);
  const nota = opcional(cuerpo.nota, 'nota', 300);
  const archivo = typeof cuerpo.archivo === 'string' && cuerpo.archivo ? cuerpo.archivo : null;
  if (archivo && !(await uno('SELECT 1 FROM subidas WHERE id = ?', [archivo]))) {
    throw new v.ErrorValidacion('La foto del comprobante ya no está disponible, vuelve a subirla');
  }

  const valores = [personaId, monto, fecha, metodo, referencia, nota, ahoraLocal()];
  const resultados = await lote(archivo
    ? [
      [`INSERT INTO pagos (persona_id, monto, fecha, metodo, referencia, nota, creado_en, comprobante, comprobante_tipo)
        SELECT ?, ?, ?, ?, ?, ?, ?, imagen, tipo FROM subidas WHERE id = ?`, [...valores, archivo]],
      ['SELECT changes() AS insertado, last_insert_rowid() AS id'],
      ['DELETE FROM subidas WHERE id = ?', [archivo]],
    ]
    : [
      ['INSERT INTO pagos (persona_id, monto, fecha, metodo, referencia, nota, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?)', valores],
      ['SELECT changes() AS insertado, last_insert_rowid() AS id'],
    ]);
  const { insertado, id: nuevo } = resultados[1].rows[0];
  if (!Number(insertado)) throw new v.ErrorValidacion('La foto del comprobante ya no está disponible, vuelve a subirla');
  const id = Number(nuevo);
  return { deposito: await uno(`${SELECT_DEPOSITOS} WHERE d.id = ?`, [id]), persona: await cuentaPersona(personaId) };
}

// Anula un depósito equivocado: deja de contar en el saldo pero se conserva en el historial
export async function anularDeposito(depositoId, personaId) {
  const filtro = personaId ? ' AND persona_id = ?' : '';
  const d = await uno(`SELECT * FROM pagos WHERE id = ?${filtro}`, personaId ? [depositoId, personaId] : [depositoId]);
  if (!d) throw Object.assign(new v.ErrorValidacion('Depósito no encontrado'), { status: 404 });
  if (d.anulado) throw Object.assign(new v.ErrorValidacion('El depósito ya está anulado'), { status: 409 });
  await ejecutar('UPDATE pagos SET anulado = 1, anulado_en = ? WHERE id = ? AND anulado = 0', [ahoraLocal(), depositoId]);
  return { deposito: await uno(`${SELECT_DEPOSITOS} WHERE d.id = ?`, [depositoId]), persona: await cuentaPersona(d.persona_id) };
}

// Depósitos de un mes (?mes=AAAA-MM, por defecto el actual; ?persona_id opcional) con los indicadores de la pantalla
router.get('/', async (req, res) => {
  const mes = req.query.mes || mesActual();
  if (!MES.test(mes)) throw new v.ErrorValidacion('El mes debe tener formato AAAA-MM');
  const filtros = ['substr(d.fecha, 1, 7) = ?'];
  const valores = [mes];
  if (req.query.persona_id) {
    filtros.push('d.persona_id = ?');
    valores.push(v.id(req.query.persona_id, 'persona'));
  }
  const [depositos, personas] = await Promise.all([
    todos(`${SELECT_DEPOSITOS} WHERE ${filtros.join(' AND ')} ORDER BY d.fecha DESC, d.id DESC`, valores),
    todos(SQL_PERSONAS),
  ]);
  const validos = depositos.filter((d) => !d.anulado);
  const cuentas = personas.map(conSaldo);
  res.json({
    mes,
    resumen: {
      total_recibido: redondear(validos.reduce((s, d) => s + d.monto, 0)),
      cantidad: validos.length,
      personas_que_abonaron: new Set(validos.map((d) => d.persona_id)).size,
      // A la fecha, no solo de este mes: lo que todavía te deben entre todas las personas
      pendiente: redondear(cuentas.reduce((s, p) => s + Math.max(0, p.saldo), 0)),
      a_favor: redondear(cuentas.reduce((s, p) => s + Math.max(0, -p.saldo), 0)),
    },
    depositos,
  });
});

router.post('/', requireRol('admin'), async (req, res) => {
  res.status(201).json(await crearDeposito(v.id(req.body.persona_id, 'persona'), req.body));
});

router.patch('/:id/anular', requireRol('admin'), async (req, res) => {
  res.json(await anularDeposito(v.id(req.params.id, 'id')));
});

// Foto del comprobante (se pide con <img src>, por eso el token va en ?t=)
router.get('/:id/comprobante', async (req, res) => {
  const d = await uno('SELECT comprobante, comprobante_tipo FROM pagos WHERE id = ?', [v.id(req.params.id, 'id')]);
  if (!d?.comprobante) return res.status(404).json({ error: 'Comprobante no encontrado' });
  res.set('Cache-Control', 'private, max-age=86400');
  res.type(d.comprobante_tipo || 'image/jpeg').send(Buffer.from(d.comprobante));
});

export default router;
