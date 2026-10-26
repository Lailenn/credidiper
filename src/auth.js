import crypto from 'node:crypto';
import { uno, ejecutar } from './db.js';

const UN_DIA = 24 * 60 * 60 * 1000;
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Sesión por token (cabecera Authorization: Bearer ...). Se usa token y no cookie porque
// la página en GitHub Pages y el servidor en Render son dominios distintos y los navegadores bloquean esas cookies.
export async function crearSesion(usuarioId, recordar) {
  const token = crypto.randomBytes(32).toString('hex');
  const expira = Date.now() + (recordar ? 30 * UN_DIA : UN_DIA);
  await ejecutar('INSERT INTO tokens (hash, usuario_id, expira) VALUES (?, ?, ?)', [hashToken(token), usuarioId, expira]);
  return token;
}

// Sesiones ya comprobadas, en memoria por unos minutos: así cada petición no tiene que
// consultar la base (cada consulta a Turso es un viaje por internet)
const sesionesEnMemoria = new Map();
const MEMORIA_MS = 5 * 60 * 1000;
export const olvidarSesiones = () => sesionesEnMemoria.clear();

export async function cerrarSesion(token) {
  if (!token) return;
  sesionesEnMemoria.delete(hashToken(token));
  await ejecutar('DELETE FROM tokens WHERE hash = ?', [hashToken(token)]);
}

// Las imágenes se piden con <img src>, que no puede mandar cabeceras: para ellas se acepta ?t=token
export const tokenDe = (req) => req.get('authorization')?.replace(/^Bearer\s+/i, '') || req.query.t || null;

export async function requireAuth(req, res, next) {
  const token = tokenDe(req);
  if (!token) return res.status(401).json({ error: 'Debes iniciar sesión' });
  const hash = hashToken(token);
  const guardada = sesionesEnMemoria.get(hash);
  let usuario = guardada && guardada.hasta > Date.now() ? guardada.usuario : null;
  if (!usuario) {
    const fila = await uno(`
      SELECT u.id, u.nombre, u.correo, r.nombre AS rol, k.expira
      FROM tokens k
      JOIN usuarios u ON u.id = k.usuario_id
      JOIN roles r ON r.id = u.rol_id
      WHERE k.hash = ? AND k.expira > ? AND u.activo = 1
    `, [hash, Date.now()]);
    if (fila) {
      const { expira, ...datos } = fila;
      usuario = datos;
      sesionesEnMemoria.set(hash, { usuario, hasta: Math.min(Date.now() + MEMORIA_MS, expira) });
    } else {
      sesionesEnMemoria.delete(hash);
    }
  }
  if (!usuario) return res.status(401).json({ error: 'Debes iniciar sesión' });
  req.usuario = usuario;
  next();
}

export const requireRol = (...roles) => (req, res, next) =>
  roles.includes(req.usuario.rol) ? next() : res.status(403).json({ error: 'No tienes permiso para esta acción' });

export const esAdmin = (req) => req.usuario.rol === 'admin';
