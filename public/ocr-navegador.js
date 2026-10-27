// Lectura de facturas en el propio teléfono o computadora (mucho más rápida que en el servidor gratuito).
// El modelo de español se descarga una sola vez y el navegador lo guarda.
const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';
const LADO_LECTURA = 2000; // px del lado largo para leer
const LADO_PRUEBA = 1000; // px para probar orientaciones rápido
const LADO_GUARDAR = 1600; // px de la foto que se guarda

let workerPromesa = null;
let alProgresar = null;

function cargarScript() {
  if (window.Tesseract) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TESSERACT_URL;
    s.onload = resolve;
    s.onerror = () => reject(new Error('No se pudo cargar el lector de facturas'));
    document.head.append(s);
  });
}

function obtenerWorker() {
  workerPromesa ??= cargarScript()
    .then(() => window.Tesseract.createWorker('spa', 1, {
      logger: (m) => alProgresar?.(m),
    }))
    .catch((err) => {
      workerPromesa = null;
      throw err;
    });
  return workerPromesa;
}

// Dibuja la zona "recorte" de la imagen girada (0, 90, 180 o 270 grados) y escalada a "lado" px en su lado largo
function dibujar(bitmap, grados, lado, recorte) {
  const r = recorte || { x: 0, y: 0, w: bitmap.width, h: bitmap.height };
  const escala = Math.min(1.6, lado / Math.max(r.w, r.h)); // amplía un poco si el papel quedó pequeño
  const w = Math.round(r.w * escala);
  const h = Math.round(r.h * escala);
  const girada = grados % 180 !== 0;
  const canvas = document.createElement('canvas');
  canvas.width = girada ? h : w;
  canvas.height = girada ? w : h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((grados * Math.PI) / 180);
  ctx.drawImage(bitmap, r.x, r.y, r.w, r.h, -w / 2, -h / 2, w, h);
  return canvas;
}

// Busca el papel de la factura (la zona clara más grande) para leer solo esa parte.
// Cuenta, en una miniatura, cuántos píxeles claros tiene cada fila y cada columna.
function buscarPapel(bitmap) {
  const lado = 400;
  const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * escala));
  const h = Math.max(1, Math.round(bitmap.height * escala));
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const gris = new Uint8Array(w * h);
  const histograma = new Uint32Array(256);
  for (let i = 0; i < gris.length; i++) {
    gris[i] = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000;
    histograma[gris[i]]++;
  }
  // Umbral de "claro": el punto medio entre la mediana y el 5% más claro
  let acumulado = 0;
  let mediana = 128;
  let claro = 255;
  for (let v = 0; v < 256; v++) {
    acumulado += histograma[v];
    if (acumulado >= gris.length * 0.5 && mediana === 128) mediana = v;
    if (acumulado >= gris.length * 0.95) { claro = v; break; }
  }
  const umbral = (mediana + claro) / 2;
  if (claro - mediana < 25) return null; // poco contraste: la foto probablemente ya es solo la factura

  const tramo = (cuentas, minimo) => {
    // El tramo continuo más largo de filas/columnas con suficientes píxeles claros (tolera huecos cortos)
    let mejor = null;
    let inicio = -1;
    let huecos = 0;
    for (let i = 0; i <= cuentas.length; i++) {
      const sirve = i < cuentas.length && cuentas[i] >= minimo;
      if (sirve) { if (inicio < 0) inicio = i; huecos = 0; } else if (inicio >= 0 && (++huecos > 3 || i === cuentas.length)) {
        const fin = i - huecos;
        if (!mejor || fin - inicio > mejor[1] - mejor[0]) mejor = [inicio, fin];
        inicio = -1;
        huecos = 0;
      }
    }
    return mejor;
  };
  const filas = new Uint32Array(h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (gris[y * w + x] >= umbral) filas[y]++;
  const rangoY = tramo(filas, w * 0.12);
  if (!rangoY) return null;
  const columnas = new Uint32Array(w);
  for (let y = rangoY[0]; y <= rangoY[1]; y++) for (let x = 0; x < w; x++) if (gris[y * w + x] >= umbral) columnas[x]++;
  const rangoX = tramo(columnas, (rangoY[1] - rangoY[0]) * 0.3);
  if (!rangoX) return null;

  const margen = 0.03;
  const x0 = Math.max(0, rangoX[0] / w - margen);
  const x1 = Math.min(1, (rangoX[1] + 1) / w + margen);
  const y0 = Math.max(0, rangoY[0] / h - margen);
  const y1 = Math.min(1, (rangoY[1] + 1) / h + margen);
  const area = (x1 - x0) * (y1 - y0);
  if (area > 0.85 || area < 0.04) return null; // casi toda la foto ya es papel, o lo encontrado es muy pequeño
  return {
    x: Math.round(x0 * bitmap.width), y: Math.round(y0 * bitmap.height),
    w: Math.round((x1 - x0) * bitmap.width), h: Math.round((y1 - y0) * bitmap.height),
  };
}

// Blanco y negro con más contraste (estira los grises entre el 2% más oscuro y el 2% más claro)
function mejorarParaLeer(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imagen = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imagen.data;
  const histograma = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const gris = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    d[i] = gris;
    histograma[gris | 0]++;
  }
  const total = d.length / 4;
  let acumulado = 0;
  let bajo = 0;
  let alto = 255;
  for (let v = 0; v < 256; v++) { acumulado += histograma[v]; if (acumulado > total * 0.02) { bajo = v; break; } }
  acumulado = 0;
  for (let v = 255; v >= 0; v--) { acumulado += histograma[v]; if (acumulado > total * 0.02) { alto = v; break; } }
  const rango = Math.max(1, alto - bajo);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i] - bajo) * 255) / rango));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(imagen, 0, 0);
  return canvas;
}

// Qué tan "legible como factura" quedó un texto: confianza del OCR y montos encontrados
function puntuar(data) {
  const montos = (data.text.match(/\d[.,]\d{2}(?!\d)/g) || []).length;
  const palabras = (data.text.match(/\p{L}{3,}/gu) || []).length;
  return data.confidence + Math.min(montos, 10) * 3 + Math.min(palabras, 40) * 0.5;
}

function lineasConAlto(data) {
  const lineas = [];
  for (const bloque of data.blocks || []) {
    for (const parrafo of bloque.paragraphs || []) {
      for (const linea of parrafo.lines || []) {
        const texto = linea.text.trim();
        if (texto) lineas.push({ texto, alto: linea.bbox.y1 - linea.bbox.y0 });
      }
    }
  }
  return lineas;
}

const aBlob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));

// Empieza a descargar/preparar el lector antes de que haya foto (al abrir "Registrar gasto")
export function precargarLector() {
  obtenerWorker().catch(() => {});
}

// Adivina si el texto corre horizontal o vertical sin leerlo (instantáneo). Se revisa la foto por parches:
// en cada parche con papel y algo de tinta, las líneas de texto dejan filas vacías entre renglones si el
// texto es horizontal, o columnas vacías si es vertical. Se suman los votos con varios tamaños de parche
// (la letra puede verse grande o pequeña). Devuelve 0 (horizontal) o 90 (vertical) y si el resultado es claro.
function direccionDelTexto(bitmap) {
  let horizontal = 0;
  let vertical = 0;
  for (const [lado, parches] of [[800, [24]], [1000, [24, 32, 48]]]) {
    const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * escala);
    const h = Math.round(bitmap.height * escala);
    const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    const gris = new Uint8Array(w * h);
    for (let i = 0; i < gris.length; i++) gris[i] = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000;
    for (const T of parches) {
      const filas = new Uint16Array(T);
      const columnas = new Uint16Array(T);
      for (let ty = 0; ty + T <= h; ty += T) {
        for (let tx = 0; tx + T <= w; tx += T) {
          let max = 0;
          let min = 255;
          for (let y = ty; y < ty + T; y++) {
            for (let x = tx; x < tx + T; x++) { const v = gris[y * w + x]; if (v > max) max = v; if (v < min) min = v; }
          }
          if (max < 120 || max - min < 60) continue; // sin papel claro o sin tinta
          const umbral = (max + min) / 2;
          filas.fill(0);
          columnas.fill(0);
          let tinta = 0;
          for (let y = 0; y < T; y++) {
            for (let x = 0; x < T; x++) {
              if (gris[(ty + y) * w + tx + x] < umbral) { filas[y]++; columnas[x]++; tinta++; }
            }
          }
          if (tinta < T * T * 0.04 || tinta > T * T * 0.35) continue; // casi vacío o mancha (no es texto)
          let filasVacias = 0;
          let columnasVacias = 0;
          for (let i = 0; i < T; i++) { if (!filas[i]) filasVacias++; if (!columnas[i]) columnasVacias++; }
          if (filasVacias > columnasVacias * 1.5 + 1) horizontal++;
          else if (columnasVacias > filasVacias * 1.5 + 1) vertical++;
        }
      }
    }
  }
  const mayor = Math.max(horizontal, vertical);
  const menor = Math.min(horizontal, vertical);
  return { grados: vertical > horizontal ? 90 : 0, seguro: mayor >= 30 && mayor >= menor * 2 };
}

const leerCompleto = (worker, bitmap, grados, recorte) =>
  worker.recognize(mejorarParaLeer(dibujar(bitmap, grados, LADO_LECTURA, recorte)), {}, { text: true, blocks: true });
// Lectura buena: el OCR confía y encontró montos (una factura siempre tiene)
const esBuena = (data) => data.confidence >= 60 && (data.text.match(/\d[.,]\d{2}(?!\d)/g) || []).length >= 2;

// Devuelve el texto leído, las líneas con su tamaño y la foto ya derecha (para guardarla)
export async function leerEnNavegador(archivo, progreso) {
  const bitmap = await createImageBitmap(archivo);
  const fase = (texto, desde, hasta) => {
    alProgresar = (m) => {
      if (m.status === 'recognizing text') progreso?.(texto, Math.round(desde + m.progress * (hasta - desde)));
    };
  };
  progreso?.('Preparando el lector…', 0);
  alProgresar = (m) => { if (m.status?.includes('loading')) progreso?.('Descargando el lector (solo la primera vez)…', 0); };
  const worker = await obtenerWorker();

  // 0) Si la factura ocupa solo una parte de la foto (mesa, teclado alrededor), se recorta el papel
  const papel = buscarPapel(bitmap);

  // 1) Dirección del texto (horizontal o vertical) analizando la imagen: instantáneo, sin leer
  const direccion = direccionDelTexto(bitmap);
  let grados = direccion.grados;

  // 2) Lectura completa en esa dirección. Casi siempre basta con esta sola lectura.
  fase('Leyendo la factura…', 0, 100);
  let { data } = await leerCompleto(worker, bitmap, grados, papel);

  // 3) Si no salió bien, la foto puede estar de cabeza (o la dirección no era clara): se prueban
  //    los otros giros en tamaño pequeño (rápido) y se vuelve a leer solo si alguno es mejor
  if (!esBuena(data) && direccion.seguro) {
    // La dirección es clara, así que solo puede estar de cabeza: se lee directo girada 180°
    fase('Girando la foto para leerla mejor…', 0, 100);
    const girada = await leerCompleto(worker, bitmap, (grados + 180) % 360, papel);
    if (puntuar(girada.data) > puntuar(data)) { data = girada.data; grados = (grados + 180) % 360; }
  } else if (!esBuena(data)) {
    const candidatos = [grados + 180, grados + 90, grados + 270];
    let mejor = { puntos: puntuar(data), grados };
    for (const [i, g] of candidatos.map((x) => x % 360).entries()) {
      fase('Girando la foto para leerla mejor…', (i * 100) / (candidatos.length + 1), ((i + 1) * 100) / (candidatos.length + 1));
      const prueba = await worker.recognize(mejorarParaLeer(dibujar(bitmap, g, LADO_PRUEBA, papel)));
      const puntos = puntuar(prueba.data) + 8; // compensa que en tamaño pequeño se lee algo peor
      if (puntos > mejor.puntos) mejor = { puntos, grados: g };
    }
    if (mejor.grados !== grados) {
      grados = mejor.grados;
      fase('Leyendo la factura…', 70, 100);
      ({ data } = await leerCompleto(worker, bitmap, grados, papel));
    }
  }
  // Si con el recorte casi no se leyó nada, se intenta con la foto completa
  if (papel && data.text.trim().length < 20) {
    ({ data } = await leerCompleto(worker, bitmap, grados));
  }
  alProgresar = null;

  const foto = await aBlob(dibujar(bitmap, grados, LADO_GUARDAR, papel));
  bitmap.close?.();
  return { texto: data.text.trim(), lineas: lineasConAlto(data), foto, grados };
}
