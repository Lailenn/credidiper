# Credidiper

Aplicación web para registrar los gastos de una tarjeta Credisiman y calcular el saldo disponible.

- **Frontend:** HTML, CSS y JavaScript (`public/`), publicado en GitHub Pages
- **Backend:** Node.js + Express (`src/`), publicado en Render
- **Base de datos:** SQLite en Turso (`@libsql/client`), compartida por todos
- **OCR:** Tesseract.js lee el comercio, la fecha y el total de la foto de la factura (`src/ocr.js`)

## Una sola base de datos para todos

```
GitHub Pages (lailenn.github.io/credidiper) ─┐
Tu computadora (localhost / Live Server) ─────┼──► Servidor Node (Render) ──► SQLite en Turso
                                              │
Tu computadora con npm run dev ───────────────┴──────────────────────────────► (la misma base)
```

Lo que se registra en un lugar se ve en todos. Las fotos de las facturas también se guardan en la base.

## Requisitos

Node.js 22.12 o superior.

## Cómo ejecutarlo en tu computadora

1. Copia `.env.example` como `.env` y pon la URL y el token de Turso (el archivo `.env` no se sube a GitHub).
2. Ejecuta:

```bash
npm install
npm run dev      # se reinicia al guardar cambios  (o: npm start)
```

Abre http://localhost:3000, o abre `public/index.html` con **Live Server** (llama al servidor del puerto 3000).

Sin `.env`, el servidor usa un archivo local `data/credidiper.db` (sirve para pruebas, pero esos datos no se comparten).

La primera factura que se lee descarga el modelo de español de Tesseract (~2 MB, necesita internet) y lo guarda en `data/tesseract`.

Si la base está vacía se crea un administrador: `admin@credidiper.local` / `admin123`. Cambia la contraseña en **Configuración → Mi cuenta**.

## Publicación

- **Turso** (base de datos): crea una base y un token; van en `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`.
- **Render** (servidor): *New → Blueprint* con este repositorio usa `render.yaml`; pon ahí las dos variables de Turso.
- **GitHub Pages** (pantallas): se publica sola desde la rama `main`. La URL del servidor está en `API_PRODUCCION` de `public/app.js`.
- Para copiar una base local a Turso: `npm run migrar` (se detiene si Turso ya tiene datos).

En el plan gratis, Render duerme el servidor tras 15 minutos sin uso; la primera carga después tarda cerca de un minuto.

### Variables de entorno

| Variable | Uso |
|---|---|
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Base de datos compartida en Turso |
| `PORT` | Puerto del servidor (por defecto 3000) |
| `DB_PATH` | Archivo SQLite local cuando no hay Turso |
| `CORS_ORIGINS` | Páginas que pueden usar el API (por defecto GitHub Pages y Live Server) |
| `ZONA_HORARIA` | Zona horaria de las fechas de registro (por defecto `America/El_Salvador`) |
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
| POST | `/api/auth/login` | Inicia sesión (`correo`, `password`, `recordar`); devuelve un `token` para la cabecera `Authorization: Bearer` |
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
