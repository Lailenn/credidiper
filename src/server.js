import express from 'express';
import path from 'node:path';
import { iniciarBase, esRemota, despertarBase } from './db.js';
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

// Páginas que pueden usar este API: GitHub Pages y Live Server
const ORIGENES_PERMITIDOS = (process.env.CORS_ORIGINS
  || 'https://lailenn.github.io,http://127.0.0.1:5500,http://localhost:5500').split(',');
app.use((req, res, next) => {
  const origen = req.headers.origin;
  if (origen && ORIGENES_PERMITIDOS.includes(origen)) {
    res.set({
      'Access-Control-Allow-Origin': origen,
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    });
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  next();
});

app.use(express.json());

// La página la llama apenas abre, para despertar el servidor y la base mientras se escribe la contraseña
app.get('/api/salud', async (req, res) => {
  await despertarBase();
  res.json({ ok: true });
});
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

await iniciarBase();
app.listen(PORT, (err) => {
  if (err) {
    console.error(err.code === 'EADDRINUSE'
      ? `El puerto ${PORT} ya está en uso: cierra el otro servidor (Ctrl + C en su terminal) y vuelve a intentarlo.`
      : err);
    process.exit(1);
  }
  console.log(`Credidiper en http://localhost:${PORT} · base ${esRemota ? 'compartida (Turso)' : 'local'}`);
});
