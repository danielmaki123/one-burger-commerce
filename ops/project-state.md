# Estado del proyecto — One Burger Commerce

> Actualizado: 2026-09-10 · Commit en `main`: `c785446` · Build en producción: `build-20260910-150351`
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

## 3. Infraestructura y secretos

- `EASYPANEL_URL` y `EASYPANEL_TOKEN`: solo en el entorno de quien ejecuta el deploy (nunca
  en el repo). El token da acceso total al servidor: **rotarlo** si se compartió por chat.
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
| 7 | **Personalización / quitar hardcodeo** (nombre, colores, logo, contacto, horarios, dirección) | En curso | Aprobada el 2026-09-10; brief y decisiones en `ops/tasks/TASK-whitelabel-branding.md`. **Fases 1, 2 y 3 cerradas** (núcleo, sitio público y `/admin/settings`). Siguiente: fase 4 (colores editables con presets y aviso de contraste) y fase 6 (barrido anti-hardcode). Pendientes de decisión: las opciones de hora de retiro (`19:30`–`21:00`) siguen siendo una lista fija, y la subida de logos (fase 5, opcional) necesita un volumen persistente en Easypanel. |

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
