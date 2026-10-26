import { extraerDatos } from './extraer.js';
import { leerEnNavegador } from './ocr-navegador.js';

// Dónde está el API:
// - En GitHub Pages: el servidor publicado en Render (misma base de datos compartida).
// - En Live Server (puertos 5500+): el servidor local de Node en el puerto 3000.
// - Si la página la sirve el propio servidor de Node: el mismo origen.
const API_PRODUCCION = 'https://credidiper.onrender.com';
const API_BASE = location.hostname.endsWith('github.io') ? API_PRODUCCION
  : /^55\d\d$/.test(location.port) ? `${location.protocol}//${location.hostname}:3000`
    : '';

// Token de sesión: en localStorage si marcó "Recordarme", si no en sessionStorage (se borra al cerrar el navegador)
const CLAVE_TOKEN = 'credisiman-token';
const CLAVE_USUARIO = 'credisiman-usuario';
const sesionGuardada = {
  leer: () => { try { return localStorage.getItem(CLAVE_TOKEN) || sessionStorage.getItem(CLAVE_TOKEN); } catch { return null; } },
  guardar: (token, recordar) => {
    try { (recordar ? localStorage : sessionStorage).setItem(CLAVE_TOKEN, token); } catch { /* sin almacenamiento */ }
  },
  borrar: () => {
    try { for (const clave of [CLAVE_TOKEN, CLAVE_USUARIO]) { localStorage.removeItem(clave); sessionStorage.removeItem(clave); } } catch { /* nada */ }
  },
  // Datos del usuario de la última sesión: permiten abrir la app al instante sin esperar al servidor
  usuario: () => { try { return JSON.parse(localStorage.getItem(CLAVE_USUARIO) || sessionStorage.getItem(CLAVE_USUARIO)); } catch { return null; } },
  guardarUsuario: (usuario) => {
    try { (localStorage.getItem(CLAVE_TOKEN) ? localStorage : sessionStorage).setItem(CLAVE_USUARIO, JSON.stringify(usuario)); } catch { /* sin almacenamiento */ }
  },
};

// Colores por persona: orden fijo validado (contraste y daltonismo); el color sigue a la persona, no a su posición
const PALETA = ['#6250d6', '#eb6834', '#2a78d6', '#eda100', '#1baf7a', '#e87ba4', '#008300', '#e34948'];
const COLOR_OTROS = '#8a87a3';

const ICONOS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  list: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20M6 15h4"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  receipt: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  pencil: '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l3 3M15 8l2 2"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 17.9 9.5 4.5 4.5 0 0 1 17.5 18.5z"/>',
  factura: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 10.5v7M14.2 12h-3a1.3 1.3 0 0 0 0 2.6h1.6a1.3 1.3 0 0 1 0 2.6H9.8"/>',
  historial: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  scan: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3.2"/>',
  flash: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  guardar: '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
  escudo: '<path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  repetir: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"/>',
};
const ic = (nombre) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[nombre] || ''}</svg>`;

// ---------- Utilidades ----------
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dinero = (n) => '$' + Number(n || 0).toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n) => `${Number(n || 0).toLocaleString('es-SV', { maximumFractionDigits: 1 })}%`;
const fechaCorta = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
const fechaHora = (s) => (s ? `${fechaCorta(s)} ${s.slice(11, 16)}` : '—');
const hoy = () => new Date().toLocaleDateString('en-CA');
const nombreMes = (mes) => {
  const [a, m] = mes.split('-').map(Number);
  const texto = new Date(a, m - 1, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};
const iniciales = (nombre) => nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
// Contenido de data-tip: el navegador lo decodifica al leerlo y luego se inserta como HTML, por eso se escapa dos veces
const tip = (titulo, texto) => esc(`<b>${esc(titulo)}</b>${texto}`);
const datosForm = (form) => Object.fromEntries(new FormData(form));
// <img src> no puede mandar la cabecera Authorization, por eso el token va en la URL
const urlFactura = (gastoId, descargar) =>
  `${API_BASE}/api/facturas/${gastoId}/imagen?t=${encodeURIComponent(sesionGuardada.leer() || '')}${descargar ? '&descargar=1' : ''}`;

async function api(url, opciones = {}) {
  const esForm = opciones.body instanceof FormData;
  const token = sesionGuardada.leer();
  const headers = {};
  if (!esForm) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  // El plan gratis de Render duerme el servidor tras un rato sin uso; la primera petición tarda en despertarlo
  const aviso = setTimeout(() => {
    if ($('#vista-cargando').hidden) toast('Conectando con el servidor… la primera vez puede tardar hasta un minuto.', 60000);
  }, 4000);
  const res = await fetch(API_BASE + url, {
    ...opciones,
    headers,
    body: esForm ? opciones.body : opciones.body ? JSON.stringify(opciones.body) : undefined,
  }).then((respuesta) => {
    marcarConexion(true);
    return respuesta;
  }).catch(() => {
    marcarConexion(false);
    throw new Error(API_BASE === API_PRODUCCION
      ? 'No se pudo conectar con el servidor. Revisa tu internet e inténtalo de nuevo.'
      : 'No hay conexión con el servidor. Ejecuta "npm run dev" en la terminal.');
  }).finally(() => {
    clearTimeout(aviso);
    if ($('#toast').textContent.startsWith('Conectando')) $('#toast').hidden = true;
  });
  const datos = await res.json().catch(() => ({ error: 'Respuesta inválida del servidor' }));
  if (res.status === 401 && url !== '/api/auth/login') {
    sesionGuardada.borrar();
    mostrarLogin();
  }
  if (!res.ok) throw Object.assign(new Error(datos.error || 'Error inesperado'), { status: res.status, datos });
  return datos;
}

// Indicador de la barra lateral: punto verde si el servidor responde, rojo si no
function marcarConexion(ok) {
  const el = $('#estado-conexion');
  el.classList.toggle('sin-conexion', !ok);
  el.dataset.nombre = ok ? 'Conectado al servidor' : 'Sin conexión con el servidor';
  $('#estado-conexion-texto').textContent = ok ? 'Conectado' : 'Sin conexión';
}

let toastTimer;
function toast(mensaje, duracion = 3200) {
  const el = $('#toast');
  el.textContent = mensaje;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, duracion);
}

// Reduce la foto (máx. 1600 px, JPEG) para que suba rápido y ocupe poco en la base de datos
async function comprimirImagen(archivo) {
  try {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return blob && blob.size < archivo.size ? new File([blob], 'factura.jpg', { type: 'image/jpeg' }) : archivo;
  } catch {
    return archivo;
  }
}

// Ejecuta una acción mostrando el error en un elemento (o en un aviso) y bloqueando el botón mientras tanto
async function conError(destino, accion, boton) {
  if (destino) destino.textContent = '';
  if (boton) boton.disabled = true;
  try {
    return await accion();
  } catch (err) {
    if (destino) destino.textContent = err.message;
    else toast(err.message);
  } finally {
    if (boton) boton.disabled = false;
  }
}

function pintarIconos(raiz = document) {
  $$('i[data-icon]', raiz).forEach((i) => { i.outerHTML = ic(i.dataset.icon); });
}

// ---------- Estado ----------
const estado = {
  usuario: null,
  tarjeta: null,
  tarjetas: [],
  personas: [],
  mes: hoy().slice(0, 7),
  filtroPersona: '',
};
const esAdmin = () => estado.usuario?.rol === 'admin';

function colorPersona(id) {
  const orden = [...estado.personas].sort((a, b) => a.id - b.id).findIndex((p) => p.id === id);
  return orden >= 0 && orden < PALETA.length ? PALETA[orden] : COLOR_OTROS;
}
const avatarPersona = (id) => {
  const color = colorPersona(id);
  return `<span class="avatar-persona" style="background:${color}1f;color:${color}">${ic('user')}</span>`;
};
const pastillaPersona = (id, nombre) => {
  if (!nombre) return '<span class="pastilla pastilla-neutra">Sin asignar</span>';
  const color = colorPersona(id);
  return `<span class="pastilla" style="background:${color}1a;color:var(--tinta)"><span class="punto" style="background:${color}"></span>${esc(nombre)}</span>`;
};

async function cargarBase() {
  const [tarjetas, personas] = await Promise.all([api('/api/tarjetas'), api('/api/personas')]);
  estado.tarjetas = tarjetas;
  estado.tarjeta = tarjetas.find((t) => t.estado === 'activa') || tarjetas[0] || null;
  estado.personas = personas;
}

// ---------- Sesión ----------
function mostrarLogin() {
  estado.usuario = null;
  $('#vista-cargando').hidden = true;
  $('#vista-app').hidden = true;
  $('#vista-login').hidden = false;
}

async function iniciarApp() {
  if (!sesionGuardada.leer()) return mostrarLogin();
  // Si ya hubo sesión en este navegador, la app se abre al instante y la sesión se comprueba por detrás
  const guardado = sesionGuardada.usuario();
  if (guardado) {
    mostrarApp(guardado);
    api('/api/auth/me').then((usuario) => {
      sesionGuardada.guardarUsuario(usuario);
      if (usuario.nombre !== guardado.nombre || usuario.rol !== guardado.rol) mostrarApp(usuario);
    }).catch(() => {}); // un 401 ya lleva al login dentro de api()
    return;
  }
  // Primera vez: pantalla de carga mientras se comprueba la sesión (si el servidor dormía, tarda)
  $('#vista-cargando').hidden = false;
  const aviso = setTimeout(() => {
    $('#cargando-texto').textContent = 'Conectando con el servidor… Si estuvo un rato sin uso, puede tardar hasta un minuto en despertar.';
  }, 3000);
  try {
    const usuario = await api('/api/auth/me');
    sesionGuardada.guardarUsuario(usuario);
    mostrarApp(usuario);
  } catch (err) {
    // Sin conexión no se borra la sesión: solo se muestra el login con el aviso
    mostrarLogin();
    if (err.status !== 401) $('#login-error').textContent = err.message;
  } finally {
    clearTimeout(aviso);
  }
}

function mostrarApp(usuario) {
  estado.usuario = usuario;
  $('#vista-cargando').hidden = true;
  $('#vista-login').hidden = true;
  $('#vista-app').hidden = false;
  $('#perfil-avatar').textContent = iniciales(usuario.nombre);
  $('#perfil-nombre').textContent = usuario.nombre;
  $('#perfil-rol').textContent = esAdmin() ? 'Administrador' : 'Usuario';
  $$('[data-admin]').forEach((el) => { el.hidden = !esAdmin(); });
  llenarSelectoresMes();
  navegar();
}

$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const datos = datosForm(form);
  if (!datos.correo || !datos.password) {
    $('#login-error').textContent = 'Escribe tu correo y contraseña';
    return;
  }
  await conError($('#login-error'), async () => {
    const { token } = await api('/api/auth/login', { method: 'POST', body: { ...datos, recordar: form.recordar.checked } });
    sesionGuardada.borrar();
    sesionGuardada.guardar(token, form.recordar.checked);
    form.password.value = '';
    await iniciarApp();
  }, form.querySelector('[type=submit]'));
});

$('#btn-ver-password').addEventListener('click', (e) => {
  const input = $('#form-login [name=password]');
  input.type = input.type === 'password' ? 'text' : 'password';
  e.currentTarget.setAttribute('aria-label', input.type === 'password' ? 'Mostrar contraseña' : 'Ocultar contraseña');
});

$('#link-olvido').addEventListener('click', (e) => {
  e.preventDefault();
  $('#login-info').hidden = false;
});

$('#btn-salir').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  sesionGuardada.borrar();
  location.hash = '';
  mostrarLogin();
});

// Barra lateral contraída o expandida; se recuerda la elección en este navegador
const CLAVE_MENU = 'credisiman-menu-expandido';
function expandirMenu(expandido) {
  $('#lateral').classList.toggle('expandida', expandido);
  const boton = $('#btn-expandir');
  boton.setAttribute('aria-expanded', String(expandido));
  boton.setAttribute('aria-label', expandido ? 'Contraer menú' : 'Expandir menú');
}
// En el celular siempre arranca contraída para no tapar la pantalla
try { expandirMenu(localStorage.getItem(CLAVE_MENU) === '1' && !matchMedia('(max-width: 860px)').matches); } catch { /* sin almacenamiento */ }
$('#btn-expandir').addEventListener('click', () => {
  const expandido = !$('#lateral').classList.contains('expandida');
  expandirMenu(expandido);
  try { localStorage.setItem(CLAVE_MENU, expandido ? '1' : '0'); } catch { /* sin almacenamiento */ }
  latTip.hidden = true;
});

// Con la barra contraída, el nombre de cada opción aparece al pasar el mouse
const latTip = Object.assign(document.createElement('div'), { className: 'lat-tip', hidden: true });
document.body.append(latTip);
$('#lateral').addEventListener('mouseover', (e) => {
  const item = e.target.closest('[data-nombre]');
  if (!item || $('#lateral').classList.contains('expandida')) { latTip.hidden = true; return; }
  const caja = item.getBoundingClientRect();
  latTip.textContent = item.dataset.nombre;
  latTip.style.left = `${$('#lateral').getBoundingClientRect().right + 12}px`;
  latTip.style.top = `${caja.top + caja.height / 2}px`;
  latTip.hidden = false;
});
$('#lateral').addEventListener('mouseleave', () => { latTip.hidden = true; });

// En el celular la barra expandida tapa el contenido: se cierra al elegir una opción o al tocar fuera
const esCelular = () => matchMedia('(max-width: 860px)').matches;
$('#menu').addEventListener('click', (e) => {
  if (esCelular() && e.target.closest('a')) expandirMenu(false);
});
document.addEventListener('click', (e) => {
  if (esCelular() && $('#lateral').classList.contains('expandida') && !e.target.closest('#lateral')) expandirMenu(false);
});

// ---------- Navegación (#vista o #gasto/12) ----------
const vistas = {
  inicio: cargarInicio,
  registrar: abrirRegistro,
  gastos: cargarGastos,
  gasto: cargarDetalle,
  personas: cargarPersonas,
  persona: cargarPersona,
  reportes: cargarReportes,
  configuracion: cargarConfiguracion,
};
// Vistas de detalle: qué opción del menú queda marcada
const MENU_DE = { gasto: 'gastos', persona: 'personas' };

function navegar() {
  if (!estado.usuario) return;
  const [nombre, param] = location.hash.slice(1).split('/');
  const vista = vistas[nombre] ? nombre : 'inicio';
  if (!$('#escaner').hidden) cerrarEscaner();
  const seccion = vista === 'gasto' ? 'detalle' : vista;
  $$('.principal > section').forEach((s) => { s.hidden = s.dataset.vista !== seccion; });
  $$('#menu a').forEach((a) => a.classList.toggle('activo', a.dataset.vista === (MENU_DE[vista] || vista)));
  window.scrollTo(0, 0);
  conError(null, () => vistas[vista](param));
}
window.addEventListener('hashchange', navegar);

// Selector de mes compartido por Inicio, Mis gastos, Personas y Reportes
function llenarSelectoresMes() {
  const meses = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    meses.push(new Date(d.getFullYear(), d.getMonth() - i, 1).toLocaleDateString('en-CA').slice(0, 7));
  }
  if (!meses.includes(estado.mes)) meses.unshift(estado.mes);
  $$('.sel-mes').forEach((sel) => {
    sel.innerHTML = meses.map((m) => `<option value="${m}">${nombreMes(m)}</option>`).join('');
    sel.value = estado.mes;
  });
}
$$('.sel-mes').forEach((sel) => sel.addEventListener('change', () => {
  estado.mes = sel.value;
  $$('.sel-mes').forEach((s) => { s.value = estado.mes; });
  navegar();
}));

// ---------- Inicio ----------
async function cargarInicio() {
  await cargarBase();
  const t = estado.tarjeta;
  $('#inicio-contenido').hidden = !t;
  $('#inicio-sin-tarjeta').hidden = !!t;
  if (!t) {
    $('#inicio-sin-tarjeta').innerHTML = `${ic('card')}<h2>Todavía no hay una tarjeta configurada</h2>` +
      (esAdmin() ? '<a class="btn btn-primario" href="#configuracion">Configurar tarjeta</a>' : '<p>Pide a la persona administradora que la configure.</p>');
    return;
  }
  const gastado = t.limite - t.disponible;
  const usado = t.limite > 0 ? (gastado / t.limite) * 100 : 0;
  $('#res-limite').textContent = dinero(t.limite);
  $('#res-gastado').textContent = dinero(gastado);
  $('#res-gastado-pct').textContent = `${pct(usado)} del límite`;
  $('#res-disponible').textContent = dinero(t.disponible);
  $('#res-disponible-pct').textContent = `${pct(100 - usado)} restante`;
  $('#res-barra').style.width = `${Math.min(100, Math.max(0, usado))}%`;
  $('#res-barra').parentElement.classList.toggle('alto', usado > 85);
  $('#res-barra').parentElement.setAttribute('aria-valuenow', Math.round(usado));

  pintarDeudas($('#inicio-personas'), $('#inicio-total-deben'));
}

// Tarjetas con lo que debe cada persona (se usan en Inicio y en Personas)
function pintarDeudas(contenedor, totalEl) {
  const visibles = estado.personas.filter((p) => p.activo || p.saldo > 0);
  const total = visibles.reduce((s, p) => s + Math.max(0, p.saldo), 0);
  if (totalEl) totalEl.textContent = totalEl.id === 'total-deben' ? dinero(total) : `· Total ${dinero(total)}`;
  contenedor.innerHTML = visibles.length ? visibles
    .sort((a, b) => b.saldo - a.saldo || a.nombre.localeCompare(b.nombre))
    .map((p) => `
      <a class="panel deuda-card ${p.activo ? '' : 'inactiva'}" href="#persona/${p.id}">
        <div class="arriba">
          ${avatarPersona(p.id)}
          <div>
            <p class="nombre">${esc(p.nombre)}</p>
            <small>${p.saldo > 0 ? 'Te debe' : p.saldo < 0 ? 'Saldo a su favor' : 'Al día'}</small>
          </div>
        </div>
        <p class="cifra ${p.saldo <= 0 ? 'al-dia' : ''}">${dinero(Math.abs(p.saldo))}</p>
        <div class="detalle"><span>Gastó ${dinero(p.gastado)}</span><span>Depositó ${dinero(p.pagado)}</span></div>
      </a>`).join('')
    : '<div class="panel vacio-grande">Aún no hay personas. Agrégalas en <a href="#personas">Personas</a> para llevar la cuenta de lo que te deben.</div>';
}

// ---------- Registrar gasto (asistente de 3 pasos) ----------
const registro = { paso: 1, archivo: null, vistaPrevia: null, texto: '', ocrOk: false, leido: null, datos: {} };

function irPaso(n) {
  registro.paso = n;
  $$('.registro .paso').forEach((p) => { p.hidden = Number(p.dataset.paso) !== n; });
  $('#pasos').hidden = n === 4;
  $$('#pasos li').forEach((li) => {
    const num = Number(li.dataset.paso);
    li.classList.toggle('activo', num === n);
    li.classList.toggle('hecho', num < n);
    $('.paso-num', li).innerHTML = num < n ? ic('check') : num;
  });
}

function marcoImagen(src, conZoom) {
  if (!src) return `<div class="sin-imagen">${ic('receipt')}<span>Gasto sin factura</span></div>`;
  return `<img src="${esc(src)}" alt="Factura" data-zoom="${esc(src)}">` +
    (conZoom ? `<button type="button" class="btn-icono btn-zoom" data-zoom="${esc(src)}" aria-label="Ampliar">${ic('zoom')}</button>` : '');
}

function reiniciarRegistro() {
  if (registro.vistaPrevia) URL.revokeObjectURL(registro.vistaPrevia);
  Object.assign(registro, { paso: 1, archivo: null, vistaPrevia: null, texto: '', ocrOk: false, leido: null, datos: {} });
  $('#form-datos').reset();
  $('#form-confirmar').reset();
  $('#conf-persona').value = '';
  $('#input-factura').value = '';
  $('#zona-contenido').hidden = false;
  $('#zona-cargando').hidden = true;
  ['#subida-error', '#datos-error', '#confirmar-error'].forEach((s) => { $(s).textContent = ''; });
  irPaso(1);
}

async function abrirRegistro() {
  reiniciarRegistro();
  await cargarBase();
  if (!estado.tarjeta || estado.tarjeta.estado !== 'activa') {
    $('#subida-error').textContent = estado.tarjeta ? 'La tarjeta está bloqueada.' : 'Primero hay que configurar la tarjeta en Configuración.';
  }
}

function errorImagen(archivo) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) return 'Formato no admitido. Usa JPG, PNG o WEBP.';
  if (archivo.size > 8 * 1024 * 1024) return 'La imagen pesa más de 8 MB.';
  return '';
}

// Comercios ya registrados (para corregir el nombre leído); se piden una vez por sesión
let comerciosConocidos = null;
const obtenerComercios = async () => {
  comerciosConocidos ??= await api('/api/facturas/comercios').catch(() => []);
  return comerciosConocidos;
};

// Lee la factura (en el teléfono; si no se puede, en el servidor), guarda la foto y llena el formulario del paso 2.
// progreso(texto, porcentaje) informa el avance de la lectura.
async function leerImagenFactura(archivo, progreso) {
  let r;
  let foto = archivo;
  try {
    const [leida, conocidos] = await Promise.all([leerEnNavegador(archivo, progreso), obtenerComercios()]);
    foto = new File([leida.foto], 'factura.jpg', { type: 'image/jpeg' });
    progreso?.('Guardando la foto…', 100);
    const fd = new FormData();
    fd.append('imagen', foto);
    fd.append('texto', leida.texto);
    const { archivo: guardado } = await api('/api/facturas/ocr', { method: 'POST', body: fd });
    const datos = extraerDatos(leida.texto, { lineas: leida.lineas, conocidos });
    r = { archivo: guardado, texto: leida.texto, ok: Boolean(leida.texto), ...datos };
  } catch (err) {
    if (err.status) throw err; // error del servidor al guardar: no tiene sentido reintentar
    console.warn('Lectura en el navegador no disponible, se usa el servidor:', err);
    progreso?.('Leyendo la factura en el servidor…', null);
    const fd = new FormData();
    fd.append('imagen', await comprimirImagen(archivo));
    r = await api('/api/facturas/ocr', { method: 'POST', body: fd });
  }
  if (registro.vistaPrevia) URL.revokeObjectURL(registro.vistaPrevia);
  Object.assign(registro, { archivo: r.archivo, vistaPrevia: URL.createObjectURL(foto), texto: r.texto, ocrOk: r.ok, leido: r });
  const form = $('#form-datos');
  form.comercio.value = r.comercio || '';
  form.fecha_compra.value = r.fecha || '';
  form.monto.value = r.monto ?? '';
  return r;
}

async function procesarArchivo(archivo) {
  $('#subida-error').textContent = '';
  if (!archivo) return;
  const error = errorImagen(archivo);
  if (error) {
    $('#subida-error').textContent = error;
    return;
  }
  $('#zona-contenido').hidden = true;
  $('#zona-cargando').hidden = false;
  try {
    await leerImagenFactura(archivo, (texto, porcentaje) => {
      $('#zona-cargando strong').textContent = porcentaje != null ? `${texto} ${porcentaje}%` : texto;
    });
    mostrarPaso2();
  } catch (err) {
    $('#subida-error').textContent = err.message;
  } finally {
    $('#zona-contenido').hidden = false;
    $('#zona-cargando').hidden = true;
    $('#input-factura').value = '';
  }
}

// Ticket con lo reconocido: productos, subtotal, impuesto y el total (que sigue lo que se escriba en el formulario)
function pintarTicket() {
  const form = $('#form-datos');
  const leido = registro.leido || {};
  const items = leido.items || [];
  $('#ticket-comercio').textContent = form.comercio.value.trim() || 'Comercio';
  $('#ticket-fecha').textContent = form.fecha_compra.value ? fechaCorta(form.fecha_compra.value) : 'Sin fecha';
  $('#ticket-items').innerHTML = items.length
    ? items.map((it) => `<li><span class="cant">${it.cantidad}x</span><span>${esc(it.descripcion)}</span><span class="precio">${dinero(it.precio)}</span></li>`).join('')
    : `<li class="vacio-items">${registro.archivo ? 'No se detectaron productos en la foto' : 'Gasto sin factura'}</li>`;
  $('#ticket-totales').innerHTML =
    (leido.subtotal ? `<dt>Subtotal</dt><dd>${dinero(leido.subtotal)}</dd>` : '') +
    (leido.impuesto ? `<dt class="impuesto">Impuesto</dt><dd class="impuesto">${dinero(leido.impuesto)}</dd>` : '') +
    `<dt class="total">Total</dt><dd class="total">${form.monto.value ? dinero(form.monto.value) : '—'}</dd>`;
}
$('#form-datos').addEventListener('input', pintarTicket);

function mostrarPaso2() {
  $('#paso2-imagen').innerHTML = registro.vistaPrevia ? `<div class="marco-factura">${marcoImagen(registro.vistaPrevia, true)}</div>` : '';
  $('#btn-cambiar-imagen').innerHTML = `${ic('image')} ${registro.archivo ? 'Cambiar imagen' : 'Subir factura'}`;
  const form = $('#form-datos');
  const aviso = $('#aviso-ocr');
  if (!registro.archivo) {
    aviso.hidden = true;
    if (!form.fecha_compra.value) form.fecha_compra.value = hoy();
  } else {
    const completo = registro.ocrOk && form.comercio.value && form.fecha_compra.value && form.monto.value;
    aviso.hidden = false;
    aviso.className = `aviso ${completo ? 'aviso-ok' : 'aviso-alerta'}`;
    aviso.innerHTML = completo
      ? `${ic('check')}<div><b>Información leída automáticamente</b><br>Revisa que los datos sean correctos. Puedes editarlos si es necesario.</div>`
      : `${ic('alert')}<div><b>No se pudo leer toda la información</b><br>Completa o corrige los campos vacíos mirando la factura.</div>`;
  }
  pintarTicket();
  irPaso(2);
}

const zona = $('#zona-subida');
$('#input-factura').addEventListener('change', (e) => procesarArchivo(e.target.files[0]));
zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('arrastrando'); });
zona.addEventListener('dragleave', () => zona.classList.remove('arrastrando'));
zona.addEventListener('drop', (e) => {
  e.preventDefault();
  zona.classList.remove('arrastrando');
  procesarArchivo(e.dataTransfer.files[0]);
});
$('#btn-sin-factura').addEventListener('click', () => {
  Object.assign(registro, { archivo: null, vistaPrevia: null, texto: '', leido: null });
  mostrarPaso2();
});
$('#btn-cambiar-imagen').addEventListener('click', () => irPaso(1));

// Persona del gasto: avatares para elegir (y "+" para que la administración agregue una al momento)
function pintarPersonasElegibles() {
  const activas = estado.personas.filter((p) => p.activo);
  const elegida = $('#conf-persona').value;
  $('#elegir-persona').innerHTML = activas.map((p) => `
    <button type="button" class="persona-opcion" role="radio" aria-checked="${String(p.id) === elegida}" data-persona="${p.id}">
      ${avatarPersona(p.id)}<span class="nombre-op">${esc(p.nombre)}</span>
    </button>`).join('') +
    (esAdmin() ? `<button type="button" class="persona-opcion persona-agregar" id="btn-agregar-persona">
      <span class="avatar-persona">${ic('plus')}</span><span class="nombre-op">Agregar</span></button>` : '');
  $('#confirmar-error').innerHTML = activas.length || esAdmin() ? ''
    : 'No hay personas registradas. Pide a la persona administradora que agregue una.';
}

$('#elegir-persona').addEventListener('click', async (e) => {
  const opcion = e.target.closest('[data-persona]');
  if (opcion) {
    $('#conf-persona').value = opcion.dataset.persona;
    $$('#elegir-persona [data-persona]').forEach((b) => b.setAttribute('aria-checked', String(b === opcion)));
    $('#confirmar-error').textContent = '';
    return;
  }
  if (e.target.closest('#btn-agregar-persona')) {
    const nombre = prompt('Nombre de la persona (por ejemplo: Mamá):');
    if (!nombre?.trim()) return;
    await conError($('#confirmar-error'), async () => {
      const nueva = await api('/api/personas', { method: 'POST', body: { nombre } });
      await cargarBase();
      $('#conf-persona').value = nueva.id;
      pintarPersonasElegibles();
    });
  }
});

$('#form-datos').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const d = datosForm(form);
  const error = !d.comercio.trim() ? 'Escribe el nombre del comercio'
    : !d.fecha_compra ? 'Indica la fecha de la compra'
      : !(Number(d.monto) > 0) ? 'El monto debe ser mayor a 0' : '';
  $('#datos-error').textContent = error;
  if (error) return;
  registro.datos = { comercio: d.comercio.trim(), fecha_compra: d.fecha_compra, monto: Number(d.monto) };

  $('#conf-comercio').textContent = registro.datos.comercio;
  $('#conf-fecha').textContent = fechaCorta(registro.datos.fecha_compra);
  $('#conf-monto').textContent = dinero(registro.datos.monto);
  pintarPersonasElegibles();
  $('#paso3-imagen').innerHTML = marcoImagen(registro.vistaPrevia, true);
  irPaso(3);
});

$('#btn-anterior').addEventListener('click', () => irPaso(2));

$('#form-confirmar').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const d = datosForm(form);
  if (!d.persona_id) {
    $('#confirmar-error').textContent = 'Elige de quién es el gasto';
    return;
  }
  const cuerpo = {
    ...registro.datos,
    tarjeta_id: estado.tarjeta?.id,
    persona_id: Number(d.persona_id),
    nota: d.nota,
    archivo: registro.archivo,
    texto_ocr: registro.texto,
  };
  await conError($('#confirmar-error'), async () => {
    let r;
    try {
      r = await api('/api/gastos', { method: 'POST', body: cuerpo });
    } catch (err) {
      if (err.status !== 409) throw err;
      if (!confirm(`${err.message}. ¿Registrarlo de todas formas?`)) return;
      r = await api('/api/gastos', { method: 'POST', body: { ...cuerpo, forzar: true } });
    }
    comerciosConocidos = null; // el comercio recién guardado ya cuenta para la próxima lectura
    $('#exito-monto').textContent = dinero(r.gasto.monto);
    $('#exito-saldo').textContent = dinero(r.tarjeta.disponible);
    irPaso(4);
  }, form.querySelector('[type=submit]'));
});

$('#btn-otro-gasto').addEventListener('click', abrirRegistro);

// ---------- Escáner de facturas con la cámara ----------
const escaner = { stream: null, track: null, linterna: false, foto: null, modo: 'apuntando', auto: false, timerAuto: null };
const CLAVE_AUTO = 'credisiman-escaner-auto';
const TEXTO_APUNTAR = () => (escaner.auto ? 'Mantén la factura quieta en el marco' : 'Apunta a la factura');

function modoEscaner(modo, texto) {
  escaner.modo = modo;
  const el = $('#escaner');
  el.classList.toggle('leyendo', modo === 'leyendo');
  el.classList.toggle('listo', modo === 'listo');
  $('#esc-estado').textContent = texto;
  $('#escaner-foto').hidden = modo === 'apuntando';
  $('#esc-resultado').hidden = modo !== 'listo';
  $('#esc-disparo').setAttribute('aria-label', modo === 'listo' ? 'Tomar otra foto' : 'Tomar foto');
  vigilarAuto();
}

function soltarFoto() {
  if (escaner.foto) URL.revokeObjectURL(escaner.foto);
  escaner.foto = null;
}

async function abrirEscaner() {
  // Sin acceso a la cámara desde el navegador: se usa la cámara del teléfono a través del selector de archivos
  if (!navigator.mediaDevices?.getUserMedia) {
    $('#input-camara').click();
    return;
  }
  try {
    escaner.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
  } catch (err) {
    toast(err.name === 'NotAllowedError'
      ? 'No diste permiso para usar la cámara. Puedes subir la foto desde la galería.'
      : 'No se encontró una cámara. Puedes subir la foto desde la galería.', 5000);
    $('#input-camara').click();
    return;
  }
  escaner.track = escaner.stream.getVideoTracks()[0];
  escaner.linterna = false;
  const video = $('#escaner-video');
  video.srcObject = escaner.stream;
  video.play().catch(() => {});
  const linterna = $('#esc-linterna');
  linterna.classList.remove('activo');
  linterna.classList.toggle('no-disponible', !escaner.track.getCapabilities?.().torch);
  try { escaner.auto = localStorage.getItem(CLAVE_AUTO) === '1'; } catch { escaner.auto = false; }
  $('#esc-auto').setAttribute('aria-pressed', String(escaner.auto));
  $('#escaner').hidden = false;
  modoEscaner('apuntando', TEXTO_APUNTAR());
}

function cerrarEscaner() {
  clearInterval(escaner.timerAuto);
  escaner.stream?.getTracks().forEach((t) => t.stop());
  Object.assign(escaner, { stream: null, track: null, timerAuto: null });
  $('#escaner-video').srcObject = null;
  $('#escaner').classList.remove('auto-esperando');
  soltarFoto();
  $('#escaner').hidden = true;
}

async function leerDesdeEscaner(archivo, deGaleria = false) {
  const error = errorImagen(archivo);
  if (error) {
    toast(error);
    return;
  }
  soltarFoto();
  escaner.foto = URL.createObjectURL(archivo);
  const img = $('#escaner-foto');
  img.src = escaner.foto;
  img.classList.toggle('de-galeria', deGaleria);
  modoEscaner('leyendo', 'Escaneando factura…');
  try {
    const r = await leerImagenFactura(archivo, (texto, porcentaje) => {
      $('#esc-estado').textContent = porcentaje != null ? `${texto} ${porcentaje}%` : texto;
    });
    // La foto se guarda ya derecha: se muestra así en el escáner
    if (registro.vistaPrevia) {
      $('#escaner-foto').src = registro.vistaPrevia;
      $('#escaner-foto').classList.add('de-galeria');
    }
    $('#esc-res-comercio').textContent = r.comercio || 'Comercio no detectado';
    const productos = r.items?.length || 0;
    $('#esc-res-detalle').textContent = productos ? `${productos} ${productos === 1 ? 'producto detectado' : 'productos detectados'}` : 'Revisa los datos en el siguiente paso';
    $('#esc-res-total').textContent = r.monto ? dinero(r.monto) : '$ —';
    $('#esc-res-fecha').textContent = r.fecha ? fechaCorta(r.fecha) : '';
    $('#esc-res-impuesto').textContent = r.impuesto ? `${dinero(r.impuesto)} imp.` : '';
    modoEscaner('listo', r.ok && r.monto ? 'Factura leída' : 'Revisa los datos');
  } catch (err) {
    toast(err.message, 5000);
    modoEscaner('apuntando', TEXTO_APUNTAR());
  }
}

function capturarFoto() {
  const video = $('#escaner-video');
  if (!video.videoWidth) return;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  canvas.toBlob((blob) => {
    if (blob) leerDesdeEscaner(new File([blob], 'factura.jpg', { type: 'image/jpeg' }));
  }, 'image/jpeg', 0.92);
}

function volverAApuntar() {
  soltarFoto();
  modoEscaner('apuntando', TEXTO_APUNTAR());
}

// Modo Auto: cada 300 ms compara una miniatura de la imagen con la anterior; si casi no cambió durante
// ~1.5 s (la factura está quieta) y la imagen tiene contenido (no es una pared lisa), toma la foto sola.
function vigilarAuto() {
  clearInterval(escaner.timerAuto);
  escaner.timerAuto = null;
  const activo = escaner.auto && escaner.modo === 'apuntando' && escaner.stream;
  $('#escaner').classList.toggle('auto-esperando', Boolean(activo));
  if (!activo) return;
  const lado = 40;
  const lienzo = Object.assign(document.createElement('canvas'), { width: lado, height: lado });
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  let anterior = null;
  let quietos = 0;
  escaner.timerAuto = setInterval(() => {
    const video = $('#escaner-video');
    if (!video.videoWidth) return;
    ctx.drawImage(video, 0, 0, lado, lado);
    const { data } = ctx.getImageData(0, 0, lado, lado);
    const gris = new Float32Array(lado * lado);
    let suma = 0;
    for (let i = 0; i < gris.length; i++) {
      gris[i] = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
      suma += gris[i];
    }
    const media = suma / gris.length;
    let varianza = 0;
    let cambio = 0;
    for (let i = 0; i < gris.length; i++) {
      varianza += (gris[i] - media) ** 2;
      if (anterior) cambio += Math.abs(gris[i] - anterior[i]);
    }
    varianza /= gris.length;
    cambio = anterior ? cambio / gris.length : Infinity;
    anterior = gris;
    quietos = cambio < 4 && varianza > 150 ? quietos + 1 : 0;
    if (quietos >= 5) {
      clearInterval(escaner.timerAuto);
      escaner.timerAuto = null;
      capturarFoto();
    }
  }, 300);
}

$('#btn-tomar-foto').addEventListener('click', abrirEscaner);
$('#input-camara').addEventListener('change', (e) => {
  procesarArchivo(e.target.files[0]);
  e.target.value = '';
});
$('#esc-cerrar').addEventListener('click', cerrarEscaner);
// Con un resultado en pantalla, el disparador vuelve a la cámara para tomar otra foto
$('#esc-disparo').addEventListener('click', () => (escaner.modo === 'listo' ? volverAApuntar() : capturarFoto()));
$('#esc-galeria').addEventListener('click', () => $('#esc-input-galeria').click());
$('#esc-input-galeria').addEventListener('change', (e) => {
  if (e.target.files[0]) leerDesdeEscaner(e.target.files[0], true);
  e.target.value = '';
});
$('#esc-auto').addEventListener('click', () => {
  escaner.auto = !escaner.auto;
  $('#esc-auto').setAttribute('aria-pressed', String(escaner.auto));
  try { localStorage.setItem(CLAVE_AUTO, escaner.auto ? '1' : '0'); } catch { /* sin almacenamiento */ }
  if (escaner.modo === 'apuntando') modoEscaner('apuntando', TEXTO_APUNTAR());
  toast(escaner.auto ? 'Auto: la foto se toma sola cuando la factura esté quieta' : 'Auto desactivado: usa el botón para tomar la foto');
});
$('#esc-continuar').addEventListener('click', () => {
  cerrarEscaner();
  mostrarPaso2();
});
$('#esc-linterna').addEventListener('click', async () => {
  if ($('#esc-linterna').classList.contains('no-disponible')) {
    toast('Este dispositivo no permite encender la linterna desde el navegador');
    return;
  }
  try {
    await escaner.track.applyConstraints({ advanced: [{ torch: !escaner.linterna }] });
    escaner.linterna = !escaner.linterna;
    $('#esc-linterna').classList.toggle('activo', escaner.linterna);
  } catch {
    toast('No se pudo encender la linterna');
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#escaner').hidden) cerrarEscaner();
});

// ---------- Mis gastos ----------
let buscarTimer;
$('#buscar-gastos').addEventListener('input', () => {
  clearTimeout(buscarTimer);
  buscarTimer = setTimeout(() => conError(null, cargarTablaGastos), 250);
});

async function cargarGastos() {
  await cargarBase();
  const chips = [{ id: '', nombre: 'Todos' }, ...estado.personas.filter((p) => p.activo)];
  if (!chips.some((c) => String(c.id) === estado.filtroPersona)) estado.filtroPersona = '';
  $('#chips-personas').innerHTML = chips.map((c) => `
    <button class="chip ${String(c.id) === estado.filtroPersona ? 'activo' : ''}" data-persona="${c.id}">
      ${c.id ? `<span class="punto" style="background:${colorPersona(c.id)}"></span>` : ''}${esc(c.nombre)}
    </button>`).join('');
  await cargarTablaGastos();
}

async function cargarTablaGastos() {
  const params = new URLSearchParams({ mes: estado.mes });
  if (estado.filtroPersona) params.set('persona_id', estado.filtroPersona);
  const q = $('#buscar-gastos').value.trim();
  if (q) params.set('q', q);
  const gastos = await api(`/api/gastos?${params}`);
  $('#tabla-gastos').innerHTML = gastos.length ? gastos.map((g) => `
    <tr class="${g.estado === 'anulado' ? 'anulado' : ''}">
      <td>${fechaCorta(g.fecha_compra)}</td>
      <td><span class="comercio">${esc(g.comercio)}</span>
        ${g.estado === 'anulado' ? '<span class="pastilla estado-mal">Anulado</span>' : g.estado === 'pendiente' ? '<span class="pastilla estado-pendiente">Pendiente</span>' : ''}</td>
      <td class="num">${dinero(g.monto)}</td>
      <td>${pastillaPersona(g.persona_id, g.persona)}</td>
      <td>${g.tiene_factura ? `<img class="miniatura" src="${urlFactura(g.id)}" alt="Factura" loading="lazy" data-zoom="${urlFactura(g.id)}">` : '<small>—</small>'}</td>
      <td><div class="acciones-celda">
        <a class="btn-icono" href="#gasto/${g.id}" title="Ver detalle" aria-label="Ver detalle">${ic('eye')}</a>
        ${g.estado !== 'anulado' ? `<button class="btn-icono" data-anular="${g.id}" title="Anular gasto" aria-label="Anular gasto">${ic('ban')}</button>` : ''}
      </div></td>
    </tr>`).join('')
    : `<tr><td colspan="6" class="vacio">No hay gastos en ${nombreMes(estado.mes)}${q ? ' con esa búsqueda' : ''}</td></tr>`;
}

$('#chips-personas').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-persona]');
  if (!chip) return;
  estado.filtroPersona = chip.dataset.persona;
  $$('#chips-personas .chip').forEach((c) => c.classList.toggle('activo', c === chip));
  conError(null, cargarTablaGastos);
});

async function anularGasto(id) {
  if (!confirm('¿Anular este gasto? Su monto se devolverá al disponible de la tarjeta.')) return false;
  await api(`/api/gastos/${id}/estado`, { method: 'PATCH', body: { estado: 'anulado' } });
  toast('Gasto anulado');
  return true;
}

$('#tabla-gastos').addEventListener('click', async (e) => {
  const boton = e.target.closest('[data-anular]');
  if (boton) await conError(null, async () => { if (await anularGasto(boton.dataset.anular)) await cargarTablaGastos(); });
});

// ---------- Detalle del gasto ----------
async function cargarDetalle(id) {
  await cargarBase();
  const g = await api(`/api/gastos/${encodeURIComponent(id)}`);
  $('#detalle-imagen').innerHTML = marcoImagen(g.tiene_factura ? urlFactura(g.id) : null, true);
  const descargar = $('#detalle-descargar');
  descargar.hidden = !g.tiene_factura;
  descargar.href = urlFactura(g.id, true);
  descargar.download = `factura-${g.id}.jpg`;
  const estadoTxt = { confirmado: ['estado-ok', 'Confirmado'], pendiente: ['estado-pendiente', 'Pendiente'], anulado: ['estado-mal', 'Anulado'] }[g.estado];
  $('#detalle-datos').innerHTML = `
    <dt>Comercio</dt><dd>${esc(g.comercio)}</dd>
    <dt>Fecha</dt><dd>${fechaCorta(g.fecha_compra)}</dd>
    <dt>Monto</dt><dd><b>${dinero(g.monto)}</b></dd>
    <dt>Persona</dt><dd>${pastillaPersona(g.persona_id, g.persona)}</dd>
    <dt>Estado</dt><dd><span class="pastilla ${estadoTxt[0]}">${estadoTxt[1]}</span></dd>
    <dt>Fecha de registro</dt><dd>${fechaHora(g.creado_en)}</dd>
    <dt>Nota</dt><dd>${g.nota ? esc(g.nota) : '—'}</dd>`;
  // Productos: se vuelven a sacar del texto que leyó el OCR al registrar la factura
  const items = g.texto_ocr ? extraerDatos(g.texto_ocr).items : [];
  $('#detalle-items').innerHTML = items.length ? `
    <h2>Productos de la factura</h2>
    <ul class="ticket-items">${items.map((it) =>
      `<li><span class="cant">${it.cantidad}x</span><span>${esc(it.descripcion)}</span><span class="precio">${dinero(it.precio)}</span></li>`).join('')}
    </ul>` : '';
  $('#detalle-acciones').innerHTML = g.estado !== 'anulado'
    ? `<button class="btn btn-peligro" data-anular="${g.id}">${ic('ban')} Anular gasto</button>` : '';
}

$('#detalle-acciones').addEventListener('click', async (e) => {
  const boton = e.target.closest('[data-anular]');
  if (boton) await conError(null, async () => { if (await anularGasto(boton.dataset.anular)) await cargarDetalle(boton.dataset.anular); });
});

// ---------- Personas: lo que te debe cada una ----------
async function cargarPersonas() {
  await cargarBase();
  pintarDeudas($('#lista-personas'), $('#total-deben'));
}

$('#form-persona').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  await conError($('#persona-error'), async () => {
    await api('/api/personas', { method: 'POST', body: datosForm(form) });
    form.reset();
    await cargarPersonas();
  }, form.querySelector('[type=submit]'));
});

// ---------- Cuenta de una persona: depósitos y movimientos ----------
let personaActual = null;

async function cargarPersona(id) {
  const [persona, movimientos] = await Promise.all([
    api(`/api/personas/${encodeURIComponent(id)}`),
    api(`/api/personas/${encodeURIComponent(id)}/movimientos`),
  ]);
  await cargarBase();
  personaActual = persona;
  $('#persona-nombre').textContent = persona.nombre;
  $('#persona-gastado').textContent = dinero(persona.gastado);
  $('#persona-pagado').textContent = dinero(persona.pagado);
  $('#persona-ultimo-pago').textContent = persona.ultimo_pago ? `Último depósito: ${fechaCorta(persona.ultimo_pago)}` : 'Aún no ha depositado';
  $('#persona-saldo-etiqueta').textContent = persona.saldo > 0 ? 'Te debe' : persona.saldo < 0 ? 'Saldo a su favor' : 'Está al día';
  $('#persona-saldo').textContent = dinero(Math.abs(persona.saldo));
  $('#btn-activar-persona').innerHTML = persona.activo ? `${ic('ban')} Desactivar` : `${ic('check')} Activar`;

  const form = $('#form-pago');
  form.reset();
  form.fecha.value = hoy();
  $('#pago-error').textContent = '';

  $('#persona-movimientos').innerHTML = movimientos.length ? movimientos.map((m) => `
    <li>
      <span class="mov-icono ${m.tipo}">${ic(m.tipo === 'gasto' ? 'receipt' : 'check')}</span>
      <span class="mov-texto">
        <strong>${m.tipo === 'gasto' ? esc(m.descripcion) : esc(m.descripcion)}</strong>
        <small>${fechaCorta(m.fecha)}${m.nota ? ` · ${esc(m.nota)}` : ''}</small>
      </span>
      <span class="mov-monto ${m.tipo}">${m.tipo === 'gasto' ? '+' : '−'} ${dinero(m.monto)}</span>
      ${m.tipo === 'gasto'
        ? `<a class="btn-icono" href="#gasto/${m.id}" title="Ver gasto" aria-label="Ver gasto">${ic('eye')}</a>`
        : `<button class="btn-icono" data-borrar-pago="${m.id}" title="Borrar depósito" aria-label="Borrar depósito">${ic('x')}</button>`}
    </li>`).join('')
    : '<li class="vacio">Todavía no hay compras ni depósitos de esta persona.</li>';
}

$('#form-pago').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const d = datosForm(form);
  if (!(Number(d.monto) > 0)) {
    $('#pago-error').textContent = 'Escribe el monto que te depositó';
    return;
  }
  if (personaActual && Number(d.monto) > personaActual.saldo + 0.001
    && !confirm(`El depósito (${dinero(d.monto)}) es mayor a lo que te debe (${dinero(Math.max(0, personaActual.saldo))}). La diferencia quedará como saldo a su favor. ¿Guardarlo igual?`)) {
    return;
  }
  await conError($('#pago-error'), async () => {
    await api(`/api/personas/${personaActual.id}/pagos`, { method: 'POST', body: d });
    toast('Depósito registrado');
    await cargarPersona(personaActual.id);
  }, form.querySelector('[type=submit]'));
});

$('#persona-movimientos').addEventListener('click', async (e) => {
  const boton = e.target.closest('[data-borrar-pago]');
  if (!boton || !confirm('¿Borrar este depósito? Se volverá a sumar a lo que te debe.')) return;
  await conError(null, async () => {
    await api(`/api/personas/${personaActual.id}/pagos/${boton.dataset.borrarPago}`, { method: 'DELETE' });
    toast('Depósito borrado');
    await cargarPersona(personaActual.id);
  });
});

$('#btn-renombrar-persona').addEventListener('click', async () => {
  const nombre = prompt('Nuevo nombre:', personaActual?.nombre);
  if (!nombre?.trim()) return;
  await conError(null, async () => {
    await api(`/api/personas/${personaActual.id}`, { method: 'PATCH', body: { nombre } });
    await cargarPersona(personaActual.id);
  });
});

$('#btn-activar-persona').addEventListener('click', async () => {
  const desactivar = Boolean(personaActual.activo);
  if (desactivar && !confirm('Al desactivarla ya no aparecerá al registrar gastos. Su cuenta y movimientos se conservan. ¿Desactivar?')) return;
  await conError(null, async () => {
    await api(`/api/personas/${personaActual.id}`, { method: 'PATCH', body: { activo: !desactivar } });
    await cargarPersona(personaActual.id);
  });
});

// ---------- Reportes ----------
async function cargarReportes() {
  await cargarBase();
  const r = await api(`/api/reportes/resumen?mes=${estado.mes}`);
  const t = estado.tarjeta;
  $('#rep-titulo-mes').textContent = `· ${nombreMes(estado.mes)}`;
  $('#rep-total').textContent = dinero(r.total);
  $('#rep-total-pct').textContent = t?.limite ? `${pct((r.total / t.limite) * 100)} del límite` : '';
  $('#rep-disponible').textContent = t ? dinero(t.disponible) : '—';
  $('#rep-disponible-pct').textContent = t?.limite ? `${pct((t.disponible / t.limite) * 100)} restante` : '';
  $('#rep-compras').textContent = r.cantidad;

  const maximo = Math.max(...r.por_persona.map((p) => p.total), 0);
  $('#rep-barras').innerHTML = r.por_persona.length ? r.por_persona.map((p) => {
    const parte = r.total ? (p.total / r.total) * 100 : 0;
    return `
      <div class="barra-fila">
        <span class="nombre">${esc(p.nombre)}</span>
        <div class="barra-pista" data-tip="${tip(p.nombre, `${dinero(p.total)} · ${p.cantidad} ${p.cantidad === 1 ? 'compra' : 'compras'}`)}">
          <div class="barra-relleno" style="width:${maximo ? (p.total / maximo) * 100 : 0}%;background:${colorPersona(p.id)}"></div>
        </div>
        <span class="num">${dinero(p.total)}</span>
        <span class="pct">${Math.round(parte)}%</span>
      </div>`;
  }).join('') : '<p class="vacio">Sin datos</p>';

  dibujarDona(r);

  $('#rep-comercios').innerHTML = r.por_comercio.length
    ? r.por_comercio.map((c) => `<tr><td>${esc(c.comercio)}</td><td class="num">${c.cantidad}</td><td class="num">${dinero(c.total)}</td></tr>`).join('')
    : '<tr><td colspan="3" class="vacio">Sin gastos este mes</td></tr>';
}

function dibujarDona(r) {
  const conGasto = r.por_persona.filter((p) => p.total > 0);
  const sinPersona = Math.round((r.total - conGasto.reduce((s, p) => s + p.total, 0)) * 100) / 100;
  const partes = conGasto.map((p) => ({ id: p.id, nombre: p.nombre, total: p.total, color: colorPersona(p.id) }));
  if (sinPersona > 0) partes.push({ id: 'otros', nombre: 'Sin asignar', total: sinPersona, color: COLOR_OTROS });

  const R = 90; const r0 = 58; const C = 100;
  const punto = (ang, radio) => [C + radio * Math.sin(ang), C - radio * Math.cos(ang)];
  let svg;
  if (!partes.length) {
    svg = `<circle cx="${C}" cy="${C}" r="${(R + r0) / 2}" fill="none" stroke="#f0eff6" stroke-width="${R - r0}"/>`;
  } else if (partes.length === 1) {
    svg = `<circle cx="${C}" cy="${C}" r="${(R + r0) / 2}" fill="none" stroke="${partes[0].color}" stroke-width="${R - r0}"
      data-tip="${tip(partes[0].nombre, `${dinero(partes[0].total)} · 100%`)}"/>`;
  } else {
    let ang = 0;
    svg = partes.map((p) => {
      const barrido = (p.total / r.total) * Math.PI * 2;
      const [x1, y1] = punto(ang, R); const [x2, y2] = punto(ang + barrido, R);
      const [x3, y3] = punto(ang + barrido, r0); const [x4, y4] = punto(ang, r0);
      const grande = barrido > Math.PI ? 1 : 0;
      ang += barrido;
      // Borde blanco de 2px entre segmentos
      return `<path d="M${x1} ${y1}A${R} ${R} 0 ${grande} 1 ${x2} ${y2}L${x3} ${y3}A${r0} ${r0} 0 ${grande} 0 ${x4} ${y4}Z"
        fill="${p.color}" stroke="#fff" stroke-width="2" data-parte="${p.id}"
        data-tip="${tip(p.nombre, `${dinero(p.total)} · ${Math.round((p.total / r.total) * 100)}%`)}"/>`;
    }).join('');
  }
  $('#rep-dona').innerHTML = `<svg viewBox="0 0 200 200" role="img" aria-label="Distribución del gasto por persona">${svg}</svg>
    <div class="dona-centro"><small>Total</small><strong>${dinero(r.total)}</strong></div>`;

  $('#rep-leyenda').innerHTML = (partes.length ? partes : r.por_persona.map((p) => ({ ...p, color: colorPersona(p.id) })))
    .map((p) => `<li data-parte="${p.id}"><span class="punto" style="background:${p.color}"></span><span>${esc(p.nombre)}</span>
      <span class="valor">${dinero(p.total)}</span></li>`).join('') || '<li><span></span><span class="valor">Sin datos</span></li>';
}

// Resalta el segmento de la dona al pasar por la leyenda
$('#rep-leyenda').addEventListener('mouseover', (e) => {
  const li = e.target.closest('[data-parte]');
  $$('#rep-dona path').forEach((p) => p.classList.toggle('foco', li && p.dataset.parte === li.dataset.parte));
  $('#rep-dona').classList.toggle('con-foco', !!li && !!$(`#rep-dona path[data-parte="${li.dataset.parte}"]`));
});
$('#rep-leyenda').addEventListener('mouseleave', () => $('#rep-dona').classList.remove('con-foco'));

$('#btn-pdf').addEventListener('click', () => window.print());

// Tooltip para barras y dona
const tooltip = $('#tooltip');
document.addEventListener('mousemove', (e) => {
  const objetivo = e.target.closest?.('[data-tip]');
  if (!objetivo) { tooltip.hidden = true; return; }
  tooltip.innerHTML = objetivo.dataset.tip;
  tooltip.style.left = `${e.clientX}px`;
  tooltip.style.top = `${e.clientY}px`;
  tooltip.hidden = false;
});

// ---------- Configuración ----------
let tarjetaEditando = null; // id de la tarjeta del formulario; null = tarjeta nueva

async function cargarConfiguracion() {
  await cargarBase();
  if (!estado.tarjetas.some((t) => t.id === tarjetaEditando)) tarjetaEditando = estado.tarjeta?.id ?? null;
  pintarTarjetas();
  llenarFormTarjeta();
}

function pintarTarjetas() {
  const nueva = tarjetaEditando === null;
  $('#tarjetas-fila').innerHTML = estado.tarjetas.map((t) => `
    <button type="button" class="tarjeta-visual${t.id === tarjetaEditando ? ' elegida' : ''}${t.estado === 'bloqueada' ? ' bloqueada' : ''}"
      data-tarjeta="${t.id}" aria-pressed="${t.id === tarjetaEditando}" aria-label="Editar ${esc(t.nombre)}">
      <span class="tv-chip"></span>
      <svg class="tv-onda" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8a5.5 5.5 0 0 1 0 8M11.5 6a9 9 0 0 1 0 12M15 4a12.5 12.5 0 0 1 0 16"/></svg>
      <span class="tv-logo"><span><span class="tv-rombo"></span>siman</span><small>CREDISIMAN</small></span>
      <span class="tv-numero">${t.ultimos4 ? `•••• ${t.ultimos4}` : ''}</span>
      <span class="tv-marca">VISA</span>
      ${t.estado === 'bloqueada' ? '<span class="tv-estado">Bloqueada</span>' : ''}
    </button>`).join('') + `
    <button type="button" class="tarjeta-agregar${nueva ? ' elegida' : ''}" data-tarjeta="nueva" aria-pressed="${nueva}">
      <span class="ta-mas">${ic('plus')}</span>
      <span>${estado.tarjetas.length ? 'Agregar otra tarjeta' : 'Agregar tarjeta'}</span>
    </button>`;
}

function llenarFormTarjeta() {
  const form = $('#form-tarjeta');
  const t = estado.tarjetas.find((x) => x.id === tarjetaEditando);
  form.nombre.value = t?.nombre ?? '';
  form.ultimos4.value = t?.ultimos4 ?? '';
  form.limite.value = t?.limite ?? '';
  form.saldo_inicial.value = t?.saldo_inicial ?? 0;
  form.estado.value = t?.estado ?? 'activa';
  form.estado.closest('label').hidden = !t;
  $('#tarjeta-error').textContent = '';
  form.querySelector('[type=submit] span').textContent = t ? 'Guardar cambios' : 'Crear tarjeta';
}

$('#tarjetas-fila').addEventListener('click', (e) => {
  const boton = e.target.closest('[data-tarjeta]');
  if (!boton) return;
  tarjetaEditando = boton.dataset.tarjeta === 'nueva' ? null : Number(boton.dataset.tarjeta);
  pintarTarjetas();
  llenarFormTarjeta();
  if (tarjetaEditando === null) $('#form-tarjeta').nombre.focus();
});

$('#form-tarjeta').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  await conError($('#tarjeta-error'), async () => {
    const d = datosForm(form);
    if (tarjetaEditando) {
      await api(`/api/tarjetas/${tarjetaEditando}`, { method: 'PATCH', body: d });
    } else {
      delete d.estado;
      tarjetaEditando = (await api('/api/tarjetas', { method: 'POST', body: d })).id;
    }
    toast('Tarjeta guardada');
    await cargarConfiguracion();
  }, form.querySelector('[type=submit]'));
});

// Ojo para mostrar u ocultar cada contraseña
$$('#form-password .btn-ojo').forEach((boton) => boton.addEventListener('click', () => {
  const input = boton.previousElementSibling;
  input.type = input.type === 'password' ? 'text' : 'password';
  boton.setAttribute('aria-label', input.type === 'password' ? 'Mostrar contraseña' : 'Ocultar contraseña');
}));

// Marca en verde los requisitos que la contraseña nueva ya cumple
const REGLAS_CLAVE = {
  largo: (c) => c.length >= 8,
  letras: (c) => /\p{L}/u.test(c) && /\d/.test(c),
  simbolo: (c) => /[^\p{L}\d\s]/u.test(c),
};
$('#form-password').nueva.addEventListener('input', (e) => {
  $$('#requisitos-clave li').forEach((li) => li.classList.toggle('cumple', REGLAS_CLAVE[li.dataset.regla](e.target.value)));
});

$('#form-password').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  await conError($('#password-error'), async () => {
    const { actual, nueva, confirmar } = datosForm(form);
    if (!actual) throw new Error('Ingresa tu contraseña actual');
    if (!REGLAS_CLAVE.largo(nueva) || !REGLAS_CLAVE.letras(nueva)) throw new Error('La contraseña nueva no cumple los requisitos');
    if (nueva !== confirmar) throw new Error('La confirmación no coincide con la contraseña nueva');
    await api('/api/auth/password', { method: 'PATCH', body: { actual, nueva } });
    form.reset();
    $$('#requisitos-clave li').forEach((li) => li.classList.remove('cumple'));
    toast('Contraseña actualizada');
  }, form.querySelector('[type=submit]'));
});

// ---------- Visor de imágenes ----------
const visor = $('#visor');
document.addEventListener('click', (e) => {
  const zoom = e.target.closest('[data-zoom]');
  if (!zoom) return;
  $('img', visor).src = zoom.dataset.zoom;
  visor.hidden = false;
});
visor.addEventListener('click', () => { visor.hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') visor.hidden = true; });

pintarIconos();
// Despierta el servidor y la base desde ya (si estaban dormidos tardan en responder)
fetch(`${API_BASE}/api/salud`).catch(() => {});
iniciarApp();
