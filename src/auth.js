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

export async function cerrarSesion(token) {
  if (token) await ejecutar('DELETE FROM tokens WHERE hash = ?', [hashToken(token)]);
}

// Las imágenes se piden con <img src>, que no puede mandar cabeceras: para ellas se acepta ?t=token
export const tokenDe = (req) => req.get('authorization')?.replace(/^Bearer\s+/i, '') || req.query.t || null;

// Se vuelve a leer el usuario en cada petición para que desactivarlo o cambiarle el rol tenga efecto inmediato
export async function requireAuth(req, res, next) {
  const token = tokenDe(req);
  const usuario = token && await uno(`
    SELECT u.id, u.nombre, u.correo, r.nombre AS rol
    FROM tokens k
    JOIN usuarios u ON u.id = k.usuario_id
    JOIN roles r ON r.id = u.rol_id
    WHERE k.hash = ? AND k.expira > ? AND u.activo = 1
  `, [hashToken(token), Date.now()]);
  if (!usuario) return res.status(401).json({ error: 'Debes iniciar sesión' });
  req.usuario = usuario;
  next();
}

export const requireRol = (...roles) => (req, res, next) =>
  roles.includes(req.usuario.rol) ? next() : res.status(403).json({ error: 'No tienes permiso para esta acción' });

export const esAdmin = (req) => req.usuario.rol === 'admin';
