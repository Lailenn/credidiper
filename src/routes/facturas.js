import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { todos, uno, ejecutar } from '../db.js';
import { esAdmin } from '../auth.js';
import { leerFactura } from '../ocr.js';
import * as v from '../validar.js';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
// Facturas de la versión anterior, guardadas como archivo en disco
const CARPETA_ANTIGUA = path.resolve('uploads', 'facturas');

const subir = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (TIPOS.includes(file.mimetype)) return cb(null, true);
    cb(new v.ErrorValidacion('Formato no admitido. Usa JPG, PNG o WEBP'));
  },
});

const router = Router();

// Paso 1 del registro: guarda la imagen y devuelve lo que el OCR pudo leer, para que el usuario lo revise
router.post('/ocr', (req, res, next) => {
  subir.single('imagen')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'La imagen pesa más de 8 MB' });
      return next(err);
    }
    if (!req.file) return res.status(400).json({ error: 'Selecciona una imagen' });
    try {
      const archivo = crypto.randomBytes(16).toString('hex');
      let leido = { texto: '', comercio: '', fecha: '', monto: null, ok: false };
      try {
        // Los comercios ya registrados ayudan a corregir el nombre que lea el OCR
        const conocidos = (await todos(`
          SELECT comercio FROM gastos WHERE estado != 'anulado' GROUP BY comercio COLLATE NOCASE ORDER BY MAX(id) DESC LIMIT 300
        `)).map((f) => f.comercio);
        leido = { ...await leerFactura(req.file.buffer, conocidos), ok: true };
      } catch (e) {
        // La imagen queda guardada aunque falle la lectura; el usuario completa los datos a mano
        console.error('OCR:', e.message);
      }
      await ejecutar('INSERT INTO subidas (id, imagen, tipo, texto, creado_en) VALUES (?, ?, ?, ?, ?)',
        [archivo, req.file.buffer, req.file.mimetype, leido.texto, Date.now()]);
      res.json({ archivo, ...leido });
    } catch (e) {
      next(e);
    }
  });
});

router.get('/:gastoId/imagen', async (req, res) => {
  const gastoId = v.id(req.params.gastoId, 'gasto');
  const factura = await uno(`
    SELECT f.imagen, f.tipo, f.ruta_archivo, g.usuario_id FROM facturas f JOIN gastos g ON g.id = f.gasto_id WHERE f.gasto_id = ?
  `, [gastoId]);
  if (!factura || (!esAdmin(req) && factura.usuario_id !== req.usuario.id)) {
    return res.status(404).json({ error: 'Factura no encontrada' });
  }
  const extension = { 'image/png': '.png', 'image/webp': '.webp' }[factura.tipo] || '.jpg';
  if (req.query.descargar) res.attachment(`factura-${gastoId}${extension}`);
  res.set('Cache-Control', 'private, max-age=86400');
  if (factura.imagen) return res.type(factura.tipo || 'image/jpeg').send(Buffer.from(factura.imagen));
  const antigua = factura.ruta_archivo && path.join(CARPETA_ANTIGUA, path.basename(factura.ruta_archivo));
  if (antigua && fs.existsSync(antigua)) return res.sendFile(antigua);
  res.status(404).json({ error: 'Factura no encontrada' });
});

export default router;
