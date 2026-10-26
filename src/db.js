import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';

// Con TURSO_DATABASE_URL se usa la base compartida en internet (la misma para local, Render y GitHub Pages).
// Sin ella, un archivo SQLite local (útil para pruebas).
// Se quitan espacios y saltos de línea: al pegar los valores en un panel (p. ej. Render) suele colarse uno al final
const TURSO_URL = process.env.TURSO_DATABASE_URL?.trim();
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN?.trim();

function crearCliente() {
  if (TURSO_URL) {
    return createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
  }
  const archivo = process.env.DB_PATH || path.resolve('data', 'credidiper.db');
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  return createClient({ url: `file:${archivo}` });
}

export const cliente = crearCliente();
export const esRemota = Boolean(TURSO_URL);

const aObjeto = (resultado) => resultado.rows.map((fila) => Object.fromEntries(resultado.columns.map((c, i) => [c, fila[i]])));

export async function todos(sql, args = []) {
  return aObjeto(await cliente.execute({ sql, args }));
}

export async function uno(sql, args = []) {
  return (await todos(sql, args))[0];
}

export async function ejecutar(sql, args = []) {
  const r = await cliente.execute({ sql, args });
  return { id: Number(r.lastInsertRowid), cambios: r.rowsAffected };
}

// Varias sentencias en una sola transacción (todo o nada)
export async function lote(sentencias) {
  return cliente.batch(sentencias.map(([sql, args = []]) => ({ sql, args })), 'write');
}

export async function iniciarBase() {
  await cliente.executeMultiple(`
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

    -- Una factura por gasto (relación 1 a 0..1 del diagrama). La imagen se guarda en la base
    -- para que se vea desde cualquier lugar; ruta_archivo queda por compatibilidad con la versión anterior.
    CREATE TABLE IF NOT EXISTS facturas (
      id           INTEGER PRIMARY KEY,
      gasto_id     INTEGER NOT NULL UNIQUE REFERENCES gastos(id) ON DELETE CASCADE,
      ruta_archivo TEXT,
      imagen       BLOB,
      tipo         TEXT,
      texto_ocr    TEXT,
      fecha_subida TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Depósitos que cada persona hace para pagar lo que gastó con la tarjeta
    CREATE TABLE IF NOT EXISTS pagos (
      id         INTEGER PRIMARY KEY,
      persona_id INTEGER NOT NULL REFERENCES personas(id),
      monto      REAL NOT NULL CHECK (monto > 0),
      fecha      TEXT NOT NULL,
      referencia TEXT,
      nota       TEXT,
      creado_en  TEXT
    );

    -- Imágenes subidas en el paso 1 que todavía no se han guardado como gasto
    CREATE TABLE IF NOT EXISTS subidas (
      id        TEXT PRIMARY KEY,
      imagen    BLOB NOT NULL,
      tipo      TEXT NOT NULL,
      texto     TEXT,
      creado_en INTEGER NOT NULL
    );

    -- Sesiones: se guarda el hash del token, nunca el token
    CREATE TABLE IF NOT EXISTS tokens (
      hash       TEXT PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      expira     INTEGER NOT NULL
    );

    INSERT OR IGNORE INTO roles (id, nombre) VALUES (1, 'admin'), (2, 'usuario');
  `);

  // Bases creadas con versiones anteriores: agrega las columnas que falten
  const columnas = async (tabla) => (await todos(`PRAGMA table_info(${tabla})`)).map((c) => c.name);
  const faltantes = {
    gastos: [['persona_id', 'INTEGER REFERENCES personas(id)'], ['nota', 'TEXT'], ['creado_en', 'TEXT']],
    facturas: [['imagen', 'BLOB'], ['tipo', 'TEXT']],
  };
  for (const [tabla, lista] of Object.entries(faltantes)) {
    const existentes = await columnas(tabla);
    for (const [columna, tipo] of lista) {
      if (!existentes.includes(columna)) await cliente.execute(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${tipo}`);
    }
  }

  await cliente.executeMultiple(`
    CREATE INDEX IF NOT EXISTS idx_gastos_tarjeta ON gastos (tarjeta_id, estado);
    CREATE INDEX IF NOT EXISTS idx_gastos_usuario ON gastos (usuario_id);
    CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos (fecha_compra);
    CREATE INDEX IF NOT EXISTS idx_gastos_persona ON gastos (persona_id, estado);
    CREATE INDEX IF NOT EXISTS idx_pagos_persona ON pagos (persona_id);
  `);

  // Limpieza: sesiones vencidas y subidas abandonadas (más de un día)
  await ejecutar('DELETE FROM tokens WHERE expira <= ?', [Date.now()]);
  await ejecutar('DELETE FROM subidas WHERE creado_en <= ?', [Date.now() - 24 * 60 * 60 * 1000]);

  // Primer arranque: crea un administrador para poder entrar
  const { total } = await uno('SELECT COUNT(*) AS total FROM usuarios');
  if (total === 0) {
    const correo = process.env.ADMIN_CORREO || 'admin@credidiper.local';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    await ejecutar('INSERT INTO usuarios (nombre, correo, password_hash, rol_id) VALUES (?, ?, ?, 1)',
      ['Administrador', correo, bcrypt.hashSync(password, 10)]);
    console.log(`Administrador creado: ${correo} / ${password}  (cambia la contraseña)`);
  }
}

export const redondear = (n) => Math.round(n * 100) / 100;

// Fecha y hora de El Salvador. Los servidores en internet (Render, Turso) trabajan en UTC.
const ZONA = process.env.ZONA_HORARIA || 'America/El_Salvador';
export const ahoraLocal = () => new Date().toLocaleString('sv-SE', { timeZone: ZONA }); // "AAAA-MM-DD HH:MM:SS"
export const mesActual = () => ahoraLocal().slice(0, 7);

// Expresión SQL del disponible de una tarjeta (alias t)
export const SQL_DISPONIBLE = `
  t.limite - t.saldo_inicial - COALESCE((SELECT SUM(g.monto) FROM gastos g WHERE g.tarjeta_id = t.id AND g.estado = 'confirmado'), 0)`;

// Disponible = Límite - Saldo inicial - Gastos confirmados.
// Se calcula siempre a partir de los gastos, nunca se guarda, así una compra no se descuenta dos veces.
export async function saldoTarjeta(tarjetaId) {
  const t = await uno(`
    SELECT t.*,
      COALESCE((SELECT SUM(monto) FROM gastos WHERE tarjeta_id = t.id AND estado = 'confirmado'), 0) AS confirmados,
      COALESCE((SELECT SUM(monto) FROM gastos WHERE tarjeta_id = t.id AND estado = 'pendiente'), 0) AS pendientes
    FROM tarjetas t WHERE t.id = ?
  `, [tarjetaId]);
  if (!t) return null;
  return {
    ...t,
    confirmados: redondear(t.confirmados),
    pendientes: redondear(t.pendientes),
    disponible: redondear(t.limite - t.saldo_inicial - t.confirmados),
  };
}
