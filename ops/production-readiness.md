# Production readiness — One Burger Commerce

Documento único de operación para producción. Reemplaza a los runbooks heredados
de Casa Antigua que viven en `docs/` (esa carpeta no se versiona).

- Alcance del producto: menú público → carrito → checkout **solo retiro** → admin de órdenes, menú, usuarios y personalización del negocio.
- Fuera de alcance (código vivo, no visible en la navegación principal): reservas, mesas, delivery, inventario, reportes.
- Camino de deploy: **Easypanel** (proyecto `brunobot`, servicio `oneburguerweb`), build desde GitHub `main`.

---

## 0. Estado del deploy actual (2026-09-14)

- Panel: `http://76.13.250.83:3000`
- Proyecto / servicio: **`brunobot` / `oneburguerweb`**
- **Deploy actual**: commit **`0124784`** (main, el tip), build **`build-20260914-113152`**. Lleva la
  **consola de comandas completa (B0–B5)**: cola por hora prometida y lista que no se vacía sin red,
  auto-refresh con aviso y sonido, aceptar/rechazar desde la fila, el tablero de tres carriles con
  urgencia por etapa y pantalla completa, búsqueda y filtros con el estado en la URL, y los umbrales de
  aviso por local más el promedio de preparación del día. Con **dos migraciones aditivas**:
  `20260914054616_add_location_alert_minutes` y `20260914061058_add_status_history_actor`. El anterior
  era `982da3f` (`build-20260913-191302`).
- Dominios públicos (verificado el 2026-09-12): **`https://oneburgernic.com`** (apex, canónico) y
  `https://www.oneburgernic.com` sirven el **landing** y redirigen las páginas de la app (307) a
  `menu.`/`admin.`; **`https://menu.oneburgernic.com`** sirve la **app de pedidos** y
  **`https://admin.oneburgernic.com`** el panel. Los cuatro con certificado Let's Encrypt. El dominio
  por defecto `brunobot-oneburguerweb.2jcsgw.easypanel.host` sigue activo.
  Todo esto lo verifica `npm run test:e2e:prod:hosts` (solo lectura) — incluido el landing y las
  redirecciones. ⚠️ **Cada uno de esos hosts necesita su propia entrada de dominio en el panel**: el
  2026-09-12 se encontró el apex sin entrada y devolvía el 404 de otra app (el catch-all del proyecto
  compartido). Si un dominio devuelve un 404 raro, el primer chequeo es `domains/listDomains`.
  El **rewrite del apex se puede verificar sin tocar producción**: con `E2E_APEX_HOST` el navegador
  resuelve el dominio de marca contra el server local y se prueba la misma entrada que usa un cliente
  (`ops/project-state.md` §5, "Entorno local").
- Admin: `https://oneburgernic.com/admin/login`
- Base de datos: servicio `oneburguer-postgres` del mismo proyecto; base y usuario `oneburguer`, puerto interno 5432, **sin puerto expuesto**.
- Deploy: **una sola llamada** a `deployService` por API (ver §4). ⚠️ **No usar
  `npm run deploy:easypanel`**: fusiona variables y puede crear servicios. El **webhook del panel no es
  fiable** en esta instalación.
- Verificado (2026-09-14, los tres deploys del día): en cada uno `commit.sha` del panel **idéntico al
  tip de `main`**, la acción `Deploy service` en `done`, `/api/health` cambiando de versión
  (`build-20260913-191302` → `build-20260914-113152` → `build-20260914-145114` →
  `build-20260914-151459`), `readiness: ready` con la base en milisegundos, smoke productivo **7/7** y
  dominios **6/6**. La clase `comandas-view` está en el CSS de admin servido (el código de la vista
  nueva está en la imagen).
  ⚠️ **Lo que estos deploys NO pueden verificar desde acá**: el tablero funcionando con una sesión de
  admin en producción (este entorno no tiene esas credenciales). La prueba funcional de la UI es el E2E
  local (97/6/0 al cierre de B6) y la revisión del owner.
  ⚠️ **Observación del 2026-09-14 (a vigilar)**: dos corridas de la QA de solo lectura contra
  `menu.oneburgernic.com` fallaron por **timeouts de carga** (una en masa, 33 casos; otra un solo caso,
  `page.goto` de 30 s), y al repetirlas pasaron (30–31 de 34). En el momento de medir, las cargas
  públicas respondían en **0,7 s de media** y las seis superficies en 200, así que no hay evidencia de
  regresión: parece saturación del burst de la suite (una réplica, muchos navegadores en paralelo) o de
  la red de quien la corre. Si el owner nota lentitud en el panel, el siguiente paso es mirar recursos
  del contenedor en Easypanel.


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

⚠️ Tres cosas que se aprendieron el 2026-09-14, con las comandas:

- **La llamada a `deployService` puede no responder** (el panel sostiene el build y el cliente corta por
  timeout a los 40–180 s). No significa que no se desplegó: verificá la **acción** con
  `actions/listActions` (tiene que aparecer `Deploy service: …` en `pending`/`running`/`done`) y el
  `commit.sha` con `inspectService`.
- **El `sha` del panel puede quedar atrás de `main`** si el último push fue solo de documentación: el
  artefacto es el commit del **código** (p. ej. `0072531`), no `HEAD` (`8ba51ec`, docs). Compará
  `commit.sha` contra **el commit que quisiste desplegar**, no contra `HEAD`. La versión de
  `/api/health` (`build-AAAAMMDD-HHMMSS`) es la señal de que el build nuevo ya sirve.
- Un marcador de texto puede **no aparecer** en los chunks del HTML inicial: la página de admin no
  referencia su chunk de cliente en el HTML servido, así que la verificación fina necesita una sesión de
  admin (o se acepta `commit.sha` + versión de `/api/health` como evidencia).

Antes de commitear o desplegar:

```bash
npm run security:secrets
```

### Después del deploy

```bash
BASE_URL="https://<dominio>" npm run test:e2e:prod          # smoke: health, readiness, rutas, login, locales, menú por local, retiro
BASE_URL="https://<dominio>" npm run test:e2e:prod:hosts    # dominios: landing, redirecciones y host del panel
```

Los dos son de **solo lectura**. El de hosts es el que habría cazado el apex sin entrada de dominio
(2026-09-12), así que va siempre, no solo cuando se toca la infraestructura. El smoke valida además que
`/api/locations` no exponga el contacto interno del local y que el control de retiro del checkout esté
disponible aunque el local esté cerrado en ese momento.

**QA de las superficies públicas (solo lectura, sin `E2E_ALLOW_MUTATIONS`)**: los specs de la carta y
el checkout público se pueden correr **contra producción** porque resuelven el catálogo desde
`/api/menu` en vez de depender del seed local. La app vive en el subdominio de pedidos (el apex sirve
el landing):

```bash
BASE_URL="https://menu.oneburgernic.com" npx playwright test \
  tests/e2e/public-header.spec.ts tests/e2e/public-home.spec.ts tests/e2e/public-menu.spec.ts \
  tests/e2e/public-product.spec.ts tests/e2e/public-cart.spec.ts \
  tests/e2e/design-tokens.spec.ts tests/e2e/security-csp.spec.ts
```

Estos specs **no crean pedidos ni tocan el admin**: el carrito vive en `localStorage`. Un caso se
saltea solo cuando el entorno no tiene lo que necesita, y **lo dice con su motivo**:

- la carta real no tiene un producto con opciones obligatorias (el caso del "+" que no debe existir);
- el caso necesita entrar al panel y no hay credenciales para ese entorno. Con
  `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` configurados, esos casos también corren.

Verificado contra producción el 2026-09-13: **31 pasaron / 3 salteados / 0 fallos** (incluye el
chequeo de CSP en todas las pantallas públicas y la hidratación viva del sitio real).

**Suite completa local (muta datos)**: es la que cubre el admin —aceptar/rechazar pedidos, sucursales,
usuarios— y por eso **nunca** va contra producción. Necesita el flag y el server local:

```bash
BASE_URL="http://127.0.0.1:3210" E2E_ALLOW_MUTATIONS=true \
  E2E_APEX_HOST=oneburgernic.com E2E_APEX_PORT=3210 npm run test:e2e:prod:full
```

⚠️ Dos trampas que costaron dos corridas enteras de fallos en masa (2026-09-13), ninguna del código:

- **Un `next start` huérfano sigue dueño del puerto.** Cuando se mata el job que lo lanzó, el proceso
  de Node puede sobrevivir colgado —escribiendo en un pipe que ya nadie lee— y seguir respondiendo
  (mal) en `3210`: todo el E2E falla con *element not found* en pantallas públicas, y hasta
  `/api/health` tarda 15 s. Antes de correr la suite: `Get-NetTCPConnection -LocalPort 3210 -State
  Listen` y matar el proceso dueño si no es el server que uno acaba de levantar. Al lanzarlo en
  segundo plano, redirigir la salida a un archivo (`npx next start -p 3210 *> "$env:TEMP\server.log"`)
  evita que quede bloqueado si se cierra el pipe.
- **`build:webpack` mientras el server sirve el build de Turbopack rompe el manifiesto de cliente**
  (*Could not find the module … in the React Client Manifest*): las páginas dejan de hidratar. Los dos
  builds escriben en `.next`, así que `build:webpack` se corre **antes** de levantar el server y, si ya
  está levantado, se vuelve a `npm run build` y se reinicia.

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
- **Backup programado: configurado y probado el 2026-09-12.** El servicio `oneburguer-postgres` tiene un
  respaldo diario en el panel (sección *Backups* del servicio): cron `0 9 * * *`, destino **Local Disk**
  (`/etc/easypanel/backups`) y carpeta `oneburguer`.
- **Los archivos producidos sí se pueden verificar por API** (el runbook decía que no): cada respaldo
  queda como una *action* con su ruta, así que `POST /api/rpc/actions/listActions` devuelve
  `meta = {databaseName, path, storageProviderId}`. Al 2026-09-12 hay dos archivos:
  `oneburguer/2026-09-12T16:33:20.265Z.sql.gz` y `oneburguer/2026-09-12T16:35:34.905Z.sql.gz`.
  `databaseBackups/listDatabaseBackups` sigue devolviendo **solo la configuración** (cron, destino,
  carpeta), que es lo que no alcanza para saber si el respaldo salió bien.
- **Drill de restore: hecho y verificado el 2026-09-12** — resultado y receta completa en §8.1.

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

1. Dominio y SSL: **hecho** (ver §0). Los cuatro hosts están en el panel apuntando al servicio
   `oneburguerweb:3000`, con certificado. El apex y `www` sirven el landing; `menu.` la app y `admin.`
   el panel. Si algún día se agrega un host, hay que crear su **entrada de dominio** en el panel: sin
   ella, el catch-all del proyecto compartido responde el 404 de otra app.
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
   **En curso**: el 2026-09-12 producción tenía 2 categorías con 6 productos (4 hamburguesas con C$35
   de empaque y 2 bebidas). Si el negocio abre más de un local, el catálogo por sucursal se ajusta en
   `/admin/locations/[id]` (precio propio, agotado, o no venderlo ahí).
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
| CSP | **Implementada** con un nonce por request (`src/shared/config/content-security-policy.ts` + `src/proxy.ts`) y verificada por `tests/e2e/security-csp.spec.ts` en cada pantalla. Única concesión: `style-src` necesita `'unsafe-inline'` porque React escribe estilos en línea; cerrarlo del todo implica pasar a hojas de estilo. |
| `X-Powered-By` | La imagen de producción no copia `next.config.ts` (importa de `src/`, que no se incluye en el runner), así que Next responde `X-Powered-By: Next.js`. Es cosmético: se puede quitar con un middleware de Traefik sobre el dominio del servicio. |
| Módulos fuera de alcance | Reservas, mesas, delivery e inventario siguen en el repositorio pero ya no se ofrecen en la UI ni en las APIs públicas: el Resumen del admin es solo de retiro (sin KPIs ni sección de reservas, sin filtro Delivery), la pestaña Reservas de `/activity` fue retirada, `Inventario` salió de la navegación y se eliminaron `POST /api/reservations`, `/api/reservations/availability`, `/api/reservations/track`, `/api/tables/active` y `/api/delivery-zones`. Las páginas de admin de esos módulos quedan accesibles solo por URL directa. |
| Build con webpack | **Verificado el 2026-09-12: `npm run build:webpack` compila entero.** La extracción de los componentes y helpers que las páginas exportaban (lo que hacía fallar esa validación) quedó hecha; es el build que **sí** valida los exports de una página, así que conviene correrlo cuando se toca `src/app/**/page.tsx` (Turbopack, el camino del Dockerfile y del CI, no aplica esa validación). |

---

## 8. Pendientes operativos (lo que no se puede hacer desde el repositorio)

Están ordenados por peso. El drill de restore (1) ya está hecho y verificado; los demás siguen abiertos,
cada uno con su receta y su verificación.

1. **Drill de restore** — **hecho y verificado el 2026-09-12**; repetir cada trimestre. Receta completa
   (una hora, casi toda de espera):
   1. Crear el Postgres temporal:
      `services/postgres/createService` con `{projectName, serviceName, databaseName, user, password,
      image}` (`image: postgres:17`, para igualar producción; la contraseña se genera al azar, **no**
      reusar la del servicio real). Elegir un `serviceName` obvio (`oneburguer-drill`).
   2. Restaurar: `databaseBackups/restoreDatabaseBackup` con `{projectName, serviceName, databaseName,
      path, storageProviderId}`. El `path` y el `storageProviderId` salen del `meta` de la acción de
      backup (`actions/listActions`, el más reciente con `description: "Backup database"`); el
      `databaseName` es el del servicio **de destino**. Devuelve `{}` y el trabajo queda como una action
      nueva (`description: "Restore database"`, tipo `backup`) que hay que ver en estado `done`.
   3. Verificar de verdad: `services/postgres/exposeService` con `{projectName, serviceName,
      exposedPort}` **después** del restore (el servicio se reinicia) y leer los conteos con un cliente
      Postgres desde afuera (`new PrismaClient({ datasourceUrl })` alcanza). Comparar con lo que se sabe
      de producción y anotar la evidencia.
   4. Destruir el temporal: `services/postgres/destroyService` con `{projectName, serviceName}` y
      confirmar con `projects/inspectProject` que quedó la lista de servicios de siempre.
   ⚠️ Dos cuidados que salieron del drill: `destroyService` **no valida el nombre** (con uno inexistente
   devuelve `{}` igual, y deja una action "Destroy service" en el historial), así que hay que revisar el
   `serviceName` dos veces y verificar el estado **después**; y el puerto se expone solo después del
   restore y se cierra enseguida, porque el temporal tiene una copia de los datos reales.
   **Resultado del 2026-09-12**: el respaldo de las 16:35 restauró **completo** — 32 tablas, **18
   migraciones** aplicadas, 6 productos con sus precios reales (DOBLE 305, KIDS BURGER 200, MONSTER
   FRIES 370, TRIPLE 365, COCA COLA 44.57, COCA ZERO 45), 2 categorías, 6 imágenes de producto, 3
   bloques de portada, 1 usuario `owner`, 1 `BusinessSettings` y **3 locales**; **0 pedidos**, porque la
   tienda todavía no recibió ninguno (el drill no puede comparar lo que no existe). Producción quedó
   intacta (`oneburguer-postgres` con `exposedPort: 0`) y el servicio temporal, borrado.
   - Alternativa manual si hiciera falta: *Terminal* del servicio y
     `pg_dump -U oneburguer -d oneburger -Fc -f /tmp/oneburger-$(date +%F).dump`.
2. **Notificaciones de pedidos a cocina** (§5) — **en pausa por decisión del owner (2026-09-12): "no
   telegram por el momento"**. La operación es 100 % panel: alguien tiene que tener `/admin/orders`
   abierto (la bandeja ordena por estado y las órdenes nuevas van primero). Para retomarlo hacen falta
   el **bot token** y el **chat id** del grupo de cocina; después: cargar las cuatro variables del §5,
   desplegar y probar con un pedido real.
3. **Rotar el token del panel** (`EASYPANEL_TOKEN`) — **cuando terminen los cambios** (decisión del
   owner, 2026-09-12). Mientras tanto: el token da acceso total al servidor y se pasó por chat varias
   veces, así que no debería quedar en capturas ni en repos. Al rotarlo: panel → *Settings* → *API
   tokens*, crear uno nuevo, usarlo y revocar el viejo.
4. **Cerrar puertos innecesarios de servicios ajenos** (`capostgres` 5455, `postimage` 8585, en el
   panel compartido): no son de One Burger, así que requiere el OK de quien administra esos servicios.
   Se cierran quitando el *port mapping* en el panel de cada servicio.
5. **Monitoreo externo**: un uptime que pegue a `GET /api/readiness` (hace `SELECT 1` y responde 503
   si la base no responde) y avise al canal del equipo.
6. **Datos reales**: terminar de cargar el menú y definir la estrategia de fotos (§6.3 y §6.4).
7. **Propina**: ya **no** se cambia en el código ni hace falta tocar `DEFAULT_TIP_RATE`: el porcentaje
   se edita en `/admin/settings` (configuración del negocio) y el servidor es la fuente de verdad del
   monto. Solo se toca el código si se quiere cambiar el valor por defecto de una instalación nueva.
8. **Locales en producción** — corregido el 2026-09-12 con el drill: producción **no** tiene un solo
   local, tiene **tres**, y el owner confirmó que **los tres son reales**. Los tres están activos y
   tomando pedidos, con `pickupLeadMinutes: 20` y `sortOrder: 0`:

   | Nombre | Slug | Ciudad | Qué corregir |
   |---|---|---|---|
   | Camino de Oriente | `one-burger-masaya` | Managua | el slug no coincide con el nombre → `camino-de-oriente` |
   | Carretera Masaya | `carretera-masaya` | Managua | nada |
   | Casa Antigua | `casa-antigua-jinotepe` | `Jinoteoe` | **la ciudad está mal escrita** → `Jinotepe` |

   Se arregla desde `/admin/locations` → editar cada local (`name`, `slug` y `city` son campos del
   formulario; el slug se normaliza solo). Es cosmético y sin riesgo: **el slug del local no se usa en
   ninguna URL pública ni se guarda en los pedidos** (el checkout y la bandeja trabajan con `locationId`;
   lo que va en la URL pública es el slug de la *categoría*, no el del local). Aprovechar para poner
   `sortOrder` si se quiere un orden propio en el selector del checkout (hoy se ordenan por nombre).
   Después de esto queda pendiente lo de siempre: cargar el menú real y, si hay precios distintos por
   sucursal, usar el catálogo por local (hoy `LocationProduct` tiene solo 2 filas).

