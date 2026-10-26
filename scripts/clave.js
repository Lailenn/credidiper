// Cambia la contraseña de la cuenta desde la computadora (por si se olvidó).
// Uso:  npm run clave -- NuevaContraseña            (cuenta administradora)
//       npm run clave -- NuevaContraseña correo@x.com
import bcrypt from 'bcryptjs';
import { cliente, esRemota } from '../src/db.js';

const [nueva, correo] = process.argv.slice(2);
if (!nueva || nueva.length < 6) {
  console.error('Escribe la contraseña nueva (mínimo 6 caracteres):  npm run clave -- NuevaContraseña');
  process.exit(1);
}

const r = correo
  ? await cliente.execute({ sql: 'UPDATE usuarios SET password_hash = ? WHERE correo = ?', args: [bcrypt.hashSync(nueva, 10), correo] })
  : await cliente.execute({ sql: 'UPDATE usuarios SET password_hash = ? WHERE rol_id = 1', args: [bcrypt.hashSync(nueva, 10)] });
if (!r.rowsAffected) {
  console.error('No se encontró la cuenta.');
  process.exit(1);
}
await cliente.execute('DELETE FROM tokens');
console.log(`Contraseña cambiada en la base ${esRemota ? 'compartida (Turso)' : 'local'}. Vuelve a iniciar sesión.`);
