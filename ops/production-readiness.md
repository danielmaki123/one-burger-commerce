# Production readiness — One Burger Commerce

Documento único de operación para producción. Reemplaza a los runbooks heredados
de Casa Antigua que viven en `docs/` (esa carpeta no se versiona).

- Alcance del producto: menú público → carrito → checkout **solo retiro** → admin de órdenes, menú, usuarios y personalización del negocio.
- Fuera de alcance (código vivo, no visible en la navegación principal): reservas, mesas, delivery, inventario, reportes.
- Camino de deploy: **Easypanel** (proyecto `brunobot`, servicio `oneburguerweb`), build desde GitHub `main`.

---

## 0. Estado del deploy actual (2026-09-12)

- Panel: `http://76.13.250.83:3000`
- Proyecto / servicio: **`brunobot` / `oneburguerweb`**
- Dominios públicos: **`https://oneburgernic.com`** (apex, canónico), `https://www.oneburgernic.com`,
  `https://menu.oneburgernic.com` y `https://admin.oneburgernic.com` — los cuatro con certificado
  Let's Encrypt y sirviendo la app. El dominio por defecto
  `brunobot-oneburguerweb.2jcsgw.easypanel.host` sigue activo.
  ⚠️ **El apex necesita su propia entrada de dominio en el panel**: el 2026-09-12 se encontró sin
  entrada y devolvía el 404 de otra app (el catch-all del proyecto compartido). Se volvió a crear. Si
  un dominio devuelve un 404 raro, el primer chequeo es `domains/listDomains`.
- Admin: `https://oneburgernic.com/admin/login`
- Base de datos: servicio `oneburguer-postgres` del mismo proyecto; base y usuario `oneburguer`, puerto interno 5432, **sin puerto expuesto**.
- Deploy: **una sola llamada** a `deployService` por API (ver §4). ⚠️ **No usar
  `npm run deploy:easypanel`**: fusiona variables y puede crear servicios. El **webhook del panel no es
  fiable** en esta instalación.
- Verificado: `/api/health` y `/api/readiness` en 200 en los cuatro dominios, smoke productivo 4/4,
  `/admin` redirigiendo a login.

⚠️ **Avisos de esta instalación**

- El panel es un servidor **compartido** con n8n y con Casa Antigua; el proyecto dedicado `oneburguer` no se pudo crear, así que One Burger vive dentro de `brunobot`. Cualquier servicio nuevo debe crearse con nombres propios (`oneburguer-*`) y no tocar `cacommerce`, `capostgres`, `imagehost` ni `postimage`.
- El servicio **duplicado y huérfano** `oneburguer-web` **ya no existe**: el 2026-09-12 se revisaron los
  tres proyectos del panel (`brunobot`, `n8n`, `postgres`) y solo está `oneburguerweb` (producción).
- Otros servicios de ese servidor exponen Postgres en puertos públicos (`capostgres` 5455, `postimage` 8585). No es de One Burger, pero conviene cerrarlos.
- El token del panel da acceso completo al servidor: guardarlo solo en el gestor de secretos y rotarlo si se compartió por chat.
- **DNS**: `oneburgernic.com` y `www.oneburgernic.com` apuntan a `76.13.250.83`. Si se cambia de servidor, actualizar ambos registros A.
- **Cuenta owner**: `admin@oneburgernic.com`. La contraseña la administra Daniel (no está en el repo). Para rotarla, volver a correr el bootstrap (§6): es idempotente y pisa la contraseña.

---


## 1. Entorno obligatorio

El contenedor **falla al arrancar** si falta cualquiera de estas variables
(`scripts/start-production.mjs`):

| Variable | Valor producción | Notas |
|---|---|---|
| `DATABASE_URL` | `postgresql://…@<servicio>_postgres:5432/oneburguer?schema=public` | Runtime |
| `DIRECT_URL` | igual que `DATABASE_URL` | Migraciones Prisma |
| `APP_ENV` | `production` | Cualquier otro valor habilita endpoints internos de staging |
| `NODE_ENV` | `production` | Si no, las cookies de sesión no van con `secure` |

Además, con `NODE_ENV=production` el arranque **aborta** si
`CUSTOMER_OTP_DEV_LOG=true` o `CUSTOMER_OTP_STAGING_SMOKE_MODE=true`: esos
interruptores escriben códigos OTP en claro en los logs.

Variables opcionales relevantes:

- `MIGRATIONS_AUTO=false` → el contenedor no aplica migraciones (`prisma migrate deploy` queda como paso explícito).
- `MIGRATION_MAX_ATTEMPTS` (12) y `MIGRATION_RETRY_DELAY_MS` (5000) → reintentos de migración al arrancar.
- `ADMIN_HOSTS` → hosts admin extra separados por coma. Cualquier host `admin.<dominio>` se reconoce sin configuración.
- `NOTIFICATIONS_DRIVER`, `TELEGRAM_*`, `N8N_*`, `OUTBOX_PROCESSOR_*` → ver §5.

Inventario completo y comentado en `.env.example`.

---

## 2. Secuencia de deploy

⚠️ **El deploy es UNA llamada a `deployService`.** No usar `npm run deploy:easypanel` (fusiona
variables y puede crear servicios) ni los scripts `:preflight`/`:dry-run`, que pertenecen a la
primera puesta en marcha. El servicio ya existe: solo hay que pedirle un rebuild.

```bash
# 1. Desplegar (el token va por entorno, nunca en el repo)
curl -sS -X POST "http://76.13.250.83:3000/api/rpc/services/app/deployService" \
  -H "Authorization: Bearer $EASYPANEL_TOKEN" -H "Content-Type: application/json" \
  -d '{"json":{"projectName":"brunobot","serviceName":"oneburguerweb","forceRebuild":true}}'
# Devuelve 200 {} y el build sigue en segundo plano (tarda unos minutos).

# 2. Confirmar qué commit quedó configurado
curl -sS -X POST "http://76.13.250.83:3000/api/rpc/services/app/inspectService" \
  -H "Authorization: Bearer $EASYPANEL_TOKEN" -H "Content-Type: application/json" \
  -d '{"json":{"projectName":"brunobot","serviceName":"oneburguerweb"}}' | grep -o '"sha":"[^"]*"'
```

**Cómo saber que el build nuevo está sirviendo** (el `sha` se actualiza al disparar, no al terminar):
buscar en el bundle del sitio un texto que solo exista en el commit nuevo, o mirar que una ruta nueva
responda. Ejemplo usado el 2026-09-12:

```bash
curl -sS https://oneburgernic.com/checkout | grep -o '/_next/static/[^"]*\.js' | sort -u   # y buscar el marcador en esos chunks
```

Antes de commitear o desplegar:

```bash
npm run security:secrets
```

### Después del deploy

```bash
BASE_URL="https://<dominio>" npm run test:e2e:prod
```

El smoke productivo es no mutante y valida `/api/health`, `/api/readiness`
(que hace un `SELECT 1` real y responde 503 si la base está caída), menú
público, carrito, checkout y login admin.

El `HEALTHCHECK` del contenedor usa `/api/readiness`, así que un deploy con la
base inaccesible queda `unhealthy` y no debería promocionarse.

---

## 3. Migraciones y backups

Estado actual del repo:

- El contenedor aplica `prisma migrate deploy` al arrancar, con reintentos, **antes** de servir tráfico.
- CI (`.github/workflows/publish-ghcr.yml`) aplica las migraciones sobre una base vacía y falla si hay drift entre `prisma/migrations` y `prisma/schema.prisma`.
- **No hay backups automáticos configurados en el repositorio.** Esto es una acción de infraestructura pendiente (§8).

Política recomendada para producción:

1. Activar backups programados en el servicio PostgreSQL de Easypanel y fijar retención explícita (mínimo 7 días).
2. Antes de cada deploy que incluya migraciones: backup manual (`pg_dump`) y anotar el identificador del backup.
3. Si se necesita control total del paso de migración: desplegar con `MIGRATIONS_AUTO=false`, correr `npm run db:deploy` como paso explícito y recién entonces habilitar el tráfico.
4. Hacer un **drill de restore** en una base aislada antes de la primera salida y luego cada trimestre: restaurar el backup, comparar conteos de `Order`, `Product`, `AdminUser` y registrar la evidencia.
5. No usar `npm run db:seed` en producción: crea credenciales demo (`admin@example.com` / `Admin1234!`).

---

## 4. Rollback

- **Aplicación**: el deploy construye desde GitHub `main` con `forceRebuild`. Para volver atrás, revertir el commit en `main` y volver a disparar `deployService` (§2). El servicio **no** está apuntado a una imagen fija: siempre construye desde `main`.
- **Artefacto inmutable**: el workflow publica `ghcr.io/<owner>/one-burger-commerce:<sha>`. Apuntar el servicio a esa imagen permite volver a una versión exacta sin reconstruir; hoy el servicio usa build desde Git.
- **Base de datos**: no hay down-migrations. Toda migración aplicada se resuelve con *fix-forward* apoyado en el backup previo. Registrar en el mismo PR la reversión lógica (script SQL o migración nueva) cuando una migración sea destructiva.

---

## 5. Notificaciones de pedidos

Sin proveedor real configurado, **un pedido nuevo no avisa a nadie**: el driver
por defecto es `dummy`, que descarta el mensaje en memoria
(`src/modules/notifications/adapters/dummy-notification-sender.ts`).

Para activar avisos:

```
TELEGRAM_NOTIFICATIONS_ENABLED=true
TELEGRAM_BOT_TOKEN=<bot token>
TELEGRAM_CHAT_ID=<chat id>
OUTBOX_PROCESSOR_ENABLED=true
OUTBOX_PROCESSOR_SECRET=<secreto aleatorio largo>
```

Con `OUTBOX_PROCESSOR_ENABLED=true`, el scheduler in-process llama a
`/api/internal/outbox/process` cada `OUTBOX_PROCESSOR_SCHEDULE_MS` (15 s por
defecto). Alternativa: no activar el scheduler y disparar el endpoint desde un
cron externo.

Si se decide operar sin notificaciones, la operación depende de que alguien
tenga abierto `/admin/orders`; hay que monitorear la cola de pedidos nuevos.

Pendiente conocido: el dedup del outbox es en memoria. El reclamo de eventos es
atómico (una sola instancia procesa cada evento), así que mantener
`replicas: 1` sigue siendo lo recomendado.

---

## 6. Primer arranque con datos reales

1. Dominio y SSL: hoy el servicio usa el dominio por defecto de Easypanel
   (`brunobot-oneburguerweb.2jcsgw.easypanel.host`, HTTPS). Para un dominio propio,
   crearlo en el panel apuntando al servicio `oneburguerweb` puerto `3000`.
2. Crear el primer admin (nunca con el seed). El contenedor ya trae `scripts/`, así
   que se puede ejecutar desde la **Terminal del servicio** en Easypanel:

   **Método soportado (verificado en producción):** Easypanel no ofrece una
   forma fiable de ejecutar un comando puntual dentro del contenedor, así que el
   primer admin se crea en el arranque. En el servicio `oneburguerweb`, agregar
   estas variables de entorno y desplegar:

   ```
   BOOTSTRAP_ADMIN_ON_START=true
   BOOTSTRAP_ADMIN_EMAIL=owner@dominio
   BOOTSTRAP_ADMIN_PASSWORD=<12+ caracteres>
   BOOTSTRAP_ADMIN_NAME=Daniel
   BOOTSTRAP_ADMIN_ROLE=owner
   ```

   El arranque aplica migraciones, hace `upsert` del admin (`AdminUser`) y recién
   después levanta la app; nunca escribe la contraseña en los logs. **Después de
   verificar el login, quitar `BOOTSTRAP_ADMIN_ON_START` y las variables
   `BOOTSTRAP_ADMIN_*` y volver a desplegar**: la cuenta queda creada igual.

   Alternativa si alguna vez hay terminal en el contenedor: `npm run admin:bootstrap`
   con las mismas variables `BOOTSTRAP_ADMIN_*`.

   El comando es idempotente: repetirlo con la misma contraseña no rompe nada y
   con otra la rota.

3. Cargar el menú real desde `/admin/menu` (categorías, productos, modificadores, bloques de marketing).
4. Definir de dónde salen las fotos: los productos guardan una URL de imagen externa y **no hay subida de archivos**. `public/images/` no se versiona, así que la imagen desplegada no trae fotos.
5. Verificar el flujo completo en 375 px: menú → carrito → checkout (hora de retiro) → confirmación → `/admin/orders`.

---

## 7. Límites conocidos a tener presentes en operación

| Tema | Estado |
|---|---|
| Rate limiting | En memoria de proceso y con la IP leída de `x-real-ip` o del **último** hop de `x-forwarded-for`. Si el proxy no escribe esas cabeceras, todos los clientes comparten el bucket `unknown`. No hay store compartido ni bloqueo por cuenta. |
| Réplicas | `replicas: 1`. El outbox reclama cada evento de forma atómica (dos procesadores ya no pueden enviar la misma notificación), pero el dedup y el rate limiting siguen en memoria por proceso, y cada réplica dispararía su propio scheduler. |
| Observabilidad | Sin error tracking ni alertas externas. Los incidentes se ven en los logs del contenedor. |
| Login de clientes (OTP) | Sin proveedor real de WhatsApp: `request-otp` responde 503 en producción. No afecta el checkout (no requiere sesión de cliente). |
| CSP | No se define `Content-Security-Policy` todavía; sí `HSTS`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy` (viajan serializadas en el build, no dependen del config en runtime). |
| `X-Powered-By` | La imagen de producción no copia `next.config.ts` (importa de `src/`, que no se incluye en el runner), así que Next responde `X-Powered-By: Next.js`. Es cosmético: se puede quitar con un middleware de Traefik sobre el dominio del servicio. |
| Módulos fuera de alcance | Reservas, mesas, delivery e inventario siguen en el repositorio pero ya no se ofrecen en la UI ni en las APIs públicas: el Resumen del admin es solo de retiro (sin KPIs ni sección de reservas, sin filtro Delivery), la pestaña Reservas de `/activity` fue retirada, `Inventario` salió de la navegación y se eliminaron `POST /api/reservations`, `/api/reservations/availability`, `/api/reservations/track`, `/api/tables/active` y `/api/delivery-zones`. Las páginas de admin de esos módulos quedan accesibles solo por URL directa. |
| Build con webpack | `next build --webpack` falla la validación de exports de página (varias páginas exportan componentes y helpers además del default). Turbopack —el camino de build del Dockerfile y del CI— no aplica esa validación, así que hoy no bloquea. Extraer esos componentes a módulos propios antes de cambiar de bundler o de subir de versión mayor de Next. |

---

## 8. Pendientes que requieren acción humana

1. **Backups automáticos + drill de restore** en el servicio PostgreSQL de producción.
2. **Dominio y SSL** productivos, con el host admin apuntando al servicio `web`.
3. **Notificaciones**: decidir canal real (Telegram, n8n o WhatsApp) o aceptar operación 100 % panel.
4. **Datos reales**: menú cargado y estrategia de imágenes de producto.
5. **Monitoreo externo**: uptime sobre `/api/readiness` y alerta al canal del equipo.
6. **Revisión de la propina**: hoy es opt-in (desmarcada por defecto) al 10 %. Si el negocio quiere otro porcentaje o un valor sugerido distinto, se cambia en `DEFAULT_TIP_RATE` (`src/shared/lib/order-totals.ts`).
