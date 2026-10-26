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

export async function leerFactura(imagen) {
  let temporizador;
  const limite = new Promise((_, reject) => {
    temporizador = setTimeout(() => reject(new Error('La lectura de la factura tardó demasiado')), TIEMPO_MAXIMO);
  });
  try {
    const { data } = await Promise.race([obtenerWorker().then((w) => w.recognize(imagen)), limite]);
    const texto = data.text.trim();
    return { texto, ...extraerDatos(texto) };
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
