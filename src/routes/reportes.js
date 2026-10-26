import { Router } from 'express';
import { db, redondear } from '../db.js';
import { esAdmin } from '../auth.js';
import * as v from '../validar.js';

const router = Router();

// Resumen de un mes (?mes=AAAA-MM, por defecto el actual). Solo cuenta gastos confirmados;
// el usuario normal ve únicamente lo que registró.
router.get('/resumen', (req, res) => {
  const mes = req.query.mes || new Date().toLocaleDateString('en-CA').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(mes)) throw new v.ErrorValidacion('El mes debe tener formato AAAA-MM');

  const condicion = `g.estado = 'confirmado' AND substr(g.fecha_compra, 1, 7) = ?${esAdmin(req) ? '' : ' AND g.usuario_id = ?'}`;
  const valores = esAdmin(req) ? [mes] : [mes, req.usuario.id];

  const totales = db.prepare(`
    SELECT COUNT(*) AS cantidad, COALESCE(SUM(monto), 0) AS total FROM gastos g WHERE ${condicion}
  `).get(...valores);

  // Incluye a todas las personas activas, aunque no tengan gastos ese mes
  const porPersona = db.prepare(`
    SELECT p.id, p.nombre, COUNT(g.id) AS cantidad, COALESCE(SUM(g.monto), 0) AS total
    FROM personas p
    LEFT JOIN gastos g ON g.persona_id = p.id AND ${condicion}
    WHERE p.activo = 1 OR g.id IS NOT NULL
    GROUP BY p.id ORDER BY total DESC, p.nombre
  `).all(...valores);

  const porComercio = db.prepare(`
    SELECT comercio, COUNT(*) AS cantidad, SUM(monto) AS total
    FROM gastos g WHERE ${condicion} GROUP BY comercio COLLATE NOCASE ORDER BY total DESC LIMIT 5
  `).all(...valores);

  const fix = (filas) => filas.map((f) => ({ ...f, total: redondear(f.total) }));
  res.json({
    mes,
    cantidad: totales.cantidad,
    total: redondear(totales.total),
    por_persona: fix(porPersona),
    por_comercio: fix(porComercio),
  });
});

export default router;
