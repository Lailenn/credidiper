// Extrae comercio, fecha y total del texto leído por el OCR.
// Lo usan el servidor (src/ocr.js) y el modo demostración del navegador (demo.js).

const MONTO = /(\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2})(?!\d)/g;

// El último separador es el decimal; los demás son de miles
const aNumero = (s) => {
  const limpio = s.replace(/\s/g, '');
  return Number(limpio.slice(0, -3).replace(/[.,]/g, '') + '.' + limpio.slice(-2));
};

export function extraerDatos(texto) {
  const lineas = texto.split('\n').map((l) => l.trim()).filter(Boolean);

  // Comercio: la primera línea del encabezado que parezca un nombre (letras, sin NIT ni teléfono)
  const comercioLinea = lineas.slice(0, 5).find((l) =>
    /[a-záéíóúñ]{3}/i.test(l) && !/\b(nit|nrc|ruc|tel|fecha|factura|ticket|caja)\b/i.test(l) && (l.match(/\d/g) || []).length < 4);
  const comercio = comercioLinea
    ? comercioLinea.replace(/[^\p{L}\p{N}&.' -]/gu, '').replace(/\s+/g, ' ').trim()
        .toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase())
    : '';

  // Fecha: dd/mm/aaaa (formato de El Salvador) o aaaa-mm-dd
  let fecha = '';
  const iso = texto.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  const local = texto.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/);
  if (iso) fecha = `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  else if (local) {
    const anio = local[3].length === 2 ? `20${local[3]}` : local[3];
    fecha = `${anio}-${local[2].padStart(2, '0')}-${local[1].padStart(2, '0')}`;
  }
  if (fecha && Number.isNaN(Date.parse(fecha))) fecha = '';

  // Total: la línea que dice TOTAL (no SUBTOTAL); si no hay, el monto más alto de la factura
  let monto = null;
  const lineaTotal = lineas.find((l) => /\btotal\b/i.test(l) && !/sub\s*-?\s*total/i.test(l) && l.match(MONTO));
  if (lineaTotal) {
    const montos = lineaTotal.match(MONTO);
    monto = aNumero(montos[montos.length - 1]);
  } else {
    const todos = (texto.match(MONTO) || []).map(aNumero).filter((n) => n > 0);
    if (todos.length) monto = Math.max(...todos);
  }

  // Subtotal e impuesto (IVA), si aparecen
  const montoDeLinea = (patron) => {
    const linea = lineas.find((l) => patron.test(l) && l.match(MONTO));
    if (!linea) return null;
    const montos = linea.match(MONTO);
    return aNumero(montos[montos.length - 1]);
  };
  const subtotal = montoDeLinea(/sub\s*-?\s*total/i);
  const impuesto = montoDeLinea(/\b(iva|tax|impuesto|sale\s*tax)\b/i);

  return { comercio, fecha, monto, subtotal, impuesto, items: extraerItems(lineas) };
}

// Productos: líneas "[cantidad] descripción $precio" (p. ej. "2 CAESAR SALAD $23.38" o "PAN $1.20")
const LINEA_ITEM = /^(?:(\d{1,3})\s*[xX]?\s+)?(.+?)\s+\$?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})$/;
const NO_ES_ITEM = /total|sub\s*-?\s*total|\biva\b|\btax\b|impuesto|efectivo|cambio|vuelto|tarjeta|visa|mastercard|pago|descuento|propina|amount|saldo/i;

function extraerItems(lineas) {
  const items = [];
  for (const linea of lineas) {
    const m = linea.replace(/\s+/g, ' ').match(LINEA_ITEM);
    if (!m || NO_ES_ITEM.test(linea)) continue;
    const descripcion = m[2].replace(/[^\p{L}\p{N}&.,%/' -]/gu, '').trim();
    if ((descripcion.match(/\p{L}/gu) || []).length < 2) continue;
    items.push({
      cantidad: m[1] ? Number(m[1]) : 1,
      descripcion: descripcion.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase()),
      precio: aNumero(m[3]),
    });
  }
  return items.slice(0, 40);
}
