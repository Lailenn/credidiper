// Copia los datos de la base local (data/credidiper.db + uploads/facturas) a la base compartida de Turso.
// Uso:  npm run migrar            (se detiene si la base en línea ya tiene datos)
//       npm run migrar -- --forzar (reemplaza lo que haya en la base en línea)
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { cliente as remota, esRemota, iniciarBase } from '../src/db.js';

if (!esRemota) {
  console.error('Falta TURSO_DATABASE_URL en el archivo .env');
  process.exit(1);
}

const archivoLocal = path.resolve(process.env.DB_ORIGEN || 'data/credidiper.db');
if (!fs.existsSync(archivoLocal)) {
  console.error(`No existe la base local ${archivoLocal}`);
  process.exit(1);
}
const local = createClient({ url: `file:${archivoLocal}` });
const leer = async (sql) => {
  const r = await local.execute(sql);
  return r.rows.map((fila) => Object.fromEntries(r.columns.map((c, i) => [c, fila[i]])));
};

await iniciarBase();

const contar = async (tabla) => Number((await remota.execute(`SELECT COUNT(*) AS n FROM ${tabla}`)).rows[0].n);
const ocupada = (await contar('gastos')) + (await contar('personas')) + (await contar('tarjetas'));
if (ocupada && !process.argv.includes('--forzar')) {
  console.error('La base en línea ya tiene datos. Usa "npm run migrar -- --forzar" para reemplazarlos.');
  process.exit(1);
}

const [usuarios, personas, tarjetas, gastos, facturas] = await Promise.all(
  ['usuarios', 'personas', 'tarjetas', 'gastos', 'facturas'].map((t) => leer(`SELECT * FROM ${t} ORDER BY id`)),
);

// Imágenes: de la columna imagen o, en la versión anterior, del archivo en uploads/facturas
const carpeta = path.resolve('uploads', 'facturas');
const tipos = { '.png': 'image/png', '.webp': 'image/webp' };
let sinImagen = 0;
const facturasConImagen = facturas.map((f) => {
  if (f.imagen) return { ...f, imagen: new Uint8Array(f.imagen) };
  const ruta = f.ruta_archivo && path.join(carpeta, path.basename(f.ruta_archivo));
  if (ruta && fs.existsSync(ruta)) {
    return { ...f, imagen: fs.readFileSync(ruta), tipo: tipos[path.extname(ruta)] || 'image/jpeg' };
  }
  sinImagen++;
  return null;
}).filter(Boolean);

const sentencias = [
  'DELETE FROM facturas', 'DELETE FROM subidas', 'DELETE FROM gastos', 'DELETE FROM tokens',
  'DELETE FROM personas', 'DELETE FROM tarjetas', 'DELETE FROM usuarios',
  ...usuarios.map((u) => ({
    sql: 'INSERT INTO usuarios (id, nombre, correo, password_hash, rol_id, activo) VALUES (?, ?, ?, ?, ?, ?)',
    args: [u.id, u.nombre, u.correo, u.password_hash, u.rol_id, u.activo],
  })),
  ...personas.map((p) => ({ sql: 'INSERT INTO personas (id, nombre, activo) VALUES (?, ?, ?)', args: [p.id, p.nombre, p.activo] })),
  ...tarjetas.map((t) => ({
    sql: 'INSERT INTO tarjetas (id, nombre, limite, saldo_inicial, estado) VALUES (?, ?, ?, ?, ?)',
    args: [t.id, t.nombre, t.limite, t.saldo_inicial, t.estado],
  })),
  ...gastos.map((g) => ({
    sql: `INSERT INTO gastos (id, usuario_id, tarjeta_id, persona_id, comercio, fecha_compra, monto, estado, nota, creado_en)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [g.id, g.usuario_id, g.tarjeta_id, g.persona_id ?? null, g.comercio, g.fecha_compra, g.monto, g.estado, g.nota ?? null, g.creado_en ?? null],
  })),
  ...facturasConImagen.map((f) => ({
    sql: 'INSERT INTO facturas (id, gasto_id, ruta_archivo, imagen, tipo, texto_ocr, fecha_subida) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [f.id, f.gasto_id, '', f.imagen, f.tipo, f.texto_ocr ?? null, f.fecha_subida],
  })),
];
await remota.batch(sentencias, 'write');

console.log(`Copiado a Turso: ${usuarios.length} usuarios, ${personas.length} personas, ${tarjetas.length} tarjetas, ` +
  `${gastos.length} gastos, ${facturasConImagen.length} facturas.`);
if (sinImagen) console.log(`Aviso: ${sinImagen} factura(s) no tenían imagen en disco y no se copiaron.`);
console.log('Las contraseñas son las mismas que en tu computadora.');
