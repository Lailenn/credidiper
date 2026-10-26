// Modo demostración (GitHub Pages): imita el API del servidor dentro del navegador.
// Los datos se guardan en localStorage, solo en el navegador de quien lo usa, y el OCR corre aquí mismo.
import { extraerDatos } from './extraer.js';

const CLAVE = 'credisiman-demo-v1';
const CLAVE_IMG = (gastoId) => `${CLAVE}-factura-${gastoId}`;
const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';

export const CREDENCIALES = { correo: 'admin@credidiper.local', password: 'admin123' };

// ---------- Almacenamiento ----------
const ahora = () => {
  const d = new Date();
  return `${d.toLocaleDateString('en-CA')} ${d.toTimeString().slice(0, 8)}`;
};
const redondear = (n) => Math.round(n * 100) / 100;

async function hash(texto) {
  const datos = new TextEncoder().encode(`credisiman-demo:${texto}`);
  const buffer = await crypto.subtle.digest('SHA-256', datos);
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Datos de ejemplo: los mismos montos del diseño (límite $1,100, gastado $390.50)
async function datosIniciales() {
  const hoy = new Date();
  const mes = hoy.toLocaleDateString('en-CA').slice(0, 7);
  const dia = (d) => `${mes}-${String(Math.min(d, hoy.getDate())).padStart(2, '0')}`;
  const ejemplos = [
    [1, 'Super Selectos', 2, 45.25], [2, 'Texaco', 3, 25.0], [3, 'Walmart', 5, 38.9],
    [1, 'Despensa Familiar', 7, 15.25], [2, 'Siman', 9, 120.0], [1, 'Super Selectos', 11, 38.75],
    [3, 'Farmacia Económica', 13, 46.1], [2, 'Pizza Hut', 15, 35.5], [1, 'Farmacias San Nicolás', 18, 25.75],
  ];
  return {
    seq: { usuarios: 1, personas: 4, tarjetas: 1, gastos: ejemplos.length },
    sesion: null,
    usuarios: [{ id: 1, nombre: 'Administrador', correo: CREDENCIALES.correo, password_hash: await hash(CREDENCIALES.password), rol: 'admin', activo: 1 }],
    personas: ['Mamá', 'Rubén', 'Tía', 'Francisca'].map((nombre, i) => ({ id: i + 1, nombre, activo: 1 })),
    tarjetas: [{ id: 1, nombre: 'Credisiman', limite: 1100, saldo_inicial: 0, estado: 'activa' }],
    gastos: ejemplos.map(([persona, comercio, d, monto], i) => ({
      id: i + 1, usuario_id: 1, tarjeta_id: 1, persona_id: persona, comercio, fecha_compra: dia(d),
      monto, estado: 'confirmado', nota: null, creado_en: `${dia(d)} 10:${String(10 + i).padStart(2, '0')}:00`,
    })),
    facturas: [],
  };
}

let db = null;
async function cargar() {
  if (db) return db;
  try { db = JSON.parse(localStorage.getItem(CLAVE)); } catch { db = null; }
  if (!db) {
    db = await datosIniciales();
    guardar();
  }
  return db;
}
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(db)); } catch { /* sin almacenamiento: los datos duran hasta recargar */ }
}

export async function reiniciar() {
  Object.keys(localStorage).filter((k) => k.startsWith(CLAVE)).forEach((k) => localStorage.removeItem(k));
  db = null;
  await cargar();
}

// ---------- Validación (mismas reglas que src/validar.js) ----------
const fallo = (status, error) => { throw Object.assign(new Error(error), { status, datos: { error } }); };
const texto = (valor, campo, max = 200) => {
  const limpio = typeof valor === 'string' ? valor.trim() : '';
  if (!limpio) fallo(400, `El campo "${campo}" es obligatorio`);
  if (limpio.length > max) fallo(400, `El campo "${campo}" es demasiado largo`);
  return limpio;
};
const dinero = (valor, campo, minExclusivo = false) => {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0 || (minExclusivo && n === 0)) {
    fallo(400, `El campo "${campo}" debe ser un monto ${minExclusivo ? 'mayor' : 'mayor o igual'} a 0`);
  }
  return redondear(n);
};
const fecha = (valor, campo) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor || '') || Number.isNaN(Date.parse(valor))) fallo(400, `El campo "${campo}" debe tener formato AAAA-MM-DD`);
  return valor;
};
const opcion = (valor, campo, opciones) => {
  if (!opciones.includes(valor)) fallo(400, `El campo "${campo}" debe ser: ${opciones.join(', ')}`);
  return valor;
};
const igual = (a, b) => a.localeCompare(b, 'es', { sensitivity: 'accent' }) === 0;

// ---------- Lógica ----------
function saldoTarjeta(id) {
  const t = db.tarjetas.find((x) => x.id === id);
  if (!t) return null;
  const suma = (estado) => db.gastos.filter((g) => g.tarjeta_id === id && g.estado === estado).reduce((s, g) => s + g.monto, 0);
  const confirmados = suma('confirmado');
  return { ...t, confirmados: redondear(confirmados), pendientes: redondear(suma('pendiente')), disponible: redondear(t.limite - t.saldo_inicial - confirmados) };
}

function usuarioActual() {
  const u = db.sesion && db.usuarios.find((x) => x.id === db.sesion && x.activo);
  if (!u) fallo(401, 'Debes iniciar sesión');
  return u;
}
const esAdmin = (u) => u.rol === 'admin';
const soloAdmin = (u) => { if (!esAdmin(u)) fallo(403, 'No tienes permiso para esta acción'); };

function gastoCompleto(g) {
  const factura = db.facturas.find((f) => f.gasto_id === g.id);
  return {
    ...g,
    usuario: db.usuarios.find((u) => u.id === g.usuario_id)?.nombre,
    tarjeta: db.tarjetas.find((t) => t.id === g.tarjeta_id)?.nombre,
    persona: db.personas.find((p) => p.id === g.persona_id)?.nombre ?? null,
    tiene_factura: factura ? 1 : 0,
    fecha_subida: factura?.fecha_subida ?? null,
  };
}
const gastosVisibles = (u) => db.gastos.filter((g) => esAdmin(u) || g.usuario_id === u.id);
const ordenGastos = (a, b) => b.fecha_compra.localeCompare(a.fecha_compra) || b.id - a.id;

// ---------- OCR en el navegador ----------
let workerPromesa = null;
function cargarTesseract() {
  if (window.Tesseract) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TESSERACT_URL;
    s.onload = resolve;
    s.onerror = () => reject(new Error('No se pudo cargar el lector de facturas'));
    document.head.append(s);
  });
}
const obtenerWorker = () => {
  workerPromesa ??= cargarTesseract().then(() => window.Tesseract.createWorker('spa')).catch((err) => {
    workerPromesa = null;
    throw err;
  });
  return workerPromesa;
};

// Reduce la foto para que quepa en el almacenamiento del navegador
async function comprimir(archivo) {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

const subidas = new Map(); // archivo -> imagen en dataURL, hasta que se guarde el gasto

export function urlFactura(gastoId) {
  return localStorage.getItem(CLAVE_IMG(gastoId)) || '';
}

// ---------- Rutas ----------
export async function api(url, opciones = {}) {
  await cargar();
  const { pathname, searchParams: q } = new URL(url, location.origin);
  const metodo = (opciones.method || 'GET').toUpperCase();
  const body = opciones.body instanceof FormData ? opciones.body : (opciones.body || {});
  const partes = pathname.replace(/^\/api\//, '').split('/');
  const [recurso, idTexto, extra] = partes;
  const id = idTexto ? Number(idTexto) : null;
  const ruta = `${metodo} ${recurso}${idTexto ? (Number.isInteger(id) && id > 0 ? '/:id' : `/${idTexto}`) : ''}${extra ? `/${extra}` : ''}`;

  // --- Sesión ---
  if (ruta === 'POST auth/login') {
    const u = db.usuarios.find((x) => typeof body.correo === 'string' && igual(x.correo, body.correo.trim()));
    if (!u || u.password_hash !== await hash(body.password || '')) fallo(401, 'Correo o contraseña incorrectos');
    if (!u.activo) fallo(403, 'Tu usuario está desactivado');
    db.sesion = u.id;
    guardar();
    return { ok: true };
  }
  if (ruta === 'POST auth/logout') { db.sesion = null; guardar(); return { ok: true }; }

  const u = usuarioActual();

  switch (ruta) {
    case 'GET auth/me':
      return { id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol };

    case 'PATCH auth/password': {
      const actual = texto(body.actual, 'contraseña actual');
      const nueva = texto(body.nueva, 'contraseña nueva');
      if (nueva.length < 6) fallo(400, 'La contraseña nueva debe tener al menos 6 caracteres');
      if (u.password_hash !== await hash(actual)) fallo(400, 'La contraseña actual no es correcta');
      u.password_hash = await hash(nueva);
      guardar();
      return { ok: true };
    }

    // --- Tarjetas ---
    case 'GET tarjetas':
      return [...db.tarjetas].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((t) => saldoTarjeta(t.id));
    case 'GET tarjetas/:id':
      return saldoTarjeta(id) || fallo(404, 'Tarjeta no encontrada');
    case 'POST tarjetas': {
      soloAdmin(u);
      const t = { id: ++db.seq.tarjetas, nombre: texto(body.nombre, 'nombre'), limite: dinero(body.limite, 'límite'), saldo_inicial: dinero(body.saldo_inicial ?? 0, 'saldo inicial'), estado: 'activa' };
      if (t.saldo_inicial > t.limite) fallo(400, 'El saldo inicial no puede superar el límite');
      db.tarjetas.push(t);
      guardar();
      return saldoTarjeta(t.id);
    }
    case 'PATCH tarjetas/:id': {
      soloAdmin(u);
      const actual = saldoTarjeta(id) || fallo(404, 'Tarjeta no encontrada');
      const t = db.tarjetas.find((x) => x.id === id);
      const nuevo = {
        nombre: body.nombre !== undefined ? texto(body.nombre, 'nombre') : t.nombre,
        limite: body.limite !== undefined ? dinero(body.limite, 'límite') : t.limite,
        saldo_inicial: body.saldo_inicial !== undefined ? dinero(body.saldo_inicial, 'saldo inicial') : t.saldo_inicial,
        estado: body.estado !== undefined ? opcion(body.estado, 'estado', ['activa', 'bloqueada']) : t.estado,
      };
      if (nuevo.limite - nuevo.saldo_inicial < actual.confirmados) fallo(400, 'Con ese límite los gastos confirmados quedarían por encima del crédito');
      Object.assign(t, nuevo);
      guardar();
      return saldoTarjeta(id);
    }

    // --- Personas ---
    case 'GET personas':
      return [...db.personas].sort((a, b) => b.activo - a.activo || a.nombre.localeCompare(b.nombre));
    case 'POST personas': {
      soloAdmin(u);
      const nombre = texto(body.nombre, 'nombre', 60);
      if (db.personas.some((p) => igual(p.nombre, nombre))) fallo(409, 'Ya existe una persona con ese nombre');
      const p = { id: ++db.seq.personas, nombre, activo: 1 };
      db.personas.push(p);
      guardar();
      return p;
    }
    case 'PATCH personas/:id': {
      soloAdmin(u);
      const p = db.personas.find((x) => x.id === id) || fallo(404, 'Persona no encontrada');
      const nombre = body.nombre !== undefined ? texto(body.nombre, 'nombre', 60) : p.nombre;
      if (db.personas.some((x) => x.id !== id && igual(x.nombre, nombre))) fallo(409, 'Ya existe una persona con ese nombre');
      p.nombre = nombre;
      if (body.activo !== undefined) p.activo = body.activo ? 1 : 0;
      guardar();
      return p;
    }

    // --- Facturas ---
    case 'POST facturas/ocr': {
      const archivo = body.get('imagen');
      if (!archivo) fallo(400, 'Selecciona una imagen');
      const imagen = await comprimir(archivo);
      const clave = crypto.randomUUID().replace(/-/g, '');
      subidas.set(clave, imagen);
      try {
        const worker = await obtenerWorker();
        const { data } = await worker.recognize(imagen);
        const leido = data.text.trim();
        return { archivo: clave, texto: leido, ...extraerDatos(leido), ok: true };
      } catch {
        return { archivo: clave, texto: '', comercio: '', fecha: '', monto: null, ok: false };
      }
    }

    // --- Gastos ---
    case 'GET gastos': {
      let lista = gastosVisibles(u).map(gastoCompleto);
      if (q.get('persona_id')) lista = lista.filter((g) => g.persona_id === Number(q.get('persona_id')));
      if (q.get('estado')) lista = lista.filter((g) => g.estado === q.get('estado'));
      if (q.get('mes')) lista = lista.filter((g) => g.fecha_compra.startsWith(q.get('mes')));
      if (q.get('q')) {
        const busca = q.get('q').toLowerCase();
        lista = lista.filter((g) => g.comercio.toLowerCase().includes(busca) || (g.persona || '').toLowerCase().includes(busca));
      }
      return lista.sort(ordenGastos);
    }
    case 'GET gastos/:id': {
      const g = gastosVisibles(u).find((x) => x.id === id) || fallo(404, 'Gasto no encontrado');
      return gastoCompleto(g);
    }
    case 'POST gastos': {
      const tarjetaId = Number(body.tarjeta_id);
      const personaId = Number(body.persona_id);
      if (!personaId) fallo(400, 'El campo "persona" no es válido');
      const comercio = texto(body.comercio, 'comercio');
      const fechaCompra = fecha(body.fecha_compra, 'fecha de compra');
      const monto = dinero(body.monto, 'monto', true);
      const nota = typeof body.nota === 'string' && body.nota.trim() ? texto(body.nota, 'nota', 500) : null;
      if (body.archivo && !subidas.has(body.archivo)) fallo(400, 'La imagen de la factura no es válida, vuelve a subirla');

      const tarjeta = saldoTarjeta(tarjetaId) || fallo(404, 'Tarjeta no encontrada');
      if (tarjeta.estado !== 'activa') fallo(422, 'La tarjeta está bloqueada');
      if (!db.personas.some((p) => p.id === personaId && p.activo)) fallo(422, 'Selecciona una persona válida');
      if (monto > tarjeta.disponible) fallo(422, `El monto supera el disponible de la tarjeta ($${tarjeta.disponible.toFixed(2)})`);
      const duplicado = db.gastos.find((g) => g.tarjeta_id === tarjetaId && igual(g.comercio, comercio) && g.fecha_compra === fechaCompra && g.monto === monto && g.estado !== 'anulado');
      if (duplicado && !body.forzar) fallo(409, 'Ya existe un gasto igual (mismo comercio, fecha y monto)');

      const g = { id: db.seq.gastos + 1, usuario_id: u.id, tarjeta_id: tarjetaId, persona_id: personaId, comercio, fecha_compra: fechaCompra, monto, estado: 'confirmado', nota, creado_en: ahora() };
      if (body.archivo) {
        try {
          localStorage.setItem(CLAVE_IMG(g.id), subidas.get(body.archivo));
        } catch {
          fallo(507, 'El navegador no tiene espacio para guardar la imagen. Registra el gasto sin factura o reinicia la demostración.');
        }
        db.facturas.push({ id: g.id, gasto_id: g.id, texto_ocr: body.texto_ocr || null, fecha_subida: ahora() });
        subidas.delete(body.archivo);
      }
      db.seq.gastos = g.id;
      db.gastos.push(g);
      guardar();
      return { gasto: gastoCompleto(g), tarjeta: saldoTarjeta(tarjetaId) };
    }
    case 'PATCH gastos/:id/estado': {
      const nuevo = opcion(body.estado, 'estado', ['confirmado', 'anulado']);
      const g = gastosVisibles(u).find((x) => x.id === id) || fallo(404, 'Gasto no encontrado');
      if (g.estado === nuevo || g.estado === 'anulado') fallo(409, `El gasto ya está ${g.estado}`);
      if (nuevo === 'confirmado' && g.monto > saldoTarjeta(g.tarjeta_id).disponible) fallo(422, 'El monto supera el disponible de la tarjeta');
      g.estado = nuevo;
      guardar();
      return { gasto: gastoCompleto(g), tarjeta: saldoTarjeta(g.tarjeta_id) };
    }

    // --- Reportes ---
    case 'GET reportes/resumen': {
      const mes = q.get('mes') || new Date().toLocaleDateString('en-CA').slice(0, 7);
      const del = gastosVisibles(u).filter((g) => g.estado === 'confirmado' && g.fecha_compra.startsWith(mes));
      const agrupar = (clave) => {
        const grupos = new Map();
        del.forEach((g) => {
          const k = clave(g);
          const actual = grupos.get(k) || { cantidad: 0, total: 0 };
          grupos.set(k, { cantidad: actual.cantidad + 1, total: actual.total + g.monto });
        });
        return grupos;
      };
      const porPersona = agrupar((g) => g.persona_id);
      const porComercio = agrupar((g) => g.comercio.toLowerCase());
      return {
        mes,
        cantidad: del.length,
        total: redondear(del.reduce((s, g) => s + g.monto, 0)),
        por_persona: db.personas
          .filter((p) => p.activo || porPersona.has(p.id))
          .map((p) => ({ id: p.id, nombre: p.nombre, cantidad: porPersona.get(p.id)?.cantidad || 0, total: redondear(porPersona.get(p.id)?.total || 0) }))
          .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre)),
        por_comercio: [...porComercio.entries()]
          .map(([k, v]) => ({ comercio: del.find((g) => g.comercio.toLowerCase() === k).comercio, cantidad: v.cantidad, total: redondear(v.total) }))
          .sort((a, b) => b.total - a.total).slice(0, 5),
      };
    }

    // --- Usuarios ---
    case 'GET usuarios':
      soloAdmin(u);
      return db.usuarios.map(({ password_hash, ...x }) => x).sort((a, b) => a.nombre.localeCompare(b.nombre));
    case 'POST usuarios': {
      soloAdmin(u);
      const nuevo = { id: db.seq.usuarios + 1, nombre: texto(body.nombre, 'nombre'), correo: texto(body.correo, 'correo'), rol: opcion(body.rol, 'rol', ['admin', 'usuario']), activo: 1 };
      const password = texto(body.password, 'contraseña');
      if (password.length < 6) fallo(400, 'La contraseña debe tener al menos 6 caracteres');
      if (db.usuarios.some((x) => igual(x.correo, nuevo.correo))) fallo(409, 'Ya existe un usuario con ese correo');
      nuevo.password_hash = await hash(password);
      db.seq.usuarios = nuevo.id;
      db.usuarios.push(nuevo);
      guardar();
      return { id: nuevo.id };
    }
    case 'PATCH usuarios/:id': {
      soloAdmin(u);
      if (id === u.id) fallo(400, 'Para tu propio usuario usa "Mi cuenta"');
      const x = db.usuarios.find((y) => y.id === id) || fallo(404, 'Usuario no encontrado');
      if (body.password !== undefined) {
        const password = texto(body.password, 'contraseña');
        if (password.length < 6) fallo(400, 'La contraseña debe tener al menos 6 caracteres');
        x.password_hash = await hash(password);
      }
      if (body.activo !== undefined) x.activo = body.activo ? 1 : 0;
      if (body.rol !== undefined) x.rol = opcion(body.rol, 'rol', ['admin', 'usuario']);
      guardar();
      return { ok: true };
    }

    default:
      return fallo(404, 'Ruta no encontrada');
  }
}
