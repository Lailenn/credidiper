import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { db } from '../db.js';
import { esAdmin } from '../auth.js';
import { leerFactura } from '../ocr.js';
import * as v from '../validar.js';

export const CARPETA_FACTURAS = path.resolve('uploads', 'facturas');
fs.mkdirSync(CARPETA_FACTURAS, { recursive: true });

const EXTENSIONES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
export const NOMBRE_ARCHIVO = /^[a-f0-9]{32}\.(jpg|png|webp)$/;

const subir = multer({
  storage: multer.diskStorage({
    destination: CARPETA_FACTURAS,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + EXTENSIONES[file.mimetype]),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (EXTENSIONES[file.mimetype]) return cb(null, true);
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
      const leido = await leerFactura(req.file.path);
      res.json({ archivo: req.file.filename, ...leido, ok: true });
    } catch (e) {
      console.error('OCR:', e.message);
      // La imagen queda guardada aunque falle la lectura; el usuario completa los datos a mano
      res.json({ archivo: req.file.filename, texto: '', comercio: '', fecha: '', monto: null, ok: false });
    }
  });
});

router.get('/:gastoId/imagen', (req, res) => {
  const factura = db.prepare(`
    SELECT f.ruta_archivo, g.usuario_id FROM facturas f JOIN gastos g ON g.id = f.gasto_id WHERE f.gasto_id = ?
  `).get(v.id(req.params.gastoId, 'gasto'));
  if (!factura || (!esAdmin(req) && factura.usuario_id !== req.usuario.id) || !NOMBRE_ARCHIVO.test(factura.ruta_archivo)) {
    return res.status(404).json({ error: 'Factura no encontrada' });
  }
  if (req.query.descargar) res.attachment(`factura-${req.params.gastoId}${path.extname(factura.ruta_archivo)}`);
  res.sendFile(path.join(CARPETA_FACTURAS, factura.ruta_archivo));
});

export default router;
