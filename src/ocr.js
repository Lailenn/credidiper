import path from 'node:path';
import { createWorker } from 'tesseract.js';
import { extraerDatos } from '../public/extraer.js';

// El modelo de español se descarga la primera vez (necesita internet) y queda guardado en data/tesseract
let workerPromesa = null;
const obtenerWorker = () => {
  workerPromesa ??= createWorker('spa', 1, {
    cachePath: path.resolve('data', 'tesseract'),
    // Sin esto, un fallo (p. ej. sin internet al descargar el modelo) tumba todo el servidor.
    // El error igual llega como promesa rechazada y se maneja en la ruta.
    errorHandler: () => {},
  }).catch((err) => {
    workerPromesa = null;
    throw err;
  });
  return workerPromesa;
};

export async function leerFactura(rutaImagen) {
  const worker = await obtenerWorker();
  const { data } = await worker.recognize(rutaImagen);
  const texto = data.text.trim();
  return { texto, ...extraerDatos(texto) };
}
