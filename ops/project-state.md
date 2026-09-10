# Estado del proyecto — One Burger Commerce

> Actualizado: 2026-09-10 · Commit en `main`: `5d8dfd6` · Build en producción: `build-20260910-174113`
> Este documento es el punto de entrada para retomar el trabajo. Mantenerlo al día al cerrar cada tarea.
> Para arrancar en un chat nuevo: `ops/tasks/START-HERE.md`.

## 1. Qué está vivo hoy

| Cosa | Valor |
|---|---|
| Dominio público | **https://oneburgernic.com** (canónico) y `https://www.oneburgernic.com` — ambos con certificado |
| Admin | **https://oneburgernic.com/admin/login** |
| Cuenta owner | `admin@oneburgernic.com` (contraseña administrada por Daniel; no está en el repo) |
| Health / readiness | `GET /api/health` · `GET /api/readiness` (hace `SELECT 1` y responde 503 si la base no responde) |
| Hosting | Easypanel — panel `http://76.13.250.83:3000`, proyecto `brunobot`, servicio `oneburguerweb` |
| Base de datos | Postgres 17, servicio `oneburguer-postgres` (sin puerto expuesto), base/usuario `oneburguer` |
| Imagen | `ghcr.io/danielmaki123/one-burger-commerce` (publicada por CI en cada push a `main`) |
| Repo | `github.com/danielmaki123/one-burger-commerce`, rama de deploy `main` |
| DNS | `oneburgernic.com` y `www` → `76.13.250.83` (registros A) |

**Verificación al cierre de esta etapa**: 827 tests unitarios, lint, typecheck y build en
verde; CI (`verify` + `migrations` + `container` + `publish`) verde; smoke productivo 4/4
en producción y APIs fuera del MVP devolviendo 404.

**Estado del catálogo:** el owner ya entró al admin y creó la categoría `ONE BURGER`
(todavía sin subcategorías ni productos). El menú público responde pero está vacío de
productos: es el primer pendiente de contenido.

## 2. Qué se cerró en esta etapa

**Producto / experiencia**

- Propina: pasó de ser 10 % forzado e invisible a **opt-in desmarcado**, con fila propia en
  el desglose; el backend no aplica propina si el campo se omite.
- Aviso de pago explícito ("Pagás en el local al retirar tu pedido") en carrito, checkout
  y confirmación. Se eliminó la promesa de envío del carrito.
- Hora de retiro: arranca con el valor que la UI muestra seleccionado (antes el CTA quedaba
  deshabilitado con "Falta hora de retiro" y una hora aparentemente elegida).

**Seguridad**

- IDOR cerrado: `POST /api/orders/[id]/items` ya no es público (exige staff con permiso).
- Permisos por rol aplicados donde faltaban (outbox con PII, reservas, inventario).
- Rate limiting en los POST públicos y `getClientIp` confía solo en `x-real-ip`/último hop.
- Login admin: 10 intentos/min por IP configurable (`ADMIN_LOGIN_RATE_LIMIT`); era 5/min y
  bloqueaba cambios de turno reales.
- Cabeceras de seguridad (`HSTS`, `nosniff`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`) verificadas en el `routes-manifest.json` del build.

**Integridad de datos**

- Cupones: consumo atómico del último uso (dos pedidos concurrentes ya no lo comparten) y
  devolución del cupo si la orden falla.
- Outbox: reclamo atómico por evento (dos procesadores no envían la misma notificación).
- Telegram: el ticket escapa HTML (un nombre con etiquetas podía falsificar el total).

**Admin**

- Nuevo ciclo de vida de usuarios: cambiar rol y revocar acceso, con guardas ("siempre debe
  quedar un owner", "no podés borrar tu propia cuenta") y sesiones que se cierran al revocar.
- Limpieza de alcance: el Resumen es solo de retiro (sin KPIs/sección de reservas ni filtro
  Delivery); se retiró la pestaña Reservas de `/activity`, `Inventario` salió de la
  navegación y se eliminaron las APIs públicas de reservas, mesas y zonas de delivery.

**Dominio y accesos**

- `oneburgernic.com` (apex) quedó apuntando al servicio con HTTPS y sirviendo la app.
- `www.oneburgernic.com` estaba sin certificado: se agregó como dominio del servicio
  (Let's Encrypt) y ya responde 200.
- El primer admin se creó con el bootstrap por variables de entorno (`BOOTSTRAP_ADMIN_ON_START`),
  verificado con login real; después se quitaron esas variables del servicio.

**Infraestructura / operación (los hallazgos que más costaron)**

1. **La migración inicial tenía un BOM UTF-8** → `prisma migrate deploy` fallaba en cualquier
   base nueva (`P3018`). Sin esto, la primera base de producción no se podía crear. Corregido
   y con test de contrato que lo impide.
2. **El stage `runner` no copiaba `scripts/`** → el `CMD` (`npm run start:production`) moría
   con `MODULE_NOT_FOUND`; Easypanel nunca promovía la versión y seguía sirviendo un
   *placeholder*.
3. **El runner tampoco copiaba `src/`** → `scripts/bootstrap-admin.ts` importa de `src/`, así
   que el contenedor moría al crear el primer admin y el deploy no promovía.
   > Los tres son la misma clase de bug: la imagen compilaba pero no podía ejecutar su
   > propio runtime. Ahora CI **construye la imagen, la ejecuta contra Postgres, exige
   > readiness y prueba el bootstrap del admin** antes de publicar.

**CI**: `verify` + `migrations` (drift) + `container` (imagen real) + `publish` (GHCR).

> Arreglo de CI del 2026-09-10: el job `container` falló una vez con exit 141 (SIGPIPE)
> porque el script usaba `docker logs … | grep -q` bajo `set -o pipefail`; el contenedor
> había arrancado bien (los logs muestran `initial admin ready` y el login 200). Ahora se
> guarda la salida en un archivo antes del `grep`, y `deploy-runtime-contract.test.ts`
> falla si el patrón vuelve.

**Personalización del negocio (`TASK-whitelabel-branding`, 6 fases)**

- **Fase 1/6 cerrada — núcleo de settings, sin cambios visibles.** Módulo DDD
  `src/modules/business-settings/` (dominio con tipos y defaults, validación zod
  compartida cliente/servidor, puerto, adaptadores Prisma e in-memory, casos de uso
  `getBusinessSettings` / `updateBusinessSettings`). Modelo `BusinessSettings` con una
  sola fila (`id = "default"`) y migración `20260910120000_add_business_settings` que
  siembra exactamente los valores que hoy están hardcodeados, para que el deploy no
  cambie nada. El seed local deriva de los defaults (no los copia) y un test de contrato
  falla si la migración y los defaults se desincronizan.
  - Ojo: el DDL de la migración se verificó contra el que genera
    `prisma migrate diff` (el job `migrations` del CI falla ante cualquier drift).
- **Fase 2/6 cerrada — el sitio público ya lee la configuración.** Ninguna superficie
  pública escribe ya el nombre, el contacto, los horarios, la moneda, la propina ni el
  copy de pago a mano:
  - `src/app/layout.tsx` pasa a `force-dynamic` (la config vive en la base y el build de
    la imagen no tiene `DATABASE_URL`), resuelve `generateMetadata()` desde la config y
    aplica color y tipografía como tokens CSS inline en `<html>`. `public/manifest.webmanifest`
    estático se reemplazó por `src/app/manifest.ts`.
  - `globals.css`: los colores derivados usan `color-mix()` sobre `--brand`/`--background`
    y el degradado del `body` sale del color de marca configurado (adiós a los `rgba(43,108,150,…)`).
  - Header/footer/home/checkout/confirmación/404, el shell del admin y el ticket de
    notificaciones usan `useBusinessSettings()` / la config del servidor.
  - **Propina**: el servidor es la fuente de verdad. `POST /api/orders` inyecta la
    política configurada en `createOrder` (con la propina apagada no se aplica aunque el
    cliente la pida) y el checkout toma el porcentaje y el on/off de la config.
  - **Moneda**: `formatCurrency(valor, { symbol, locale })`, con el default saliendo del
    módulo de defaults (no hay `C$` literal). Los componentes públicos pasan el formato
    configurado.
  - **Verificado en el camino real**: Postgres 17 local + migraciones + seed + `next start`
    y la suite E2E completa **11/11 en verde**. Se comprobó además que cambiar la fila
    (nombre, color, propina) se refleja en la siguiente carga **sin redeploy**.
  - Cambios visibles deliberados (unificaciones de duplicados, todo editable desde la
    config): el `<title>` pasa de `One Burger Commerce` a `One Burger` (sale de `name`);
    el tagline del footer se unifica en uno solo; el bloque de contacto del footer usa el
    resumen único de horario (`Lun - Dom 12:00 - 22:00`); la descripción del manifest usa
    el tagline. **Nada de esto cambia el branding visible salvo esos textos.**
  - Bug que solo apareció en la verificación real: el helper de tokens CSS se exportaba
    desde un módulo `"use client"` y el layout de servidor no podía llamarlo (500 en todas
    las páginas). Se movió al dominio y hay un test de contrato que lo impide.
- **Fase 3/6 cerrada — `/admin/settings`.** El owner edita y guarda la configuración sin
  tocar la base a mano:
  - Permiso nuevo `canManageBusinessSettings` (solo `owner`); el `manager` que entra por
    URL directa es redirigido a `/admin/orders`, igual que en Usuarios.
  - `GET`/`PUT /api/admin/business-settings` con la sesión de admin, el permiso y el
    mapeo de `BusinessSettingsError` a 422 con el detalle por campo.
  - Formulario con secciones (Identidad, Contacto y ubicación, Horarios con los 7 días,
    Operación y Avanzado), **vista previa en vivo** con los colores, el logo y el nombre
    que se están editando, "Restablecer" por campo, errores por campo en español y
    auditoría visible (`updatedAt` / `updatedByUserId`). Mobile-first.
  - Entrada nueva en la navegación del admin ("Personalización", grupo Configuración),
    visible solo para el owner.
  - **E2E**: el owner cambia el nombre en el admin y lo ve en `/menu` sin redeploy (el test
    restaura el valor original al terminar); un manager no puede entrar a la sección.
    Suite completa 13/13 en verde en local con Postgres real.
- **Fase 4/6 cerrada — apariencia.** Los colores son editables con red de seguridad:
  - Dominio nuevo `color-contrast.ts` (luminancia relativa y ratio WCAG) con **aviso** de
    contraste AA que **no bloquea** el guardado, y `color-presets.ts` con 6 esquemas
    curados. Un test recorre todos los presets y falla si alguno deja de ser legible.
  - El formulario suma la sección **Apariencia**: presets con muestra de color, los cinco
    colores editables (selector + hex) y las tipografías, más la lista de avisos de
    contraste. La vista previa ya mostraba los colores sin guardar.
  - Los colores se aplican como tokens CSS en `<html>`, así que se ven en todo el sitio
    (público y admin) sin tocar el CSS.
- **Fase 6/6 cerrada — barrido final y contrato anti-hardcode.** El barrido encontró
  hardcodeo que quedaba en el login del admin, el checkout (`C$0.00`), la ficha de
  producto, la confirmación de reservas, las etiquetas `(C$)` de menú y los propios
  mensajes de ejemplo del esquema. Todo salió de la configuración.
  - `anti-hardcode-contract.test.ts` recorre todo `src/` (sin tests), quita comentarios y
    falla si reaparece el nombre, el teléfono, el WhatsApp, el Instagram, el símbolo de
    moneda o el horario por defecto fuera de `business-settings-defaults.ts`. Los módulos
    fuera del MVP (reservas, mesas, delivery, inventario) quedan excluidos y documentados.
  - `README.md` documenta la personalización y su módulo.
  - **Fase 5 (subida de assets) no se hizo**: está marcada como opcional en el brief y
    requiere un volumen persistente en Easypanel, que es una decisión de infraestructura
    del owner. Hoy los logos se configuran por URL.

**Deploy de la personalización a producción (2026-09-10)**

- Se desplegó `8b022e3` con **una sola llamada a la API del panel**:
  `services/app/deployService` sobre el servicio que ya existía
  (`brunobot/oneburguerweb`). **No se creó ni se reconfiguró nada**: no se usó
  `npm run deploy:easypanel` justamente porque ese script además reescribe
  `DATABASE_URL`/`APP_ENV`/`NODE_ENV`/`PORT` y crea servicios si un nombre no coincide.
- Verificado antes de tocar nada (lectura): existe el proyecto `brunobot`, existen
  `oneburguerweb` (app, GitHub `main`, Dockerfile, 1 réplica) y `oneburguer-postgres`, y
  `DATABASE_URL` apunta a `brunobot_oneburguer-postgres`. El entorno del servicio conserva
  `NEXTAUTH_SECRET` y las variables de notificaciones, y ya no tiene `BOOTSTRAP_ADMIN_*`.
- Producción pasó de `build-20260910-150351` a **`build-20260910-170321`** con
  `readiness` en `ready`, smoke productivo **4/4** y las cinco rutas públicas en 200.
- La migración `20260910120000_add_business_settings` corre en el arranque del contenedor:
  si fallara, el contenedor no arranca y Easypanel no promueve la versión. La versión se
  promovió, así que quedó aplicada. **No se pudo leer la tabla directamente** porque los
  logs del servicio no se exponen por la API del panel y no tenemos las credenciales del
  owner: si se quiere una comprobación directa, correr en la terminal del servicio
  `psql` o entrar a `/admin/settings`.
- Producción se ve igual que antes salvo los cambios deliberados ya documentados: el
  `<title>` es `One Burger` (era `One Burger Commerce`) y el manifiesto del PWA pasó a
  generarse desde la configuración.

**QA en producción con la cuenta owner (2026-09-10)**

- **La tabla existe y la migración quedó aplicada**: `GET /api/admin/business-settings`
  con la sesión del owner devuelve la fila `id = "default"`.
- **El owner ya cargó los datos reales** desde `/admin/settings` (tagline `just One.`,
  dirección `Camino de Oriente, Carretera Masaya y Casa Antigua (Jinotepe)`, teléfono
  `+505 8781 0800`, logo propio en el manifiesto). La fila tiene `updatedByUserId`, así
  que el guardado quedó auditado: el camino admin → base está probado por uso real.
- **Escritura controlada y reversión**: se guardó un valor temporal en `closedMessage`
  (un campo que no se renderiza en ninguna superficie pública), se verificó que persistió
  y que el resto de la configuración quedó intacto (el parche es parcial), y se restauró
  el valor original.
- `/admin/settings` carga con los valores actuales y sus secciones, y el sitio público
  (`/menu`, `/`, manifiesto) muestra los datos configurados.
- Smoke productivo **4/4** tras el deploy de `f430fff`.
- Observación operativa: el isotipo configurado apunta a `images.casaantiguanic.com`, un
  host externo al stack de One Burger. Si ese servicio se cae, el logo del PWA y del
  header se rompe; conviene moverlo a un asset propio (o esperar a la fase 5, que lo
  subiría al servidor).

**Cambio de alcance pedido por el owner (2026-09-10)**

- Se retiró la sección **"Accesos rápidos"** de la home: repetía los mismos enlaces que
  el header y la barra inferior. Se eliminó también el helper muerto
  `getHomeQuickActions`, que además seguía listando "Reservar" e "Historial" (fuera del
  MVP). Commit `f430fff`.

**Arreglo de branding: el logo y los colores no llegaban a toda la app (2026-09-10)**

Dos bugs de la fase 2 que solo aparecen usando el producto, reportados por el owner:

1. **El isotipo no llegaba a todas las superficies.** `logoMarkUrl` se usaba solo en el
   header público y en la confirmación de pedido; la home, el shell del admin y el login
   del admin seguían mostrando las iniciales "OB", y `logoUrl` no se usaba en ningún lado.
   El favicon, además, tenía como default el asset viejo, que tapaba al isotipo.
2. **Los colores solo se veían en la home.** Cada página tenía su propio degradado con el
   azul y los cremas escritos a mano (`rgba(43,108,150,…)`, `#fcfaf6`/`#f4f2ec`); solo `/`
   usaba la clase con tokens.

Arreglado en `5d8dfd6`:

- `domain/brand-assets.ts` decide una sola vez qué imagen va en cada lugar y cuál es el
  favicon efectivo (`faviconUrl` sigue al isotipo mientras siga el valor sembrado, porque
  ese valor no es una elección del owner).
- `shared/ui/brand-mark.tsx` es el único componente que dibuja la marca; se usa en el
  header público y de la home, el footer de la home, el shell y el login del admin, las
  confirmaciones y la vista previa.
- Fondos y sombras salen de clases con tokens en `globals.css` (`.brand-canvas`,
  `.brand-surface`, `.brand-photo`, `.brand-overlay`, `.brand-hero-fallback`,
  `.brand-shadow-*`). El service worker ya no precachea el logo viejo.
- El contrato anti-hardcode suma un guard que falla si vuelve un color del sistema viejo.

Verificado en producción (`build-20260910-174113`): las cinco superficies muestran el logo
configurado y ninguna muestra ya las iniciales; el favicon y el apple-touch-icon apuntan
al logo; ningún HTML público trae los colores viejos; smoke 4/4.

## 3. Infraestructura y secretos

- `EASYPANEL_URL` y `EASYPANEL_TOKEN`: solo en el entorno de quien ejecuta el deploy (nunca
  en el repo). El token da acceso total al servidor: **rotarlo** si se compartió por chat.
  ⚠️ El 2026-09-10 el token se pasó por chat para desplegar la personalización:
  **conviene rotarlo**.
- Variables obligatorias del servicio: `DATABASE_URL`, `DIRECT_URL`, `APP_ENV=production`,
  `NODE_ENV=production`, `PORT=3000`. El arranque falla si falta alguna.
- Inventario completo: `ops/production-readiness.md` §1 y `.env.example`.
- El panel es un servidor **compartido**: no tocar `cacommerce`, `capostgres`, `imagehost`,
  `postimage` ni el proyecto `n8n`.

## 4. Pendientes priorizados

| # | Pendiente | Quién | Nota |
|---|---|---|---|
| 1 | **Cargar el menú real** (categorías → productos → precios → fotos) | Daniel | Empezado: existe la categoría `ONE BURGER` sin productos. Las fotos son URLs externas: no hay subida de archivos todavía. |
| 2 | **Notificaciones de pedidos a cocina** | Daniel + agente | Hoy `NOTIFICATIONS_DRIVER=dummy`: un pedido entra y nadie se entera salvo que alguien mire `/admin/orders`. Falta bot token + chat id de Telegram (o webhook n8n), y activar `OUTBOX_PROCESSOR_*`. |
| 3 | **Backups del Postgres + drill de restore** | Daniel (panel) | No hay backup programado. Es la única red si algo sale mal. |
| 4 | **Borrar el servicio duplicado huérfano `oneburguer-web`** (responde 502) | Agente | Evita confundir futuros deploys. |
| 5 | **Endurecimiento técnico**: scrypt más fuerte con rehash al login, CSP, extraer componentes exportados de las páginas (hoy `next build --webpack` falla) | Agente | No bloquea. |
| 6 | **Cerrar puertos innecesarios** de otros servicios del servidor (`capostgres` 5455, `postimage` 8585) | Daniel | No es de One Burger, pero están expuestos a internet. |
| 7 | **Personalización / quitar hardcodeo** (nombre, colores, logo, contacto, horarios, dirección) | **Cerrada (fases 1-4 y 6)** | Aprobada el 2026-09-10; brief en `ops/tasks/TASK-whitelabel-branding.md`. Sitio público, `/admin/settings`, apariencia con presets y contrato anti-hardcode, todo en `main` con CI verde. Queda la **fase 5 (subida de logos)**, opcional y con decisión de infraestructura pendiente: necesita un volumen persistente en Easypanel. |

## 5. Cómo continuar

```bash
# 1. Estado
git log --oneline -10 && git status -sb

# 2. Validación mínima (ver AGENTS.md)
npm run test && npm run lint && npm run typecheck && npm run build

# 3. Entorno local completo (Postgres + seed + server) para E2E
docker compose up -d
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/oneburger?schema=public" npx prisma migrate deploy
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/oneburger?schema=public" npx tsx prisma/seed.ts
# (ojo: el puerto 3000 de esta máquina lo ocupa un servicio VPN; usar 3210)
DATABASE_URL="..." APP_ENV=production NODE_ENV=production npx next start -p 3210
BASE_URL=http://127.0.0.1:3210 E2E_ALLOW_MUTATIONS=true npm run test:e2e:prod:full

# 4. Deploy (el webhook del panel no es fiable en esta instalación)
EASYPANEL_URL=... EASYPANEL_TOKEN=... npm run deploy:easypanel

# 5. Verificación en producción (solo lectura)
BASE_URL=https://oneburgernic.com npm run test:e2e:prod
```

## 6. Límites conocidos (resumen)

Detalle en `ops/production-readiness.md` §7. Lo importante:

- Rate limiting y dedup **en memoria** de proceso; `replicas: 1`. No escalar horizontal sin
  moverlos a un store compartido.
- Sin observabilidad externa (ni error tracking ni alertas): los incidentes se ven en los
  logs del contenedor.
- Login de clientes (OTP por WhatsApp) sin proveedor real: `/api/customer/auth/request-otp`
  responde 503 en producción. No afecta el checkout (no requiere sesión de cliente).
- Sin backup automático de base de datos.
- `X-Powered-By` visible (la imagen no carga `next.config.ts`); cosmético, se quita en Traefik.
- Los módulos fuera del MVP siguen en el repo (dominio + páginas de admin por URL directa).
