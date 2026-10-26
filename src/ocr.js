import fs from 'node:fs';
import path from 'node:path';
import { createWorker } from 'tesseract.js';
import { extraerDatos } from '../public/extraer.js';

// El modelo de español se descarga la primera vez (necesita internet) y queda guardado aquí.
// Tesseract no crea la carpeta: si no existe, vuelve a descargar el modelo en cada arranque.
const CACHE = path.resolve('data', 'tesseract');
fs.mkdirSync(CACHE, { recursive: true });

// Si la lectura tarda más que esto (p. ej. red lenta al descargar el modelo), el usuario llena los datos a mano
const TIEMPO_MAXIMO = 45000;

let workerPromesa = null;
const obtenerWorker = () => {
  workerPromesa ??= createWorker('spa', 1, {
    cachePath: CACHE,
    // Sin esto, un fallo (p. ej. sin internet al descargar el modelo) tumba todo el servidor.
    // El error igual llega como promesa rechazada y se maneja en la ruta.
    errorHandler: () => {},
  }).catch((err) => {
    workerPromesa = null;
    throw err;
  });
  return workerPromesa;
};

// Líneas con su alto en la foto: el nombre del comercio suele estar en la letra más grande
function lineasConAlto(data) {
  const lineas = [];
  for (const bloque of data.blocks || []) {
    for (const parrafo of bloque.paragraphs || []) {
      for (const linea of parrafo.lines || []) {
        const texto = linea.text.trim();
        if (texto) lineas.push({ texto, alto: linea.bbox.y1 - linea.bbox.y0, confianza: linea.confidence });
      }
    }
  }
  return lineas;
}

// conocidos: comercios que ya se registraron, para corregir lo que el OCR lea con errores
export async function leerFactura(imagen, conocidos = []) {
  let temporizador;
  const limite = new Promise((_, reject) => {
    temporizador = setTimeout(() => reject(new Error('La lectura de la factura tardó demasiado')), TIEMPO_MAXIMO);
  });
  try {
    // rotateAuto endereza fotos un poco giradas; blocks devuelve cada línea con su tamaño
    const { data } = await Promise.race([
      obtenerWorker().then((w) => w.recognize(imagen, { rotateAuto: true }, { text: true, blocks: true })),
      limite,
    ]);
    const texto = data.text.trim();
    return { texto, ...extraerDatos(texto, { lineas: lineasConAlto(data), conocidos }) };
  } catch (err) {
    // Si el lector quedó a medio iniciar, se descarta para que el próximo intento empiece de cero
    const pendiente = workerPromesa;
    workerPromesa = null;
    pendiente?.then((w) => w.terminate()).catch(() => {});
    throw err;
  } finally {
    clearTimeout(temporizador);
  }
}
