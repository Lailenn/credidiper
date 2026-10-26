// Extrae comercio, fecha, total, productos, subtotal e impuesto del texto leído por el OCR.
// Lo usan el servidor (src/ocr.js) y el navegador (detalle de un gasto).
//
// opciones.lineas:    [{ texto, alto }] con el alto de cada línea en la foto (el nombre del comercio suele ser lo más grande)
// opciones.conocidos: nombres de comercios ya registrados; si lo leído se parece a uno, se usa ese nombre

// Comercios frecuentes en El Salvador (se suman a los que la persona ya registró)
const COMERCIOS_SV = [
  'Super Selectos', 'Walmart', 'La Despensa de Don Juan', 'Maxi Despensa', 'Despensa Familiar', 'PriceSmart',
  'Siman', 'La Curacao', 'Prado', 'Almacenes Tropigas', 'Omnisport', 'Adoc', 'Payless', 'Freund', 'Vidrí', 'EPA',
  'Farmacias San Nicolás', 'Farmacias Económicas', 'Farmacia Camila', 'Farmacias Brasil', 'Farmacia UNO',
  'Texaco', 'Puma', 'Shell', 'UNO', 'Pollo Campero', 'Pizza Hut', "McDonald's", 'Burger King', "Wendy's",
  'Starbucks', "Domino's Pizza", 'Little Caesars', 'Subway', 'KFC', 'Pollo Campestre', 'Biggest', 'Pops',
  'Sarita', 'Mister Donut', 'Taco Bell', 'Claro', 'Tigo', 'Digicel', 'Movistar', 'CAESS', 'ANDA',
  'Super Repuestos', 'Office Depot', 'Pricemart', 'Cinemark', 'Multiplaza', 'Metrocentro',
];

const MESES = {
  ene: 1, enero: 1, jan: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4, apr: 4, may: 5, mayo: 5,
  jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8, aug: 8, sep: 9, sept: 9, set: 9, septiembre: 9,
  setiembre: 9, oct: 10, octubre: 10, nov: 11, noviembre: 11, dic: 12, diciembre: 12, dec: 12,
};

const MONTO = /(\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2})(?!\d)/g;
const SUFIJOS_LEGALES = /\b(s\.?\s?a\.?\s?(de\s+)?c\.?\s?v\.?|s\.?\s?a\.?|de\s+c\.?\s?v\.?|ltda?\.?|inc\.?|s\.?\s?de\s+r\.?\s?l\.?)\s*$/i;
const NO_ES_NOMBRE = /\b(nit|nrc|ruc|dui|tel[eé]fono|tel|fax|fecha|factura|ticket|tiquete|caja|cajero|sucursal|direcci[oó]n|col\.?|colonia|calle|avenida|av\.|km|blvd|bulevar|c\.c\.|centro comercial|www|http|@|correo|resoluci[oó]n|serie|autoriza|cliente|giro|dte|c[oó]digo|n[uú]mero|control)\b/i;
const NO_ES_ITEM = /total|sub\s*-?\s*total|sumas?\b|\biva\b|\btax\b|impuesto|efectivo|cambio|vuelto|tarjeta|visa|mastercard|pago|descuento|propina|amount|saldo|exent|gravad|retenci|fovial|cotrans|redondeo/i;

const sinAcentos = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const normalizar = (s) => sinAcentos(s).toUpperCase().replace(/[^A-Z0-9&]+/g, ' ').trim();
const tituloLegible = (s) => s.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (c) => c.toUpperCase()).replace(/'S\b/g, "'s");

// Errores típicos del OCR dentro de los números: O→0, l/I→1, S→5, B→8 y espacios alrededor del punto decimal
function limpiarLinea(linea) {
  return linea
    .replace(/(\d)\s*([.,])\s*(\d{2})(?!\d)/g, '$1$2$3')
    .replace(/(?<=[\d$.,])[Oo](?=[\d.,]|\b)/g, '0')
    .replace(/(?<=[\d.,])[Oo]/g, '0')
    .replace(/(?<=\d[.,]\d?)[Ss](?!\w)/g, '5')
    .replace(/(?<=[\d$])[lI|](?=\d|[.,]\d)/g, '1')
    .replace(/(?<=\d[.,])[lI|](?=\d)/g, '1')
    .replace(/(?<=\$\s?)[Ss](?=\d)/g, '5')
    .replace(/\$\s+(?=\d)/g, '$');
}

// El último separador es el decimal; los demás son de miles
const aNumero = (s) => {
  const limpio = s.replace(/\s/g, '');
  return Number(limpio.slice(0, -3).replace(/[.,]/g, '') + '.' + limpio.slice(-2));
};
const montosDe = (linea) => (linea.match(MONTO) || []).map(aNumero).filter((n) => n > 0 && n < 100000);
const ultimoMonto = (linea) => { const m = montosDe(linea); return m.length ? m[m.length - 1] : null; };
const cerca = (a, b) => a != null && b != null && Math.abs(a - b) <= Math.max(0.02, b * 0.005);

// Parecido entre dos textos (0 a 1) con la distancia de Levenshtein
function parecido(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const m = a.length;
  const n = b.length;
  let previa = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const actual = [i];
    for (let j = 1; j <= n; j++) {
      actual[j] = Math.min(previa[j] + 1, actual[j - 1] + 1, previa[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previa = actual;
  }
  return 1 - previa[n] / Math.max(m, n);
}

// ---------- Comercio ----------
function buscarConocido(lineas, conocidos) {
  const candidatos = [...new Set([...conocidos, ...COMERCIOS_SV])]
    .map((nombre) => ({ nombre, clave: normalizar(nombre) }))
    .filter((c) => c.clave.length >= 3);
  const encabezado = lineas.slice(0, 8).map(normalizar).filter(Boolean);
  let mejor = null;
  for (const [posicion, linea] of encabezado.entries()) {
    const sinSufijo = normalizar(linea.replace(SUFIJOS_LEGALES, ''));
    for (const c of candidatos) {
      // Coincidencia exacta como palabra completa dentro de la línea, o parecido alto con la línea completa
      const contiene = c.clave.length >= 4 && ` ${sinSufijo} `.includes(` ${c.clave} `);
      const puntaje = Math.max(contiene ? 0.97 : 0, parecido(sinSufijo, c.clave), parecido(linea, c.clave))
        - posicion * 0.01; // a igualdad, gana lo que está más arriba
      if (puntaje >= 0.78 && (!mejor || puntaje > mejor.puntaje)) mejor = { nombre: c.nombre, puntaje };
    }
  }
  return mejor?.nombre || '';
}

function limpiarNombre(linea) {
  return tituloLegible(
    linea.replace(SUFIJOS_LEGALES, '').replace(/[^\p{L}\p{N}&.' -]/gu, ' ').replace(/\s+/g, ' ').trim().replace(/[.,-]+$/, ''),
  );
}

const TIENE_MONTO = /\d[.,]\d{2}(?!\d)/;
const pareceNombre = (l) => /\p{L}{3}/u.test(l) && !NO_ES_NOMBRE.test(l)
  && (l.match(/\d/g) || []).length < 4 && !TIENE_MONTO.test(l) && l.replace(/[^\p{L}]/gu, '').length >= 3;

function extraerComercio(lineas, opciones) {
  const conocido = buscarConocido(lineas, opciones.conocidos || []);
  if (conocido) return conocido;

  // Facturas electrónicas: "Nombre comercial: ..."
  for (const linea of lineas.slice(0, 15)) {
    const m = linea.match(/nombre\s+comercial\s*[:.-]?\s*(.+)$/i);
    if (m && pareceNombre(m[1])) return limpiarNombre(m[1]);
  }

  // La línea con letra más grande en la parte de arriba
  if (opciones.lineas?.length) {
    const arriba = opciones.lineas.slice(0, Math.max(4, Math.ceil(opciones.lineas.length * 0.35)))
      .filter((l) => pareceNombre(l.texto.trim()));
    const masGrande = arriba.sort((a, b) => b.alto - a.alto)[0];
    if (masGrande) return limpiarNombre(masGrande.texto);
  }

  const primera = lineas.slice(0, 6).find((l) => pareceNombre(l));
  return primera ? limpiarNombre(primera) : '';
}

// ---------- Fecha ----------
function fechaValida(anio, mes, dia) {
  const a = anio < 100 ? 2000 + anio : anio;
  if (a < 2000 || a > 2100 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return '';
  const iso = `${a}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  const d = new Date(`${iso}T00:00:00`);
  return d.getMonth() + 1 === mes ? iso : '';
}

function fechasDe(linea) {
  const encontradas = [];
  const l = sinAcentos(linea.toLowerCase());
  for (const m of l.matchAll(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) encontradas.push(fechaValida(+m[1], +m[2], +m[3]));
  for (const m of l.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/g)) {
    // Formato de El Salvador: día/mes/año. Si el "mes" pasa de 12, es formato mes/día/año.
    encontradas.push(+m[2] > 12 ? fechaValida(+m[3], +m[1], +m[2]) : fechaValida(+m[3], +m[2], +m[1]));
  }
  for (const m of l.matchAll(/\b(\d{1,2})\s*(?:de\s+|[-/. ])?([a-z]{3,10})\.?\s*(?:de\s+|del\s+|[-/. ,])?\s*(\d{4}|\d{2})\b/g)) {
    if (MESES[m[2]]) encontradas.push(fechaValida(+m[3], MESES[m[2]], +m[1]));
  }
  for (const m of l.matchAll(/\b([a-z]{3,10})\.?\s+(\d{1,2}),?\s+(\d{4})\b/g)) {
    if (MESES[m[1]]) encontradas.push(fechaValida(+m[3], MESES[m[1]], +m[2]));
  }
  return encontradas.filter(Boolean);
}

function extraerFecha(lineas) {
  // Primero las líneas que dicen "fecha" o "emisión"; luego cualquier fecha del texto
  const etiquetadas = lineas.filter((l) => /fecha|emisi[oó]n|date/i.test(l)).flatMap(fechasDe);
  const todas = etiquetadas.length ? etiquetadas : lineas.flatMap(fechasDe);
  const hoy = new Date();
  hoy.setDate(hoy.getDate() + 1);
  const limite = hoy.toISOString().slice(0, 10);
  return todas.find((f) => f <= limite) || todas[0] || '';
}

// ---------- Productos ----------
const LINEA_ITEM = /^(?:(\d{1,3})\s*[xX*]?\s+)?(.+?)\s+\$?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})$/;

function extraerItems(lineas) {
  const items = [];
  for (const linea of lineas) {
    const texto = linea.replace(/\s+/g, ' ').replace(/\s+[A-Z]$/, ''); // quita marcas finales como " G" o " E"
    const m = texto.match(LINEA_ITEM);
    if (!m || NO_ES_ITEM.test(texto) || fechasDe(texto).length) continue;
    // Quita un precio unitario al inicio ("4.50 TORNILLOS" en "2 x 4.50 TORNILLOS $9.00")
    let descripcion = m[2].replace(/^\d+[.,]\d{2}\s+/, '').replace(/[^\p{L}\p{N}&.,%/' -]/gu, '').trim();
    let cantidad = m[1] ? Number(m[1]) : 1;
    // "2 x 1.50" dentro de la descripción: cantidad y precio unitario
    const unidad = descripcion.match(/^(.*?)\s*(\d{1,3})\s*[xX*]\s*\d+[.,]\d{2}$/);
    if (unidad) {
      descripcion = unidad[1].trim();
      cantidad = Number(unidad[2]);
    }
    if ((descripcion.match(/\p{L}/gu) || []).length < 2) continue;
    items.push({ cantidad, descripcion: tituloLegible(descripcion), precio: aNumero(m[3]) });
  }
  return items.slice(0, 40);
}

// ---------- Totales ----------
function extraerTotales(lineas, items) {
  const montoDeLinea = (patron, excluir) => {
    const linea = lineas.find((l) => patron.test(l) && (!excluir || !excluir.test(l)) && montosDe(l).length);
    return linea ? ultimoMonto(linea) : null;
  };
  const subtotal = montoDeLinea(/sub\s*-?\s*total|\bsumas?\b|venta[s]?\s+gravada/i);
  const impuesto = montoDeLinea(/\b(iva|tax|impuesto|sale\s*tax)\b/i, /sin\s+iva|exent/i);
  const sumaItems = items.length ? Math.round(items.reduce((s, it) => s + it.precio, 0) * 100) / 100 : null;

  // Candidatos con puntaje según la etiqueta de la línea
  const candidatos = [];
  lineas.forEach((linea, i) => {
    const monto = ultimoMonto(linea);
    if (monto == null || /efectivo|cambio|vuelto|recibido|pag[oó]\s+con|tarjeta|visa|master/i.test(linea)) return;
    let puntaje = 0;
    if (/total\s*(a\s*)?pagar|gran\s*total|total\s*venta|venta\s*total|monto\s*total|total\s*usd|total\s*\$/i.test(linea)) puntaje = 100;
    else if (/\btotal\b/i.test(linea) && !/sub\s*-?\s*total|total\s*(de\s*)?(items|art[ií]culos|productos|unidades)/i.test(linea)) puntaje = 85;
    else if (/\b(importe|amount|monto|a\s*pagar|neto)\b/i.test(linea)) puntaje = 60;
    else return;
    if (subtotal != null && impuesto != null && cerca(monto, subtotal + impuesto)) puntaje += 25;
    if (sumaItems != null && cerca(monto, sumaItems)) puntaje += 15;
    if (subtotal != null && cerca(monto, subtotal) && impuesto) puntaje -= 20; // es el subtotal, no el total
    candidatos.push({ monto, puntaje: puntaje + i * 0.01 }); // a igualdad, el que está más abajo
  });
  candidatos.sort((a, b) => b.puntaje - a.puntaje);
  let monto = candidatos[0]?.monto ?? null;

  if (monto == null) {
    if (subtotal != null && impuesto != null) monto = Math.round((subtotal + impuesto) * 100) / 100;
    else if (sumaItems != null) monto = sumaItems;
    else {
      // Último recurso: el monto más alto, sin contar efectivo entregado ni cambio
      const todos = lineas.filter((l) => !/efectivo|cambio|vuelto|recibido|pag[oó]\s+con/i.test(l)).flatMap(montosDe);
      if (todos.length) monto = Math.max(...todos);
    }
  }
  return { monto, subtotal, impuesto };
}

export function extraerDatos(texto, opciones = {}) {
  const lineas = texto.split('\n').map((l) => limpiarLinea(l.trim())).filter(Boolean);
  const items = extraerItems(lineas);
  return {
    comercio: extraerComercio(lineas, opciones),
    fecha: extraerFecha(lineas),
    ...extraerTotales(lineas, items),
    items,
  };
}
