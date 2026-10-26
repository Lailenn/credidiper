# Credidiper

Aplicación web para registrar los gastos de una tarjeta Credisiman y calcular el saldo disponible.

- **Frontend:** HTML, CSS y JavaScript (`public/`)
- **Backend:** Node.js + Express (`src/`)
- **Base de datos:** SQLite, con el módulo `node:sqlite` incluido en Node (`data/credidiper.db`)

- **OCR:** Tesseract.js lee el comercio, la fecha y el total de la foto de la factura (`src/ocr.js`)

## Requisitos

Node.js 24 o superior (trae `node:sqlite` incluido).

## Cómo ejecutarlo

```bash
npm install
npm run dev      # se reinicia al guardar cambios  (o: npm start)
```

Abre http://localhost:3000, o abre `public/index.html` con **Live Server**: la página llama al API en el puerto 3000, así que el servidor de Node tiene que estar corriendo.

La primera factura que se lee descarga el modelo de español de Tesseract (~2 MB, necesita internet) y lo guarda en `data/tesseract`.

La primera vez se crea un administrador: `admin@credidiper.local` / `admin123`.
Puedes cambiarlo antes del primer arranque con las variables `ADMIN_CORREO` y `ADMIN_PASSWORD`.

### Variables de entorno opcionales

| Variable | Uso |
|---|---|
| `PORT` | Puerto del servidor (por defecto 3000) |
| `DB_PATH` | Ruta del archivo SQLite |
| `SESSION_SECRET` | Secreto de las sesiones. Sin él, las sesiones se cierran al reiniciar el servidor |
| `ADMIN_CORREO`, `ADMIN_PASSWORD` | Credenciales del primer administrador |

## Roles

| Acción | admin | usuario |
|---|---|---|
| Ver tarjeta y saldo disponible | ✔ | ✔ |
| Registrar y anular gastos | todos | solo los suyos |
| Reportes | de todos | solo los suyos |
| Configurar la tarjeta (límite, estado) | ✔ | |
| Agregar y desactivar personas | ✔ | |
| Crear usuarios, desactivarlos, asignarles contraseña | ✔ | |

Los **usuarios** son quienes inician sesión; las **personas** (Mamá, Rubén…) son a quienes se les atribuye cada gasto.

## Registro de un gasto

1. **Subir factura:** se sube la foto y el OCR extrae comercio, fecha y total (también se puede registrar sin factura).
2. **Revisar datos:** el usuario corrige lo que el OCR haya leído mal.
3. **Confirmar:** se elige la persona, se agrega una nota opcional y se guarda. El gasto queda confirmado y se descuenta del disponible.

## Cálculo del saldo

```
Disponible = Límite − Saldo inicial − Gastos confirmados
```

- Solo restan los gastos **confirmados**; los anulados no.
- El disponible se calcula siempre a partir de los gastos, no se guarda, así una compra no se descuenta dos veces.
- No se puede guardar un gasto que supere el disponible, ni usar la misma factura en dos gastos.
- Si se registra un gasto con el mismo comercio, fecha y monto en la misma tarjeta, el sistema avisa que puede estar duplicado.
- Anular un gasto confirmado devuelve su monto al disponible.
- `saldo_inicial` es la deuda que la tarjeta ya tenía antes de usar el sistema.

## API

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Inicia sesión (`correo`, `password`, `recordar`) |
| POST | `/api/auth/logout` | Cierra sesión |
| GET | `/api/auth/me` | Usuario actual |
| PATCH | `/api/auth/password` | Cambia la contraseña propia (`actual`, `nueva`) |
| GET / POST | `/api/tarjetas` | Lista con saldo / crea (admin) |
| GET / PATCH | `/api/tarjetas/:id` | Detalle con saldo / edita (admin) |
| GET / POST | `/api/personas` | Lista / crea (admin) |
| PATCH | `/api/personas/:id` | Cambia `nombre` o `activo` (admin) |
| POST | `/api/facturas/ocr` | Sube una imagen (`imagen`, multipart) y devuelve lo leído |
| GET | `/api/facturas/:gastoId/imagen` | Imagen de la factura (`?descargar=1`) |
| GET / POST | `/api/gastos` | Lista (`?mes=`, `?persona_id=`, `?q=`, `?estado=`) / registra |
| GET | `/api/gastos/:id` | Detalle |
| PATCH | `/api/gastos/:id/estado` | `anulado` (o `confirmado` para gastos pendientes) |
| GET | `/api/reportes/resumen` | Totales del mes (`?mes=AAAA-MM`) por persona y comercio |
| GET / POST | `/api/usuarios` | Lista / crea (admin) |
| PATCH | `/api/usuarios/:id` | Cambia `activo`, `rol` o `password` (admin) |

## Próximos pasos

- Registrar pagos, intereses y movimientos del estado de cuenta para reflejar la deuda real.
