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

  // 1) Orientación: se lee rápido en tamaño pequeño tal como viene; si no parece una factura legible,
  //    se prueba girada 90° a cada lado y de cabeza, y se queda con la que mejor se lee
  let grados = 0;
  fase('Revisando la orientación…', 0, 25);
  const derecha = await worker.recognize(mejorarParaLeer(dibujar(bitmap, 0, LADO_PRUEBA, papel)));
  let mejor = puntuar(derecha.data);
  if (derecha.data.confidence < 70 || mejor < 85) {
    const opciones = [90, 270, 180];
    for (const [i, g] of opciones.entries()) {
      fase('Girando la foto para leerla mejor…', 25 + i * 15, 40 + i * 15);
      const prueba = await worker.recognize(mejorarParaLeer(dibujar(bitmap, g, LADO_PRUEBA, papel)));
      const puntos = puntuar(prueba.data);
      if (puntos > mejor + 5) { mejor = puntos; grados = g; }
    }
  }

  // 2) Lectura completa en buena resolución y con la orientación elegida
  fase('Leyendo la factura…', 70, 100);
  let { data } = await worker.recognize(
    mejorarParaLeer(dibujar(bitmap, grados, LADO_LECTURA, papel)), {}, { text: true, blocks: true },
  );
  // Si con el recorte casi no se leyó nada, se intenta con la foto completa
  if (papel && data.text.trim().length < 20) {
    ({ data } = await worker.recognize(mejorarParaLeer(dibujar(bitmap, grados, LADO_LECTURA)), {}, { text: true, blocks: true }));
  }
  alProgresar = null;

  const foto = await aBlob(dibujar(bitmap, grados, LADO_GUARDAR, papel));
  bitmap.close?.();
  return { texto: data.text.trim(), lineas: lineasConAlto(data), foto, grados };
}
