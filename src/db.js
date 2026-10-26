import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';

const dbPath = process.env.DB_PATH || path.resolve('data', 'credidiper.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS roles (
    id     INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS usuarios (
    id            INTEGER PRIMARY KEY,
    nombre        TEXT NOT NULL,
    correo        TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    rol_id        INTEGER NOT NULL REFERENCES roles(id),
    activo        INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
  );

  -- Personas que comparten la tarjeta (a quién se le atribuye cada gasto)
  CREATE TABLE IF NOT EXISTS personas (
    id     INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE COLLATE NOCASE,
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
  );

  CREATE TABLE IF NOT EXISTS tarjetas (
    id            INTEGER PRIMARY KEY,
    nombre        TEXT NOT NULL,
    limite        REAL NOT NULL CHECK (limite >= 0),
    saldo_inicial REAL NOT NULL DEFAULT 0 CHECK (saldo_inicial >= 0),
    estado        TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'bloqueada'))
  );

  CREATE TABLE IF NOT EXISTS gastos (
    id           INTEGER PRIMARY KEY,
    usuario_id   INTEGER NOT NULL REFERENCES usuarios(id),
    tarjeta_id   INTEGER NOT NULL REFERENCES tarjetas(id),
    persona_id   INTEGER REFERENCES personas(id),
    comercio     TEXT NOT NULL,
    fecha_compra TEXT NOT NULL,
    monto        REAL NOT NULL CHECK (monto > 0),
    estado       TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmado', 'anulado')),
    nota         TEXT,
    creado_en    TEXT
  );

  -- Una factura por gasto (relación 1 a 0..1 del diagrama)
  CREATE TABLE IF NOT EXISTS facturas (
    id           INTEGER PRIMARY KEY,
    gasto_id     INTEGER NOT NULL UNIQUE REFERENCES gastos(id) ON DELETE CASCADE,
    ruta_archivo TEXT NOT NULL,
    texto_ocr    TEXT,
    fecha_subida TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sesiones (
    sid    TEXT PRIMARY KEY,
    datos  TEXT NOT NULL,
    expira INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ajustes (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  );

  INSERT OR IGNORE INTO roles (id, nombre) VALUES (1, 'admin'), (2, 'usuario');
`);

// Bases creadas con la versión anterior: agrega las columnas nuevas de gastos
const columnasGastos = db.prepare('PRAGMA table_info(gastos)').all().map((c) => c.name);
for (const [columna, tipo] of [['persona_id', 'INTEGER REFERENCES personas(id)'], ['nota', 'TEXT'], ['creado_en', 'TEXT']]) {
  if (!columnasGastos.includes(columna)) db.exec(`ALTER TABLE gastos ADD COLUMN ${columna} ${tipo}`);
}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_gastos_tarjeta ON gastos (tarjeta_id, estado);
  CREATE INDEX IF NOT EXISTS idx_gastos_usuario ON gastos (usuario_id);
  CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos (fecha_compra);
`);

// Primer arranque: crea un administrador para poder entrar
const { total } = db.prepare('SELECT COUNT(*) AS total FROM usuarios').get();
if (total === 0) {
  const correo = process.env.ADMIN_CORREO || 'admin@credidiper.local';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  db.prepare('INSERT INTO usuarios (nombre, correo, password_hash, rol_id) VALUES (?, ?, ?, 1)')
    .run('Administrador', correo, bcrypt.hashSync(password, 10));
  console.log(`Administrador creado: ${correo} / ${password}  (cambia la contraseña)`);
}

export function ajuste(clave, crear) {
  const fila = db.prepare('SELECT valor FROM ajustes WHERE clave = ?').get(clave);
  if (fila) return fila.valor;
  const valor = crear();
  db.prepare('INSERT INTO ajustes (clave, valor) VALUES (?, ?)').run(clave, valor);
  return valor;
}

export const redondear = (n) => Math.round(n * 100) / 100;

// Disponible = Límite - Saldo inicial - Gastos confirmados.
// Se calcula siempre a partir de los gastos, nunca se guarda, así una compra no se descuenta dos veces.
export function saldoTarjeta(tarjetaId) {
  const tarjeta = db.prepare('SELECT * FROM tarjetas WHERE id = ?').get(tarjetaId);
  if (!tarjeta) return null;
  const sumas = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN estado = 'confirmado' THEN monto END), 0) AS confirmados,
      COALESCE(SUM(CASE WHEN estado = 'pendiente'  THEN monto END), 0) AS pendientes
    FROM gastos WHERE tarjeta_id = ?
  `).get(tarjetaId);
  return {
    ...tarjeta,
    confirmados: redondear(sumas.confirmados),
    pendientes: redondear(sumas.pendientes),
    disponible: redondear(tarjeta.limite - tarjeta.saldo_inicial - sumas.confirmados),
  };
}
