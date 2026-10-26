export class ErrorValidacion extends Error {
  status = 400;
}

export function texto(valor, campo, { max = 200 } = {}) {
  const limpio = typeof valor === 'string' ? valor.trim() : '';
  if (!limpio) throw new ErrorValidacion(`El campo "${campo}" es obligatorio`);
  if (limpio.length > max) throw new ErrorValidacion(`El campo "${campo}" es demasiado largo`);
  return limpio;
}

export function dinero(valor, campo, { min = 0, minExclusivo = false } = {}) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < min || (minExclusivo && n === min)) {
    throw new ErrorValidacion(`El campo "${campo}" debe ser un monto ${minExclusivo ? 'mayor' : 'mayor o igual'} a ${min}`);
  }
  return Math.round(n * 100) / 100;
}

export function fecha(valor, campo) {
  const limpio = typeof valor === 'string' ? valor.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(limpio) || Number.isNaN(Date.parse(limpio))) {
    throw new ErrorValidacion(`El campo "${campo}" debe tener formato AAAA-MM-DD`);
  }
  return limpio;
}

export function id(valor, campo) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw new ErrorValidacion(`El campo "${campo}" no es válido`);
  return n;
}

export function opcion(valor, campo, opciones) {
  if (!opciones.includes(valor)) throw new ErrorValidacion(`El campo "${campo}" debe ser: ${opciones.join(', ')}`);
  return valor;
}
