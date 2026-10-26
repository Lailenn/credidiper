import session from 'express-session';
import { db } from './db.js';

const UN_DIA = 24 * 60 * 60 * 1000;

// Guarda las sesiones en SQLite para que no se cierren cada vez que se reinicia el servidor
export class SqliteStore extends session.Store {
  #leer = db.prepare('SELECT datos FROM sesiones WHERE sid = ? AND expira > ?');
  #guardar = db.prepare('INSERT OR REPLACE INTO sesiones (sid, datos, expira) VALUES (?, ?, ?)');
  #borrar = db.prepare('DELETE FROM sesiones WHERE sid = ?');
  #tocar = db.prepare('UPDATE sesiones SET expira = ? WHERE sid = ?');

  constructor() {
    super();
    db.prepare('DELETE FROM sesiones WHERE expira <= ?').run(Date.now());
  }

  #expiracion(sesion) {
    const expira = sesion.cookie?.expires;
    return expira ? new Date(expira).getTime() : Date.now() + UN_DIA;
  }

  get(sid, cb) {
    const fila = this.#leer.get(sid, Date.now());
    cb(null, fila ? JSON.parse(fila.datos) : null);
  }

  set(sid, sesion, cb) {
    this.#guardar.run(sid, JSON.stringify(sesion), this.#expiracion(sesion));
    cb?.(null);
  }

  destroy(sid, cb) {
    this.#borrar.run(sid);
    cb?.(null);
  }

  touch(sid, sesion, cb) {
    this.#tocar.run(this.#expiracion(sesion), sid);
    cb?.(null);
  }
}
