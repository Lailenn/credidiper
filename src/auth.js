import { db } from './db.js';

const buscarSesion = db.prepare(`
  SELECT u.id, u.nombre, u.correo, r.nombre AS rol
  FROM usuarios u JOIN roles r ON r.id = u.rol_id
  WHERE u.id = ? AND u.activo = 1
`);

// Se vuelve a leer el usuario en cada petición para que desactivarlo o cambiarle el rol tenga efecto inmediato
export function requireAuth(req, res, next) {
  const usuario = req.session.usuarioId && buscarSesion.get(req.session.usuarioId);
  if (!usuario) {
    req.session.usuarioId = null;
    return res.status(401).json({ error: 'Debes iniciar sesión' });
  }
  req.usuario = usuario;
  next();
}

export const requireRol = (...roles) => (req, res, next) =>
  roles.includes(req.usuario.rol) ? next() : res.status(403).json({ error: 'No tienes permiso para esta acción' });

export const esAdmin = (req) => req.usuario.rol === 'admin';
