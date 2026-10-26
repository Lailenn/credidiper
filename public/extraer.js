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

  return { comercio, fecha, monto };
}
