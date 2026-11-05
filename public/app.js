
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
    datosGuardados.borrar(); // al cerrar sesión no quedan datos de la cuenta en este navegador
  },
  // Datos del usuario de la última sesión: permiten abrir la app al instante sin esperar al servidor
  usuario: () => { try { return JSON.parse(localStorage.getItem(CLAVE_USUARIO) || sessionStorage.getItem(CLAVE_USUARIO)); } catch { return null; } },
  guardarUsuario: (usuario) => {
    try { (localStorage.getItem(CLAVE_TOKEN) ? localStorage : sessionStorage).setItem(CLAVE_USUARIO, JSON.stringify(usuario)); } catch { /* sin almacenamiento */ }
  },
};

// Colores por persona: orden fijo validado (contraste y daltonismo); el color sigue a la persona, no a su posición
// (mismos colores de siempre, reordenados para que las primeras personas combinen con el tema celeste y verde)
const PALETA = ['#2a78d6', '#1baf7a', '#eda100', '#e87ba4', '#eb6834', '#6250d6', '#008300', '#e34948'];
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
  billetera: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/><path d="M21 9h-5a3 3 0 0 0 0 6h5z"/><path d="M16 12h.01"/>',
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

// Últimos datos recibidos de cada consulta, guardados en este navegador. Si el servidor tarda más de
// ESPERA_MAXIMA (porque Render lo durmió), se muestran estos y la vista se actualiza sola al llegar los nuevos.
const CLAVE_CACHE = 'credisiman-cache:';
const ESPERA_MAXIMA = 2000;
const datosGuardados = {
  leer: (url) => { try { const t = localStorage.getItem(CLAVE_CACHE + url); return t ? JSON.parse(t) : undefined; } catch { return undefined; } },
  guardar: (url, datos) => { try { localStorage.setItem(CLAVE_CACHE + url, JSON.stringify(datos)); } catch { /* sin espacio */ } },
  borrar: () => {
    try { Object.keys(localStorage).filter((k) => k.startsWith(CLAVE_CACHE)).forEach((k) => localStorage.removeItem(k)); } catch { /* nada */ }
  },
};
const SIN_RESPUESTA = Symbol('sin respuesta');
// Vistas que se pueden volver a pintar solas (no las que tienen un formulario a medio llenar)
const VISTAS_REFRESCABLES = ['inicio', 'gastos', 'gasto', 'depositos', 'personas', 'persona', 'reportes'];
let refrescoProgramado = null;
function refrescarVistaCuandoLleguen() {
  clearTimeout(refrescoProgramado);
  refrescoProgramado = setTimeout(() => {
    if (VISTAS_REFRESCABLES.includes(location.hash.slice(1).split('/')[0] || 'inicio')) navegar();
  }, 300);
}

async function api(url, opciones = {}) {
  const esLectura = !opciones.method || opciones.method === 'GET';
  const guardado = esLectura && url !== '/api/auth/me' ? datosGuardados.leer(url) : undefined;
  const pedido = pedirAlServidor(url, opciones, guardado === undefined);
  if (guardado === undefined) return pedido;
  const primero = await Promise.race([pedido, new Promise((r) => { setTimeout(() => r(SIN_RESPUESTA), ESPERA_MAXIMA); })]);
  if (primero !== SIN_RESPUESTA) return primero;
  // El servidor está despertando: se muestran los últimos datos y se repinta cuando lleguen los nuevos
  pedido.then((nuevos) => { if (JSON.stringify(nuevos) !== JSON.stringify(guardado)) refrescarVistaCuandoLleguen(); }).catch(() => {});
  marcarConexion(true, 'Actualizando…');
  return guardado;
}

async function pedirAlServidor(url, opciones, avisarSiTarda) {
  const esForm = opciones.body instanceof FormData;
  const token = sesionGuardada.leer();
  const headers = {};
  if (!esForm) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  // El plan gratis de Render duerme el servidor tras un rato sin uso; la primera petición tarda en despertarlo
  const aviso = setTimeout(() => {
    if (avisarSiTarda && $('#vista-cargando').hidden) toast('Conectando con el servidor… la primera vez puede tardar hasta un minuto.', 60000);
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
      : 'No hay conexión con el servidor. Ejecuta "npm start" en la terminal.');
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
  if (!opciones.method || opciones.method === 'GET') datosGuardados.guardar(url, datos);
  return datos;
}

// Indicador de la barra lateral: punto verde si el servidor responde, rojo si no
function marcarConexion(ok, texto) {
  const el = $('#estado-conexion');
  el.classList.toggle('sin-conexion', !ok);
  el.dataset.nombre = texto ? 'Mostrando los últimos datos; el servidor está despertando'
    : ok ? 'Conectado al servidor' : 'Sin conexión con el servidor';
  $('#estado-conexion-texto').textContent = texto || (ok ? 'Conectado' : 'Sin conexión');
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

// Tarjeta con la que se trabaja (resumen de Inicio, registrar gasto, reportes); se recuerda en este navegador
const CLAVE_TARJETA = 'credisiman-tarjeta-elegida';
function elegirTarjeta(id) {
  estado.tarjeta = estado.tarjetas.find((t) => t.id === Number(id)) || estado.tarjeta;
  try { localStorage.setItem(CLAVE_TARJETA, String(estado.tarjeta?.id ?? '')); } catch { /* sin almacenamiento */ }
}

// Botones para elegir tarjeta (solo aparecen si hay más de una). Cada uno muestra lo que le queda disponible;
// con "conBarra" (Inicio) también cuánto del límite se ha usado, para ver el saldo de todas las tarjetas a la vez.
function pintarElegirTarjeta(contenedor, soloActivas, conBarra = false) {
  const lista = estado.tarjetas.filter((t) => !soloActivas || t.estado === 'activa');
  (contenedor.closest('#campo-tarjeta') || contenedor).hidden = lista.length < 2;
  contenedor.innerHTML = lista.map((t) => {
    const usado = t.limite > 0 ? Math.min(100, Math.max(0, ((t.limite - t.disponible) / t.limite) * 100)) : 0;
    return `
    <button type="button" class="tarjeta-opcion${conBarra ? ' con-barra' : ''}" role="radio" aria-checked="${t.id === estado.tarjeta?.id}" data-elegir-tarjeta="${t.id}">
      <span class="mini-tarjeta ${t.emisor === 'davivienda' ? 'dv' : ''}"></span>
      <span class="to-texto">
        <strong>${esc(t.nombre)}${t.ultimos4 ? ` <small>•••• ${esc(t.ultimos4)}</small>` : ''}</strong>
        <small>${t.estado === 'bloqueada' ? 'Bloqueada · ' : ''}Disponible <b>${dinero(t.disponible)}</b>${conBarra ? ` de ${dinero(t.limite)}` : ''}</small>
        ${conBarra ? `<span class="to-barra${usado > 85 ? ' alto' : ''}"><span style="width:${usado}%"></span></span>` : ''}
      </span>
    </button>`;
  }).join('');
}

async function cargarBase() {
  const [tarjetas, personas] = await Promise.all([api('/api/tarjetas'), api('/api/personas')]);
  estado.tarjetas = tarjetas;
  let guardada = null;
  try { guardada = Number(localStorage.getItem(CLAVE_TARJETA)); } catch { /* sin almacenamiento */ }
  estado.tarjeta = tarjetas.find((t) => t.id === guardada) || tarjetas.find((t) => t.estado === 'activa') || tarjetas[0] || null;
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

// En el celular la barra completa solo se ve en Inicio; en las demás secciones queda solo el avatar con la flecha
function ajustarMenuMinimo() {
  const vista = location.hash.slice(1).split('/')[0] || 'inicio';
  const minimo = esCelular() && vista !== 'inicio' && Boolean(vistas[vista]);
  $('#lateral').classList.toggle('minima', minimo);
  document.body.classList.toggle('menu-minimo', minimo);
}
matchMedia('(max-width: 860px)').addEventListener('change', ajustarMenuMinimo);

// ---------- Navegación (#vista o #gasto/12) ----------
const vistas = {
  inicio: cargarInicio,
  registrar: abrirRegistro,
  gastos: cargarGastos,
  gasto: cargarDetalle,
  depositos: cargarDepositos,
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
  ajustarMenuMinimo();
  const seccion = vista === 'gasto' ? 'detalle' : vista;
  $$('.principal > section').forEach((s) => { s.hidden = s.dataset.vista !== seccion; });
  $$('#menu a').forEach((a) => a.classList.toggle('activo', a.dataset.vista === (MENU_DE[vista] || vista)));
  window.scrollTo(0, 0);
  conError(null, () => vistas[vista](param));
}
window.addEventListener('hashchange', navegar);

// Selector de mes compartido por Mis gastos, Depósitos y Reportes
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
  pintarElegirTarjeta($('#inicio-tarjetas'), false, true);
  $('#res-nombre').textContent = estado.tarjetas.length > 1 ? `Límite · ${t.nombre}` : 'Límite de la tarjeta';
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
    .map((p) => {
      const color = colorPersona(p.id);
      const sinMovimientos = !p.gastado && !p.pagado;
      const [clase, estadoTxt, etiqueta] = p.saldo > 0 ? ['debe', 'Debe', 'Te debe']
        : p.saldo < 0 ? ['favor', 'A favor', 'Saldo a su favor']
          : sinMovimientos ? ['neutra', 'Sin movimientos', 'Sin compras todavía'] : ['al-dia', 'Al día', 'Cuenta saldada'];
      // Parte de lo que gastó que ya pagó (100 % si está al día o tiene saldo a favor)
      const pagado = p.gastado > 0 ? Math.min(100, Math.round((p.pagado / p.gastado) * 100)) : p.pagado > 0 ? 100 : 0;
      return `
      <a class="panel deuda-card estado-${clase} ${p.activo ? '' : 'inactiva'}" href="#persona/${p.id}">
        <div class="dc-cabeza">
          <span class="dc-avatar" style="background:${color}22;color:color-mix(in srgb, ${color} 70%, #000)">${esc(iniciales(p.nombre))}</span>
          <div class="dc-nombre">
            <strong>${esc(p.nombre)}</strong>
            <span class="dc-estado"><span class="punto"></span>${estadoTxt}</span>
          </div>
          <span class="dc-flecha">${ic('chevron')}</span>
        </div>
        <div class="dc-monto">
          <small>${etiqueta}</small>
          <strong>${p.saldo === 0 && !sinMovimientos ? `${ic('check')} ` : ''}${dinero(Math.abs(p.saldo))}</strong>
        </div>
        <div class="dc-barra" role="img" aria-label="Ha pagado el ${pagado}% de lo que gastó"><span style="width:${pagado}%"></span></div>
        <div class="dc-pie">
          <div><small>Gastó</small><b>${dinero(p.gastado)}</b></div>
          <div><small>Depositó</small><b>${dinero(p.pagado)}</b></div>
          <div><small>Pagado</small><b>${pagado}%</b></div>
        </div>
      </a>`;
    }).join('')
    : '<div class="panel vacio-grande">Aún no hay personas. Agrégalas en <a href="#personas">Personas</a> para llevar la cuenta de lo que te deben.</div>';
}

// ---------- Registrar gasto: datos + foto de la factura adjunta ----------
const registro = { foto: null, vistaPrevia: null };

function irPaso(n) {
  $$('.registro .paso').forEach((p) => { p.hidden = Number(p.dataset.paso) !== n; });
}

function marcoImagen(src, conZoom) {
  if (!src) return `<div class="sin-imagen">${ic('receipt')}<span>Gasto sin factura</span></div>`;
  return `<img src="${esc(src)}" alt="Factura" data-zoom="${esc(src)}">` +
    (conZoom ? `<button type="button" class="btn-icono btn-zoom" data-zoom="${esc(src)}" aria-label="Ampliar">${ic('zoom')}</button>` : '');
}

function quitarFoto() {
  if (registro.vistaPrevia) URL.revokeObjectURL(registro.vistaPrevia);
  Object.assign(registro, { foto: null, vistaPrevia: null });
  $('#input-factura').value = '';
  $('#input-camara').value = '';
  $('#adjunto-vacio').hidden = false;
  $('#adjunto-lleno').hidden = true;
  $('#adjunto-imagen').innerHTML = '';
}

function reiniciarRegistro() {
  quitarFoto();
  const form = $('#form-gasto');
  form.reset();
  form.fecha_compra.value = hoy();
  $('#conf-persona').value = '';
  $('#confirmar-error').textContent = '';
  irPaso(1);
}

async function abrirRegistro() {
  reiniciarRegistro();
  cargarComercios().catch(() => {}); // si falla, el campo funciona igual sin sugerencias
  await cargarBase();
  // Un gasto solo se puede cargar a una tarjeta activa
  if (estado.tarjeta?.estado !== 'activa') elegirTarjeta(estado.tarjetas.find((t) => t.estado === 'activa')?.id);
  pintarElegirTarjeta($('#elegir-tarjeta'), true);
  pintarPersonasElegibles();
  if (!estado.tarjeta || estado.tarjeta.estado !== 'activa') {
    $('#confirmar-error').textContent = estado.tarjeta ? 'La tarjeta está bloqueada.' : 'Primero hay que configurar la tarjeta en Configuración.';
  }
}

// Elegir tarjeta: en Inicio cambia el resumen; al registrar, a qué tarjeta se carga el gasto
$('#inicio-tarjetas').addEventListener('click', (e) => {
  const boton = e.target.closest('[data-elegir-tarjeta]');
  if (!boton) return;
  elegirTarjeta(boton.dataset.elegirTarjeta);
  conError(null, cargarInicio);
});
$('#elegir-tarjeta').addEventListener('click', (e) => {
  const boton = e.target.closest('[data-elegir-tarjeta]');
  if (!boton) return;
  elegirTarjeta(boton.dataset.elegirTarjeta);
  $$('#elegir-tarjeta [data-elegir-tarjeta]').forEach((b) => b.setAttribute('aria-checked', String(b === boton)));
  $('#confirmar-error').textContent = '';
});

// Memoria de comercios: al escribir se sugieren los lugares ya usados, y los más frecuentes quedan a un toque
async function cargarComercios() {
  const comercios = await api('/api/gastos/comercios');
  $('#lista-comercios').innerHTML = comercios.map((c) => `<option value="${esc(c)}"></option>`).join('');
  $('#comercios-frecuentes').innerHTML = comercios.slice(0, 6)
    .map((c) => `<button type="button" class="chip chip-chico" data-comercio="${esc(c)}">${esc(c)}</button>`).join('');
}
$('#comercios-frecuentes').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-comercio]');
  if (!chip) return;
  const campo = $('#form-gasto').comercio;
  campo.value = chip.dataset.comercio;
  $('#form-gasto').monto.focus();
});

function errorImagen(archivo) {
  if (!archivo.type.startsWith('image/')) return 'Ese archivo no es una imagen.';
  if (archivo.size > 20 * 1024 * 1024) return 'La imagen pesa demasiado.';
  return '';
}

// La foto se reduce (máx. 1600 px, JPEG) para que suba rápido; se guarda junto con el gasto al presionar Guardar
async function adjuntarFoto(archivo) {
  if (!archivo) return;
  const error = errorImagen(archivo);
  $('#confirmar-error').textContent = error;
  if (error) return;
  const foto = await comprimirImagen(archivo);
  if (registro.vistaPrevia) URL.revokeObjectURL(registro.vistaPrevia);
  Object.assign(registro, { foto, vistaPrevia: URL.createObjectURL(foto) });
  $('#adjunto-imagen').innerHTML = marcoImagen(registro.vistaPrevia, true);
  $('#adjunto-vacio').hidden = true;
  $('#adjunto-lleno').hidden = false;
}

$('#input-factura').addEventListener('change', (e) => adjuntarFoto(e.target.files[0]));
$('#input-camara').addEventListener('change', (e) => adjuntarFoto(e.target.files[0]));
$('#btn-cambiar-foto').addEventListener('click', () => $('#input-factura').click());
$('#btn-quitar-foto').addEventListener('click', quitarFoto);
const zona = $('#adjunto');
zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('arrastrando'); });
zona.addEventListener('dragleave', () => zona.classList.remove('arrastrando'));
zona.addEventListener('drop', (e) => {
  e.preventDefault();
  zona.classList.remove('arrastrando');
  adjuntarFoto(e.dataTransfer.files[0]);
});

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

$('#form-gasto').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const d = datosForm(form);
  const error = !d.comercio.trim() ? 'Escribe el nombre del comercio'
    : !d.fecha_compra ? 'Indica la fecha de la compra'
      : !(Number(d.monto) > 0) ? 'El monto debe ser mayor a 0'
        : !d.persona_id ? 'Elige de quién es el gasto' : '';
  $('#confirmar-error').textContent = error;
  if (error) return;
  const boton = form.querySelector('[type=submit]');
  await conError($('#confirmar-error'), async () => {
    // Primero se sube la foto (si hay) y luego se crea el gasto con ella adjunta
    let archivo = null;
    if (registro.foto) {
      $('span', boton).textContent = 'Subiendo foto…';
      const fd = new FormData();
      fd.append('imagen', registro.foto);
      ({ archivo } = await api('/api/facturas', { method: 'POST', body: fd }));
    }
    $('span', boton).textContent = 'Guardando…';
    const cuerpo = {
      comercio: d.comercio.trim(),
      fecha_compra: d.fecha_compra,
      monto: Number(d.monto),
      tarjeta_id: estado.tarjeta?.id,
      persona_id: Number(d.persona_id),
      nota: d.nota,
      archivo,
    };
    let r;
    try {
      r = await api('/api/gastos', { method: 'POST', body: cuerpo });
    } catch (err) {
      if (err.status !== 409) throw err;
      if (!confirm(`${err.message}. ¿Registrarlo de todas formas?`)) return;
      r = await api('/api/gastos', { method: 'POST', body: { ...cuerpo, forzar: true } });
    }
    $('#exito-monto').textContent = dinero(r.gasto.monto);
    $('#exito-tarjeta').textContent = r.tarjeta.nombre;
    irPaso(4);
    celebrarGasto(r.gasto.monto, r.tarjeta.disponible);
  }, boton);
  $('span', boton).textContent = 'Guardar gasto';
});

// Animación al guardar: el check aparece, salta confeti y el saldo baja contando hasta el nuevo valor
const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function celebrarGasto(monto, disponible) {
  const exito = $('.exito');
  const saldo = $('#exito-saldo');
  exito.classList.remove('animar');
  void exito.offsetWidth; // reinicia las animaciones CSS si se registra otro gasto seguido
  exito.classList.add('animar');
  navigator.vibrate?.(35);
  $('.exito-descuento').textContent = `−${dinero(monto)}`;
  if (sinMovimiento()) { saldo.textContent = dinero(disponible); return; }

  // Confeti: piezas que salen disparadas desde el check en todas direcciones y caen
  const capa = $('.exito-explosion');
  capa.innerHTML = Array.from({ length: 28 }, (_, i) => {
    const angulo = (i / 28) * Math.PI * 2 + Math.random() * 0.4;
    const distancia = 70 + Math.random() * 90;
    const estilo = [
      `--dx:${Math.cos(angulo) * distancia}px`, `--dy:${Math.sin(angulo) * distancia * 0.8}px`,
      `--giro:${Math.round(Math.random() * 540 - 270)}deg`, `--retraso:${Math.round(Math.random() * 120)}ms`,
      `background:${PALETA[i % PALETA.length]}`,
    ].join(';');
    return `<i class="${i % 3 ? 'tira' : ''}" style="${estilo}"></i>`;
  }).join('');

  // El saldo arranca en el valor anterior (antes de este gasto) y baja hasta el nuevo
  const inicio = disponible + Number(monto);
  const duracion = 1100;
  let t0 = null;
  const paso = (t) => {
    t0 ??= t;
    const avance = Math.min(1, (t - t0 - 650) / duracion); // espera a que aparezca la tarjeta del saldo
    const suave = avance <= 0 ? 0 : 1 - (1 - avance) ** 3;
    saldo.textContent = dinero(inicio - (inicio - disponible) * suave);
    if (avance < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

$('#btn-otro-gasto').addEventListener('click', abrirRegistro);

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
      <td><span class="comercio">${esc(g.comercio)}</span>${estado.tarjetas.length > 1 ? `<small class="tarjeta-del-gasto">${esc(g.tarjeta)}</small>` : ''}
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

// ---------- Cifras que cambian contando (como en una app del banco) ----------
// Cada cifra recuerda el último valor que mostró y, al actualizarse, cuenta desde ese valor hasta el nuevo
function contar(el, valor, formato = dinero) {
  const desde = Number(el.dataset.valor ?? valor);
  el.dataset.valor = valor;
  if (sinMovimiento() || desde === valor) { el.textContent = formato(valor); return; }
  const duracion = 700;
  let t0 = null;
  const paso = (t) => {
    t0 ??= t;
    const avance = Math.min(1, (t - t0) / duracion);
    const actual = desde + (valor - desde) * (1 - (1 - avance) ** 3);
    el.textContent = formato(formato === dinero ? actual : Math.round(actual));
    if (avance < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

const METODOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', deposito: 'Depósito bancario' };
const urlComprobante = (id) => `${API_BASE}/api/depositos/${id}/comprobante?t=${encodeURIComponent(sesionGuardada.leer() || '')}`;
const textoSaldo = (saldo) => (saldo > 0 ? 'Te debe' : saldo < 0 ? 'Saldo a su favor' : 'Está al día');

// ---------- Cuenta de una persona: compras, depósitos y saldo ----------
let personaActual = null;

async function cargarPersona(id) {
  const [persona, movimientos] = await Promise.all([
    api(`/api/personas/${encodeURIComponent(id)}`),
    api(`/api/personas/${encodeURIComponent(id)}/movimientos`),
  ]);
  await cargarBase();
  // Al cambiar de persona las cifras no cuentan desde las de la anterior
  if (personaActual?.id !== persona.id) $$('#persona-gastado, #persona-pagado, #persona-saldo').forEach((el) => delete el.dataset.valor);
  personaActual = persona;
  $('#persona-nombre').textContent = persona.nombre;
  contar($('#persona-gastado'), persona.gastado);
  contar($('#persona-pagado'), persona.pagado);
  $('#persona-ultimo-pago').textContent = persona.ultimo_pago ? `Último depósito: ${fechaCorta(persona.ultimo_pago)}` : 'Aún no ha depositado';
  $('#persona-saldo-etiqueta').textContent = textoSaldo(persona.saldo);
  contar($('#persona-saldo'), Math.abs(persona.saldo));
  $('#btn-saldar').hidden = !(persona.saldo > 0 && esAdmin());
  $('#btn-activar-persona').innerHTML = persona.activo ? `${ic('ban')} Desactivar` : `${ic('check')} Activar`;

  $('#persona-movimientos').innerHTML = movimientos.length ? movimientos.map((m) => {
    const esGasto = m.tipo === 'gasto';
    const detalle = [fechaCorta(m.fecha), !esGasto && METODOS[m.metodo], m.referencia && `ref. ${esc(m.referencia)}`, m.nota && esc(m.nota)]
      .filter(Boolean).join(' · ');
    const accion = esGasto
      ? `<a class="btn-icono" href="#gasto/${m.id}" title="Ver gasto" aria-label="Ver gasto">${ic('eye')}</a>`
      : m.anulado || !esAdmin() ? '<span></span>'
        : `<button class="btn-icono" data-anular-deposito="${m.id}" title="Anular depósito" aria-label="Anular depósito">${ic('ban')}</button>`;
    return `
    <li class="${m.anulado ? 'anulado' : ''}">
      <span class="mov-icono ${m.tipo}">${ic(esGasto ? 'receipt' : 'billetera')}</span>
      <span class="mov-texto">
        <strong>${esc(m.descripcion)}${m.anulado ? ' <span class="pastilla estado-mal">Anulado</span>' : ''}</strong>
        <small>${detalle}</small>
      </span>
      <span class="mov-monto ${m.tipo}">${esGasto ? '+' : '−'} ${dinero(m.monto)}
        ${m.tiene_comprobante ? `<button type="button" class="btn-link mov-comprobante" data-zoom="${urlComprobante(m.id)}">Ver comprobante</button>` : ''}</span>
      ${accion}
    </li>`;
  }).join('')
    : '<li class="vacio">Todavía no hay compras ni depósitos de esta persona.</li>';
}

// Saldar: registra un depósito por todo lo que debe, con fecha de hoy, y la persona queda al día
$('#btn-saldar').addEventListener('click', async (e) => {
  const p = personaActual;
  if (!p || !(p.saldo > 0)) return;
  if (!confirm(`¿Saldar la cuenta de ${p.nombre}? Se registrará un depósito de ${dinero(p.saldo)} con fecha de hoy y quedará al día.`)) return;
  await conError(null, async () => {
    await api('/api/depositos', { method: 'POST', body: { persona_id: p.id, monto: p.saldo, fecha: hoy(), nota: 'Cuenta saldada' } });
    toast(`Cuenta de ${p.nombre} saldada`);
    await cargarPersona(p.id);
    const tarjeta = $('.stat.destacado');
    tarjeta.classList.remove('saldada');
    void tarjeta.offsetWidth;
    tarjeta.classList.add('saldada');
    navigator.vibrate?.(35);
  }, e.currentTarget);
});

// Un depósito equivocado no se borra: se anula, deja de contar y queda tachado en el historial
async function anularDeposito(id) {
  if (!confirm('¿Anular este depósito? Dejará de contar en el saldo (se volverá a sumar a lo que debe), pero quedará en el historial como anulado.')) return false;
  await api(`/api/depositos/${id}/anular`, { method: 'PATCH' });
  toast('Depósito anulado');
  return true;
}

$('#persona-movimientos').addEventListener('click', async (e) => {
  const boton = e.target.closest('[data-anular-deposito]');
  if (!boton) return;
  await conError(null, async () => { if (await anularDeposito(boton.dataset.anularDeposito)) await cargarPersona(personaActual.id); });
});

// ---------- Depósitos y abonos ----------
let filtroDepositos = '';

async function cargarDepositos() {
  await cargarBase();
  const chips = [{ id: '', nombre: 'Todas' }, ...estado.personas.filter((p) => p.activo)];
  if (!chips.some((c) => String(c.id) === filtroDepositos)) filtroDepositos = '';
  $('#chips-depositos').innerHTML = chips.map((c) => `
    <button class="chip ${String(c.id) === filtroDepositos ? 'activo' : ''}" data-persona="${c.id}">
      ${c.id ? `<span class="punto" style="background:${colorPersona(c.id)}"></span>` : ''}${esc(c.nombre)}
    </button>`).join('');
  await cargarTablaDepositos();
}

async function cargarTablaDepositos() {
  const params = new URLSearchParams({ mes: estado.mes });
  if (filtroDepositos) params.set('persona_id', filtroDepositos);
  const { resumen, depositos } = await api(`/api/depositos?${params}`);
  contar($('#dep-total'), resumen.total_recibido);
  contar($('#dep-cantidad'), resumen.cantidad, String);
  contar($('#dep-personas'), resumen.personas_que_abonaron, String);
  contar($('#dep-pendiente'), resumen.pendiente);
  $('#dep-pendiente-nota').textContent = resumen.a_favor > 0
    ? `a la fecha · ${dinero(resumen.a_favor)} a favor` : 'a la fecha, entre todas';

  const columnas = esAdmin() ? 7 : 6;
  $('#tabla-depositos').innerHTML = depositos.length ? depositos.map((d) => `
    <tr class="${d.anulado ? 'anulado' : ''}">
      <td>${fechaCorta(d.fecha)}</td>
      <td><a href="#persona/${d.persona_id}" class="enlace-limpio">${pastillaPersona(d.persona_id, d.persona)}</a>
        ${d.anulado ? '<span class="pastilla estado-mal">Anulado</span>' : ''}</td>
      <td>${d.metodo ? `<span class="pastilla metodo-${d.metodo}">${METODOS[d.metodo]}</span>` : '<small>—</small>'}</td>
      <td>${d.referencia ? esc(d.referencia) : '<small>—</small>'}</td>
      <td>${d.tiene_comprobante ? `<img class="miniatura" src="${urlComprobante(d.id)}" alt="Comprobante" loading="lazy" data-zoom="${urlComprobante(d.id)}">` : '<small>—</small>'}</td>
      <td class="num importe-deposito">+${dinero(d.monto)}</td>
      ${esAdmin() ? `<td><div class="acciones-celda">${d.anulado ? ''
        : `<button class="btn-icono" data-anular-deposito="${d.id}" title="Anular depósito" aria-label="Anular depósito">${ic('ban')}</button>`}</div></td>` : ''}
    </tr>`).join('')
    : `<tr><td colspan="${columnas}" class="vacio">No hay depósitos en ${nombreMes(estado.mes)}${filtroDepositos ? ' de esta persona' : ''}</td></tr>`;
}

$('#chips-depositos').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-persona]');
  if (!chip) return;
  filtroDepositos = chip.dataset.persona;
  $$('#chips-depositos .chip').forEach((c) => c.classList.toggle('activo', c === chip));
  conError(null, cargarTablaDepositos);
});

$('#tabla-depositos').addEventListener('click', async (e) => {
  const boton = e.target.closest('[data-anular-deposito]');
  if (!boton) return;
  await conError(null, async () => { if (await anularDeposito(boton.dataset.anularDeposito)) await cargarTablaDepositos(); });
});

// ---------- Modal: registrar depósito ----------
const modalDeposito = $('#modal-deposito');
const formDeposito = $('#form-deposito');
const fotoDeposito = { archivo: null, url: null };

function quitarFotoDeposito() {
  if (fotoDeposito.url) URL.revokeObjectURL(fotoDeposito.url);
  Object.assign(fotoDeposito, { archivo: null, url: null });
  $('#dep-archivo').value = '';
  $('#dep-camara').value = '';
  $('#dep-foto-vacia').hidden = false;
  $('#dep-foto-llena').hidden = true;
}

async function adjuntarFotoDeposito(archivo) {
  if (!archivo) return;
  const error = errorImagen(archivo);
  $('#deposito-error').textContent = error;
  if (error) return;
  const foto = await comprimirImagen(archivo);
  quitarFotoDeposito();
  Object.assign(fotoDeposito, { archivo: foto, url: URL.createObjectURL(foto) });
  $('#dep-foto-img').src = fotoDeposito.url;
  $('#dep-foto-vacia').hidden = true;
  $('#dep-foto-llena').hidden = false;
}
$('#dep-archivo').addEventListener('change', (e) => adjuntarFotoDeposito(e.target.files[0]));
$('#dep-camara').addEventListener('change', (e) => adjuntarFotoDeposito(e.target.files[0]));
$('#dep-quitar-foto').addEventListener('click', quitarFotoDeposito);

function pintarPersonasDeposito() {
  const elegida = $('#dep-persona').value;
  const lista = estado.personas.filter((p) => p.activo || String(p.id) === elegida);
  $('#dep-elegir-persona').innerHTML = lista.map((p) => `
    <button type="button" class="persona-opcion" role="radio" aria-checked="${String(p.id) === elegida}" data-persona="${p.id}">
      ${avatarPersona(p.id)}<span class="nombre-op">${esc(p.nombre)}</span>
    </button>`).join('') || '<p class="vacio">Primero agrega personas en <a href="#personas">Personas</a>.</p>';
}

// Muestra en vivo cómo queda la cuenta: lo que debe ahora y lo que deberá (o el saldo a su favor) con este depósito
function pintarCuentaDeposito() {
  const caja = $('#dep-cuenta');
  const persona = estado.personas.find((p) => String(p.id) === $('#dep-persona').value);
  if (!persona) { caja.hidden = true; return; }
  const monto = Math.max(0, Number(formDeposito.monto.value) || 0);
  const despues = Math.round((persona.saldo - monto) * 100) / 100;
  const ahora = persona.saldo > 0 ? `Debe <b>${dinero(persona.saldo)}</b>`
    : persona.saldo < 0 ? `Tiene <b>${dinero(-persona.saldo)}</b> a su favor` : 'Está <b>al día</b>';
  const luego = !monto ? '' : despues > 0 ? `quedará debiendo <b>${dinero(despues)}</b>`
    : despues < 0 ? `quedará <b>${dinero(-despues)}</b> a su favor` : 'quedará <b>al día</b>';
  caja.className = `dep-cuenta ${monto && despues <= 0 ? 'al-dia' : ''}`;
  caja.innerHTML = `${ic(monto && despues <= 0 ? 'check' : 'info')}<span>${ahora}${luego ? ` · con este depósito ${luego}` : ''}</span>`
    + (persona.saldo > 0 && monto !== persona.saldo
      ? `<button type="button" class="btn-link" data-todo="${persona.saldo}">Depositar todo</button>` : '');
  caja.hidden = false;
}

async function abrirModalDeposito(personaId) {
  if (!esAdmin()) return;
  formDeposito.reset();
  formDeposito.fecha.value = hoy();
  $('#dep-persona').value = personaId ? String(personaId) : '';
  $('#deposito-error').textContent = '';
  quitarFotoDeposito();
  pintarPersonasDeposito();
  pintarCuentaDeposito();
  modalDeposito.showModal();
  (personaId ? formDeposito.monto : modalDeposito.querySelector('[data-persona]') || formDeposito.monto).focus();
  // Saldos al día (puede haber cambiado algo desde que se cargó la pantalla)
  await cargarBase().catch(() => {});
  pintarPersonasDeposito();
  pintarCuentaDeposito();
}

function cerrarModal(modal) {
  if (!modal.open || modal.classList.contains('cerrando')) return;
  if (sinMovimiento()) { modal.close(); return; }
  modal.classList.add('cerrando');
  setTimeout(() => { modal.classList.remove('cerrando'); modal.close(); }, 180);
}

document.addEventListener('click', (e) => {
  const boton = e.target.closest('[data-registrar-deposito]');
  if (boton) abrirModalDeposito(boton.closest('[data-vista="persona"]') ? personaActual?.id : Number(filtroDepositos) || null);
});
modalDeposito.addEventListener('click', (e) => {
  if (e.target === modalDeposito || e.target.closest('[data-cerrar-modal]')) cerrarModal(modalDeposito);
});
modalDeposito.addEventListener('cancel', (e) => { e.preventDefault(); cerrarModal(modalDeposito); });

$('#dep-elegir-persona').addEventListener('click', (e) => {
  const opcion = e.target.closest('[data-persona]');
  if (!opcion) return;
  $('#dep-persona').value = opcion.dataset.persona;
  $$('#dep-elegir-persona [data-persona]').forEach((b) => b.setAttribute('aria-checked', String(b === opcion)));
  $('#deposito-error').textContent = '';
  pintarCuentaDeposito();
  formDeposito.monto.focus();
});
formDeposito.monto.addEventListener('input', pintarCuentaDeposito);
$('#dep-cuenta').addEventListener('click', (e) => {
  const boton = e.target.closest('[data-todo]');
  if (!boton) return;
  formDeposito.monto.value = Number(boton.dataset.todo).toFixed(2);
  pintarCuentaDeposito();
});

formDeposito.addEventListener('submit', async (e) => {
  e.preventDefault();
  const d = datosForm(formDeposito);
  const error = !d.persona_id ? 'Elige quién te depositó'
    : !(Number(d.monto) > 0) ? 'Escribe el importe del depósito'
      : !d.fecha ? 'Indica la fecha del depósito' : '';
  $('#deposito-error').textContent = error;
  if (error) return;
  const boton = formDeposito.querySelector('[type=submit]');
  await conError($('#deposito-error'), async () => {
    let archivo = null;
    if (fotoDeposito.archivo) {
      $('span', boton).textContent = 'Subiendo foto…';
      const fd = new FormData();
      fd.append('imagen', fotoDeposito.archivo);
      ({ archivo } = await api('/api/facturas', { method: 'POST', body: fd }));
    }
    $('span', boton).textContent = 'Guardando…';
    const { persona } = await api('/api/depositos', { method: 'POST', body: { ...d, persona_id: Number(d.persona_id), monto: Number(d.monto), archivo } });
    cerrarModal(modalDeposito);
    navigator.vibrate?.(35);
    toast(persona.saldo > 0 ? `Depósito registrado · ${persona.nombre} debe ${dinero(persona.saldo)}`
      : persona.saldo < 0 ? `Depósito registrado · ${persona.nombre} tiene ${dinero(-persona.saldo)} a su favor`
        : `Depósito registrado · ${persona.nombre} está al día`);
    navegar(); // la pantalla abierta se actualiza y sus cifras cuentan hasta el nuevo valor
  }, boton);
  $('span', boton).textContent = 'Guardar depósito';
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
  llenarFormTarjeta(); // primero el formulario: la tarjeta elegida se dibuja con sus datos
  pintarTarjetas();
}

const volteadas = new Set(); // tarjetas que se están viendo por el reverso
const svgOnda = '<svg class="tv-onda" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8a5.5 5.5 0 0 1 0 8M11.5 6a9 9 0 0 1 0 12M15 4a12.5 12.5 0 0 1 0 16"/></svg>';
// Casita del logo de Davivienda (techo con chimenea, ventanas y puerta en arco, de línea blanca)
const svgCasa = '<svg class="dv-casa" viewBox="0 0 40 34" aria-hidden="true"><path d="M3 15 20 3l17 12"/><path d="M28 9V4h4v8"/><path d="M7 13v18h26V13"/><path d="M10 19c3-4 7-5 10-5s7 1 10 5"/><rect x="11" y="20" width="5" height="5" rx="1"/><rect x="24" y="20" width="5" height="5" rx="1"/><path d="M17 31v-4a3 3 0 0 1 6 0v4"/></svg>';
// Chip con sus contactos
const svgChip = '<svg class="dv-chip" viewBox="0 0 50 40" aria-hidden="true"><rect x=".5" y=".5" width="49" height="39" rx="6"/><path d="M17 .5v11.5M33 .5v11.5M17 28v11.5M33 28v11.5M.5 13.5H17M33 13.5h16.5M.5 26.5H17M33 26.5h16.5"/><rect x="17" y="12" width="16" height="16" rx="3"/></svg>';

// Dibujo de una tarjeta (frente y reverso). Solo se muestran los últimos 4 dígitos:
// el número completo y el código de seguridad nunca se guardan.
function htmlTarjeta(t, { id, elegida, volteada, bloqueada }) {
  const ult = t.ultimos4 || '••••';
  const voltear = bloqueada ? '<span class="tv-estado">Bloqueada</span>' : `<span class="tv-voltear">${ic('repetir')}</span>`;
  const clases = `tarjeta-visual${t.emisor === 'davivienda' ? ' dv' : ''}${elegida ? ' elegida' : ''}${volteada ? ' volteada' : ''}${bloqueada ? ' bloqueada' : ''}`;
  const caras = t.emisor === 'davivienda' ? `
        <span class="tv-cara tv-frente">
          ${svgCasa}
          <span class="dv-nombre">DAVIVIENDA</span>
          <span class="dv-credito">CRÉDITO</span>
          ${svgOnda}
          ${svgChip}
          <span class="dv-black">black</span>
          <span class="dv-numero"><span>••••</span><span>••••</span><span>••••</span><span>${esc(ult)}</span></span>
          <span class="dv-vence"><small>VALID<br>THRU</small><b>${esc(t.vencimiento || '--/--')}</b></span>
          <span class="dv-titular">${esc(t.titular || '')}</span>
          <span class="dv-mc"><span class="dv-circulos"><i></i><i></i></span><small>mastercard.</small></span>
          ${voltear}
        </span>
        <span class="tv-cara tv-reverso">
          <span class="dv-banda"></span>
          <span class="dv-firma"><span>${esc(ult)}</span></span>
          <span class="dv-legal">Esta tarjeta es propiedad de Banco Davivienda. Su uso está sujeto a las condiciones del contrato. En caso de pérdida o robo, repórtala de inmediato a tu banco.</span>
          <span class="dv-mc dv-mc-reverso"><span class="dv-circulos"><i></i><i></i></span></span>
        </span>` : `
        <span class="tv-cara tv-frente">
          <span class="tv-chip"></span>
          ${svgOnda}
          <span class="tv-logo"><span><span class="tv-rombo"></span>siman</span><small>CREDISIMAN</small></span>
          <span class="tv-numero">${t.ultimos4 ? `•••• ${esc(t.ultimos4)}` : ''}</span>
          <span class="tv-marca">VISA</span>
          ${voltear}
        </span>
        <span class="tv-cara tv-reverso">
          <span class="tv-banda"></span>
          <span class="tv-vertical">Use of this card is subject to the cardmember agreement.</span>
          <span class="tv-legal">Esta tarjeta es propiedad de CREDISIMAN S.A. de C.V. y su utilización está sujeta a las condiciones del contrato. En caso de extravío, notifica de inmediato al (503) 2298-3777.</span>
          <span class="tv-firma"></span>
          <span class="tv-titular">${esc(t.titular || '')}</span>
          <span class="tv-miembro">MEMBER SINCE</span>
          <span class="tv-digitos">${['••••', '••••', '••••', ult].map((g) => `<span>${esc(g)}</span>`).join('')}</span>
          <span class="tv-vence"><small>EXP. DATE</small><b>${esc(t.vencimiento || '--/--')}</b></span>
        </span>`;
  return `
    <button type="button" class="${clases}" data-tarjeta="${id}" aria-pressed="${elegida}"
      aria-label="${esc(t.nombre || 'Tarjeta nueva')}${elegida ? ', toca para darle vuelta' : ''}">
      <span class="tv-giro">${caras}
      </span>
    </button>`;
}

// Datos que se están escribiendo en el formulario: la tarjeta elegida se dibuja con ellos al instante
function tarjetaDelFormulario() {
  const form = $('#form-tarjeta');
  return {
    nombre: form.nombre.value,
    emisor: form.emisor.value,
    titular: form.titular.value.trim(),
    ultimos4: /^\d{4}$/.test(form.ultimos4.value) ? form.ultimos4.value : '',
    vencimiento: /^\d{2}\/\d{2}$/.test(form.vencimiento.value) ? form.vencimiento.value : '',
  };
}

function pintarTarjetas() {
  const nueva = tarjetaEditando === null;
  const enFormulario = $('#form-tarjeta').nombre.value || !nueva ? tarjetaDelFormulario() : null;
  $('#tarjetas-fila').innerHTML = estado.tarjetas.map((t) => {
    const elegida = t.id === tarjetaEditando;
    const datos = elegida && enFormulario ? { ...t, ...enFormulario } : t;
    return htmlTarjeta(datos, { id: t.id, elegida, volteada: volteadas.has(t.id), bloqueada: t.estado === 'bloqueada' });
  }).join('')
    // Tarjeta nueva: se ve dibujada (con el tipo elegido) mientras se llena el formulario
    + (nueva ? htmlTarjeta(tarjetaDelFormulario(), { id: 'nueva', elegida: true, volteada: volteadas.has('nueva') }) : `
    <button type="button" class="tarjeta-agregar" data-tarjeta="nueva" aria-pressed="false">
      <span class="ta-mas">${ic('plus')}</span>
      <span>${estado.tarjetas.length ? 'Agregar otra tarjeta' : 'Agregar tarjeta'}</span>
    </button>`);
  $('#ayuda-tarjeta').hidden = !estado.tarjetas.length && !nueva;
}

function llenarFormTarjeta() {
  const form = $('#form-tarjeta');
  const t = estado.tarjetas.find((x) => x.id === tarjetaEditando);
  form.emisor.value = t?.emisor ?? 'credisiman';
  form.nombre.value = t?.nombre ?? '';
  form.titular.value = t?.titular ?? '';
  form.ultimos4.value = t?.ultimos4 ?? '';
  form.vencimiento.value = t?.vencimiento ?? '';
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
  const id = boton.dataset.tarjeta === 'nueva' ? null : Number(boton.dataset.tarjeta);
  // Tocar la tarjeta que ya se está editando la da vuelta (solo cambia la clase para que se vea la animación)
  if (id === tarjetaEditando && boton.classList.contains('tarjeta-visual')) {
    const clave = id ?? 'nueva';
    if (!volteadas.delete(clave)) volteadas.add(clave);
    boton.classList.toggle('volteada', volteadas.has(clave));
    return;
  }
  tarjetaEditando = id;
  llenarFormTarjeta();
  pintarTarjetas();
  if (tarjetaEditando === null) $('#form-tarjeta').nombre.focus();
});

// Al cambiar el tipo, el nombre sugerido sigue al tipo (si no se escribió otro)
const NOMBRES_TIPO = { credisiman: 'Credisiman Visa', davivienda: 'Davivienda Black' };
$('#form-tarjeta').addEventListener('change', (e) => {
  if (e.target.name !== 'emisor') return;
  const nombre = $('#form-tarjeta').nombre;
  if (!nombre.value || Object.values(NOMBRES_TIPO).includes(nombre.value)) nombre.value = NOMBRES_TIPO[e.target.value];
  pintarTarjetas();
});
// Lo que se escribe (titular, últimos 4, vencimiento) aparece en el dibujo al instante
$('#form-tarjeta').addEventListener('input', (e) => {
  if (['titular', 'ultimos4', 'vencimiento', 'nombre'].includes(e.target.name)) {
    // Para ver el titular y los dígitos, la tarjeta Credisiman se muestra por el reverso
    const clave = tarjetaEditando ?? 'nueva';
    if (['titular', 'ultimos4'].includes(e.target.name) && $('#form-tarjeta').emisor.value === 'credisiman') volteadas.add(clave);
    requestAnimationFrame(pintarTarjetas);
  }
});

// Escribe la barra del vencimiento sola: "0429" -> "04/29"
$('#form-tarjeta').vencimiento.addEventListener('input', (e) => {
  const d = e.target.value.replace(/\D/g, '').slice(0, 4);
  e.target.value = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
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
