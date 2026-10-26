import express from 'express';
import session from 'express-session';
import crypto from 'node:crypto';
import path from 'node:path';
import { ajuste } from './db.js';
import { SqliteStore } from './sesiones.js';
import { requireAuth } from './auth.js';
import authRoutes from './routes/auth.js';
import usuariosRoutes from './routes/usuarios.js';
import personasRoutes from './routes/personas.js';
import tarjetasRoutes from './routes/tarjetas.js';
import gastosRoutes from './routes/gastos.js';
import facturasRoutes from './routes/facturas.js';
import reportesRoutes from './routes/reportes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Permite usar el frontend desde Live Server (puerto 5500) llamando al API de este servidor
const ORIGENES_PERMITIDOS = (process.env.CORS_ORIGINS || 'http://127.0.0.1:5500,http://localhost:5500').split(',');
app.use((req, res, next) => {
  const origen = req.headers.origin;
  if (origen && ORIGENES_PERMITIDOS.includes(origen)) {
    res.set({
      'Access-Control-Allow-Origin': origen,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    });
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  next();
});

app.use(express.json());
app.use(session({
  // El secreto se genera una vez y se guarda en la base, así las sesiones sobreviven a los reinicios
  secret: process.env.SESSION_SECRET || ajuste('session_secret', () => crypto.randomBytes(32).toString('hex')),
  store: new SqliteStore(),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' },
}));

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', requireAuth, usuariosRoutes);
app.use('/api/personas', requireAuth, personasRoutes);
app.use('/api/tarjetas', requireAuth, tarjetasRoutes);
app.use('/api/gastos', requireAuth, gastosRoutes);
app.use('/api/facturas', requireAuth, facturasRoutes);
app.use('/api/reportes', requireAuth, reportesRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use(express.static(path.resolve('public')));

app.use((err, req, res, next) => {
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => console.log(`Credidiper en http://localhost:${PORT}`));
