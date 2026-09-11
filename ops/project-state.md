# Estado del proyecto — One Burger Commerce

> Actualizado: 2026-09-12 · Último deploy a producción: `build-20260911-191047` (commit `abc2183`)
> Este documento es el punto de entrada para retomar el trabajo. Mantenerlo al día al cerrar cada tarea.
> Para arrancar en un chat nuevo: `ops/tasks/START-HERE.md`.

## 1. Qué está vivo hoy

| Cosa | Valor |
|---|---|
| Dominio público | **https://oneburgernic.com** (canónico) y `https://www.oneburgernic.com` — ambos con certificado. El apex y `www` sirven **solo el landing** |
| App de pedidos | **https://menu.oneburgernic.com** |
| Admin | **https://admin.oneburgernic.com** (la sesión está atada al host: hay que iniciar sesión en el host del panel, no en el apex) |
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

**Dominios y landing (tarea nueva, 2026-09-10)**

- **Commit 1 — el apex muestra el landing.** `oneburgernic.com` y `www` sirven una
  experiencia a pantalla completa con la animación de scroll del mock aprobado
  (`one burger/frames-scroll-hamburguesa - Copy`): 37 frames que avanzan según el scroll y
  un botón MENU que lleva a `https://menu.oneburgernic.com`.
  - `src/shared/config/host-routing.ts` clasifica el host (marca / menu / admin / otros) y
    decide la ruta; es puro y tiene tests. El proxy solo lo traduce a Next.
  - El landing es un **rewrite** de `/` (no un redirect): la URL visible sigue siendo la
    raíz. También queda accesible en `/landing` para probarlo en cualquier entorno.
  - `localhost`, las IPs y el host de Easypanel no se clasifican: el entorno local y la
    suite E2E siguen sirviendo la app de pedidos sin cambios.
  - Se respeta `prefers-reduced-motion` (deja un frame fijo) y la secuencia se precarga de
    forma progresiva; el mock original no hacía ninguna de las dos cosas.
  - Frames: al repo entra la secuencia curada de 37 (3.26 MB) en `public/landing/frames/`.
    El export crudo de 120 (11.5 MB) y la carpeta de trabajo `one burger/` quedan en
    `.gitignore`. El mock usa 37 de los 120: cambiar a la secuencia completa (más suave)
    es cambiar una constante en `src/modules/landing/domain/landing-frames.ts`.
  - Los subdominios `menu.` y `admin.` ya resuelven por DNS y responden con HTTPS (los creó
    Daniel antes de este trabajo).

- **Commit 2 — separación de dominios.** Cada host sirve una sola parte del producto:
  - `oneburgernic.com` (y `www`): **solo** el landing. `/` se reescribe a `/landing`; el
    resto de las páginas se redirige al host de pedidos conservando path y query, y
    `/admin` al host del panel.
  - `menu.oneburgernic.com`: la app de pedidos completa. `/admin` se redirige al panel.
  - `admin.oneburgernic.com`: **solo** el panel. Su raíz entra a `/admin` y cualquier otra
    página se redirige al host de pedidos.
  - Assets, `/_next`, `manifest.webmanifest`, `sw.js`, `robots.txt` y los frames del
    landing nunca se redirigen: el matcher del proxy ya los deja fuera.
  - Si no se puede deducir el subdominio (local, IP, host de Easypanel) no hay redirección:
    todo se sirve igual que siempre, que es lo que mantiene sano el entorno local y el E2E.
  - `MENU_APP_URL` y `ADMIN_APP_URL` permiten forzar los destinos sin tocar código.

  Matriz verificada contra el build de producción con `Host:` inyectado:

  | Host | `/` | `/menu` o `/cart` | `/admin` |
  |---|---|---|---|
  | apex / www | landing (rewrite, 200) | 307 → `menu.*` | 307 → `admin.*` |
  | `menu.*` | app de pedidos (200) | 200 | 307 → `admin.*` |
  | `admin.*` | 307 → `/admin` | 307 → `menu.*` | guard de sesión |
  | local / IP | app de pedidos (200) | 200 | guard de sesión |

- **Cobertura E2E del landing** (`tests/e2e/landing.spec.ts`): además del HTML del servidor,
  se verifica en un navegador real que **los frames avanzan al hacer scroll** (llega al
  último) y que con `prefers-reduced-motion` el frame queda fijo. Esa parte se agregó al
  verificar antes del deploy, porque ningún test la cubría: los unitarios solo prueban la
  matemática del scroll y el render del servidor. Suite E2E completa: **17/17**.
- **Verificación de los tres dominios** (`tests/e2e/production-hosts.spec.ts`, solo
  lectura, `npm run test:e2e:prod:hosts`): comprueba el landing en el apex, las
  redirecciones a `menu.` y `admin.`, que la app responde en su subdominio y que los frames
  se sirven sin redirigir. Se salta sola si `BASE_URL` no es el dominio de marca, así que
  no afecta la suite local.
  - **Pre-flight contra producción (antes del deploy)**: los 6 casos fallan exactamente en
    lo que introducen los commits 1 y 2 (el apex todavía devuelve 200 en `/menu`, `/admin`
    redirige al login del host actual y los frames dan 404). Eso confirma que el arnés mide
    lo que dice medir; tienen que quedar verdes con el deploy.

### Deploy del landing y la separación de dominios (2026-09-10)

Desplegado con el OK del owner, `build-20260910-230239`, con una sola llamada a
`deployService` sobre el servicio existente. **No se creó ni se reconfiguró nada.**

Antes del deploy se corrieron los 6 casos de `production-hosts.spec.ts` contra producción
y fallaban exactamente en lo que introducen los commits; **después del deploy pasaron los
6**. Además, contra el sitio real: smoke productivo **4/4** y los 8 casos de
`landing.spec.ts` **7/7** (la animación avanza, el botón aparece al terminar, se alcanza
por teclado, movimiento reducido y 375 px).

Cambio de última hora pedido por el owner: **el botón MENÚ ya no es fijo desde el arranque,
se revela al terminar la animación**. Se ata al último frame (`shouldRevealMenuButton`).

### Auditoría del landing y rediseño del botón (2026-09-10)

Desplegado `bb2a7ca` como `build-20260910-234250`. Informe completo en
[`ops/audit-landing.md`](audit-landing.md), con todos los números medidos contra el sitio
real con `scripts/audit-landing*.mjs` (rendimiento, celular con datos lentos y cascada).

- **El botón acumulaba cuatro defectos medidos**: borde de 1 px **y** sombra ancha en el
  mismo elemento (patrón que la guía de diseño prohíbe), tres capas de sombra más un
  degradado de brillo, `font-weight: 950` que **no existe** (la fuente solo trae 400 y
  700: se midió que 700/900/950 rinden igual) y tracking de 0,16em en mayúsculas. Ahora es
  una pastilla ámbar sólida sin borde ni sombra, peso 700 real, 16 px y tracking 0,06em.
- **`MENU` → `MENÚ`**: faltaba la tilde.
- **Accesibilidad**: el texto "Deslizá" se anunciaba a lectores de pantalla sin aportar
  nada (ahora `aria-hidden`) y medía 11,2 px (ahora 12). `100dvh` en vez de `100vh`.
- **Rendimiento**: en celular con datos lentos la primera frame tardaba 11,4 s. **La
  hipótesis inicial era incorrecta** (se secuenció la precarga y no cambió nada): la
  cascada real muestra 327 KB, de los cuales **135 KB son JavaScript** y **81 KB son dos
  pesos de Fraunces que el landing no usa**. Se agregó un póster de la primera frame a
  24 px embebido como data URI (~1 KB) que elimina la pantalla negra. La causa de fondo
  queda documentada con tres opciones, sin aplicar: el owner pidió dejarlo así por ahora.
- La secuencia de 37 frames salta dos veces (movimiento por frame de 1 a 30) porque cubre
  el 32 % del video. Es la secuencia elegida a propósito; los 120 frames la emparejarían.

Verificado en producción: `6/6` dominios, `4/4` smoke y `8/8` landing (más 1 saltado).

- El botón se oculta con **opacidad, nunca con `visibility: hidden`**: la primera versión
  usaba `visibility` y el test destapó que así el elemento desaparece del árbol de
  accesibilidad, con lo que un usuario de teclado se quedaba sin forma de llegar al menú.
  Ahora sigue siendo enfocable y `:focus-visible` lo muestra al instante.
- Con `prefers-reduced-motion` no hay animación que esperar, así que el botón se muestra
  enseguida en vez de esconderse detrás de un scroll largo que ya no muestra nada.

### El JavaScript del landing: medido, y no es lo que parecía (2026-09-10)

El owner pidió "sacar el JavaScript del landing" porque la carga se siente lenta. Se midió
antes de tocar nada, con una página de prueba **sin un solo componente de cliente**
(`/landing-lite`, borrada después) y con `scripts/experiment-landing-js.mjs` bloqueando el
JS desde el navegador:

| medición | resultado |
|---|---|
| chunks que carga `/landing` | 70 + 42 + 8 + 5 + 4 = **129 KB** |
| chunks que carga `/landing-lite` (cero componentes de cliente) | **125 KB** (idénticos menos uno de 4 KB) |
| primera frame en 4G lento **con** JS | 11,4 – 14,4 s |
| primera frame en 4G lento **con el JS bloqueado** | 8,9 s |

Conclusión: de los 135 KB de JavaScript del landing, **solo 4 KB son del landing**. Los
129 KB restantes son el runtime del App Router de Next, que se descarga en toda la app
(incluido `/menu`) y no se puede quitar desde el código de la página: aun con cero
componentes de cliente, Next sigue hidratando el árbol. La única forma real de sacarlos
es **servir el landing como HTML estático fuera de la app**.

Los frames también se midieron (`scripts/experiment-frames-weight.mjs`, commiteado como
herramienta de diagnóstico):

| variante | KB/frame | 37 frames | diferencia de pixeles |
|---|---|---|---|
| actual 720 | 93 | 3,45 MB | — |
| 720 q0.6 | 73 | 2,69 MB | 1,0 % |
| 540 q0.65 | 50 | 1,86 MB | 1,2 % |
| 480 q0.55 | 39 | 1,43 MB | 1,4 % |

Bajar la resolución no tiene margen: los frames ya están 1:1 con el slot de escritorio
(680 px) y por debajo de retina en celular. La única reducción segura es a igual tamaño y
menor calidad (**−21 % de peso con 1 % de diferencia**).

**Decisión del owner: no aplicar ninguna de las dos.** El JS del landing (4 KB) no vale una
reescritura, y el peso de los frames se deja como está. Las dos palancas quedan medidas y
documentadas por si se retoman.

### Deploy del caché de frames (2026-09-11)

Desplegado `d6e4512` como `build-20260911-140759` (`deployService` sobre el servicio
existente, sin tocar configuración).

El commit de caché (`e1224fe`) estaba en `main` desde el día anterior pero **no desplegado**:
el sitio seguía respondiendo `Cache-Control: public, max-age=0` en los frames, así que cada
visita revalidaba frame por frame contra el servidor (un viaje de ida y vuelta antes de
poder dibujar cada imagen). Ahora responde:

```
Cache-Control: public, max-age=31536000, immutable
```

Esa es la palanca que sí se cobró y no cuesta código: en visitas repetidas los 3,45 MB de
frames salen del caché de disco en vez de revalidarse. Es además la única que no toca ni el
JavaScript ni los assets.

Verificado: `4/4` smoke, `6/6` dominios, `health` ok y `readiness` 200.

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

### Checkout sin redundancias (2026-09-11)

Ejecutada `ops/tasks/TASK-checkout-ux.md` en cuatro commits (`2832a93`, `31457fd`, `9023b6f`,
`aba4156`) y **desplegada** como `build-20260911-145656` (`1aa7ce9`).

Lo que se midió antes de tocar nada, renderizando el checkout con dos productos:

| Texto | Veces | Ahora |
|---|---|---|
| `Confirmá tu pedido` | 2 | 1 |
| `Tu pedido` (encabezado) | 2 | 1 (`Resumen del pedido`) |
| `Total a pagar` | 3 | 1 |
| Botones `Confirmar pedido` | 3 (**2 visibles a la vez**) | 1 visible por viewport |
| `Subtotal` / `Empaque` / `Listo para confirmar` | 2 cada uno | 1 cada uno / eliminado |

- **Un solo resumen.** Carrito y checkout comparten `OrderSummaryCard`
  (`(public)/_components/order-summary-card.tsx`). Desaparecen "Tu bolsa", "Tu pedido" y
  "Total estimado": ahora los tres son "Resumen del pedido".
- **Un solo CTA visible por viewport.** En el DOM quedan dos (uno por viewport, `hidden
  lg:block` y `lg:hidden`); visible, exactamente uno. En móvil además se quitó la fila de
  total de la barra fija porque el importe ya viaja en la etiqueta del botón: el total se
  veía dos veces.
- **El CTA nunca arranca deshabilitado.** El defecto era peor de lo que parecía: la clase
  `disabled:opacity-100` **anulaba la señal visual de deshabilitado**, así que el botón
  ámbar parecía activo y no respondía, con el mismo mensaje repetido 2 o 3 veces. Ahora al
  tocar se marca el campo, se lo enfoca y hay **un** mensaje junto al campo.
- **El contador cuenta unidades** en carrito y checkout, que es lo que ya contaba el badge
  del header. Antes el carrito contaba líneas: dos productos de 3 unidades daban "2
  productos" en un lado y "6 items" en el otro.
- **Turnos de retiro calculados.** `business-settings/domain/pickup-slots.ts` los deriva de
  `businessHours` + `pickupLeadMinutes`. "Lo antes posible" muestra la hora real; antes era
  una opción aparte que mandaba las 19:30 fijas, o sea mentía. Era la excepción conocida que
  `TASK-whitelabel-branding` había inventariado y nunca arregló.
- **Código muerto borrado**: `CheckoutTablePanel` (85 líneas, nunca se renderizaba),
  `getGeoErrorMessage` (19 líneas, geolocalización de delivery) y `checkoutSubtitle`. Vivían
  solo por sus tests; los tests se fueron con ellos. `checkout/page.tsx` bajó de **807 a 476
  líneas**.
- **Una decisión que conviene revisar**: el checkout **sigue sin bloquear pedidos por
  horario**. Si el local está cerrado avisa con `closedMessage` y ofrece la hora calculada
  más próxima, pero deja confirmar. Bloquear es una decisión de producto aparte y necesita
  validación en el servidor: `create-order.ts` solo verifica que la fecha sea parseable, no
  que caiga dentro del horario. Queda anotado abajo.

Verificado en local contra el build de producción: **25 E2E pasaron, 7 salteados, 0 fallos**
(6 del checkout, con el mismo chequeo a 375 px), 1000 unitarios, lint, typecheck, build y
`security:secrets` en verde. Los tests nuevos **tienen dientes**: reintroduciendo el bug a
propósito, el test de escritorio y el de 375 px fallan los dos con "Expected: 1, Received: 2".

Verificado además **en el sitio real** con un producto del menú de producción (solo lectura,
sin confirmar ningún pedido): un solo encabezado, un solo `Resumen del pedido`, un solo botón
visible, un solo `Total a pagar`, el CTA habilitado, el turno calculado
("Lo antes posible · …") y sin scroll horizontal a 375 px. Smoke 4/4 y dominios 6/6.

### Deploy del checkout (2026-09-11)

Desplegado `1aa7ce9` como `build-20260911-145656` con `deployService` sobre el servicio
existente. El panel tarda ~3 minutos y el `inspectService` marca el commit destino antes de
que el build termine, así que la confirmación real es el `version` de `/api/health`.

### El servidor ahora valida el estado operativo (2026-09-11)

Commits `3a67c37` y `ca474c8`, **desplegados** como `build-20260911-154014`.

El hallazgo no era el que yo había anotado como pendiente #9. Revisando el camino del
pedido encontré que **`isAcceptingOrders` no lo leía nadie**: existe en el schema, en el
zod, en el repositorio y en `/admin/settings` (hay un toggle "Aceptando pedidos"), pero
ningún caso de uso ni API lo consultaba. El owner podía apagarlo y los pedidos seguían
entrando exactamente igual: un control que le mentía.

El segundo agujero, más chico: la hora de retiro se aceptaba con solo ser una fecha
parseable, así que un POST con las 04:00 de un local que abre a las 12:00 se guardaba.

`business-settings/domain/order-acceptance.ts` es ahora la única fuente de verdad de "se
puede tomar este pedido", con tres motivos y mensajes en español:

| Motivo | Cuándo |
|---|---|
| `not-accepting-orders` | El negocio apagó "Aceptando pedidos" |
| `closed` | La hora de retiro cae fuera del horario de **ese día** |
| `pickup-time-in-past` | La hora de retiro ya pasó |

- El horario que manda es el del **día del retiro**, no el de hoy: se puede pedir para el
  sábado a las 13:00 aunque hoy sea viernes a las 23:00 y el sábado abra más tarde.
- Sin hora de retiro se evalúa "lo antes posible" (ahora + preparación), así que omitirla
  no es una forma de saltear el horario.
- Un horario incoherente (o que cruza la medianoche) cierra el local: mejor rechazar de
  más que aceptar un pedido a cualquier hora.
- El mensaje sale de `closedMessage`, el texto que el owner ya configura en el admin.
- La API responde **409** con `fields.acceptance` para que el checkout distinga un rechazo
  operativo de un error de datos y muestre el texto del servidor.
- **Antes de abrir no bloquea**: a las 03:00 se puede pedir para la hora de apertura. Lo que
  bloquea es que ya no quede ningún turno posible hoy.

El checkout aplica la misma decisión: si el negocio no acepta pedidos o ya no quedan turnos
hoy, el CTA queda deshabilitado y el motivo se muestra una sola vez, en vez de ofrecer un
botón que va a fallar. Es un bloqueo distinto al de "faltan datos": acá el cliente no puede
hacer nada para destrabarlo.

**Dos arreglos de arnés que salieron de esto:**

- Los tests de la ruta y de la página ahora **fijan el reloj** (viernes 19:00 en Managua).
  Sin eso, el estado operativo los hacía pasar o fallar según la hora a la que se corrieran.
- El **seed local abre de 00:00 a 23:59** (solo local/demo, nunca corre en producción) y
  refresca el horario al re-sembrar, porque el `update: {}` del upsert lo preservaba y una
  base ya sembrada conservaba el horario real.
- Se descubrió que la suite E2E completa **se pisaba consigo misma**: cada corrida entra al
  admin ~8 veces y el límite de producción (10/min por IP) hacía fallar el test del manager
  al correr la suite dos veces seguidas. El server local y `playwright.config.ts` ahora
  usan `ADMIN_LOGIN_RATE_LIMIT=200`. Verificado con dos corridas consecutivas: 26 pasaron,
  7 salteados, 0 fallos.

Verificado: 1018 unitarios (34 nuevos), lint, typecheck, build y `security:secrets` en
verde; E2E completo 26/7/0, incluido el camino bloqueado de punta a punta (el owner apaga
"Aceptando pedidos" en el admin → el checkout deshabilita el botón → al reactivarlo vuelve
a andar).

Verificado además **en producción** (solo lectura, sin crear ningún pedido):

- El primer turno del checkout es **"Lo antes posible · 12:00 p. m."**, la hora de apertura
  configurada, y no las 19:30 fijas de antes. Se puede pedir antes de abrir, para la hora
  de apertura: es a propósito.
- `POST /api/orders` con una hora de retiro fuera del horario responde **409** con
  `fields.acceptance: "closed"` y el `closedMessage` del owner. La sonda usó un `productId`
  inexistente a propósito, así que no podía crear un pedido ni en el peor caso.
- La lista de órdenes del admin sigue en **0**: no se creó nada.

### Deploy del estado operativo (2026-09-11)

Desplegado `ca474c8` como `build-20260911-154014`. Horarios reales del negocio al momento
del deploy: 12:00–22:00 todos los días, `America/Managua`, `pickupLeadMinutes` 25,
"Aceptando pedidos" encendido, `closedMessage` configurado.

### Retiro opcional y programable (2026-09-11)

Commits `6f85a3c`, `c101f82`, `b207593` y `abc2183`, **desplegados** como
`build-20260911-191047` (incluye la migración `pickupScheduled`).

Antes el cliente **tenía que** elegir una hora de una fila de chips, con el primer turno
preseleccionado. Si está en el local y manda la orden, eso es fricción sin sentido.

- **El retiro es opcional.** Por defecto el pedido es "lo antes posible". El control
  colapsado **muestra el estado** ("Lo antes posible · listo ~7:35 p. m.") en vez de
  esconderlo detrás de un botón genérico: si no, el cliente que no programa no sabe
  cuándo va a estar su comida.
- **Programar es una acción aparte**: al desplegar aparecen "Lo antes posible" y los
  turnos del local, calculados desde ahora + `pickupLeadMinutes`. Radios nativos con
  estilos del sistema.
- **Sin programar, el cliente no manda la hora.** Si mandara "ahora + preparación"
  calculado al cargar la página, un formulario lento la convertiría en una hora del
  pasado y el servidor la rechazaría. La completa el servidor con su reloj y la guarda,
  así la cocina siempre tiene para cuándo es. `pickupScheduled` se deriva de si vino una
  hora: el cliente no puede declararse programado sin haber elegido nada.
- **Una sola regla para bloquear.** El checkout evalúa la misma `resolveOrderAcceptance`
  que el servidor. Antes se bloqueaba cuando no quedaban turnos de la grilla, que es más
  estricto que la regla real: con cierre a las 22:00 y 25 min de preparación, a las 21:20
  ya no hay turnos pero el pedido entra 21:45 y el servidor lo acepta.
- **Si la hora programada queda vieja** mientras el cliente llena el formulario, el
  checkout vuelve solo a "lo antes posible".

### La hora de retiro ahora se ve en toda la cadena (2026-09-11)

Commit `c101f82`. Era el hallazgo de fondo: la hora se validaba, se guardaba y
**desaparecía**. El ticket de cocina armaba su línea de retiro como
`pickupNotes ?? "Retiro en <negocio>"`, así que una nota del cliente la tapaba; ningún
componente del admin leía `pickupTime`; y el cliente tampoco la veía en su confirmación.

- **Ticket de cocina**: línea `RETIRO:` propia, con la hora en la zona del negocio, y
  distingue "Programado para las 8:00 p. m." de "Lo antes posible (~7:35 p. m.)". Las
  notas del cliente siguen en su línea `INFO:`.
- **Bandeja y detalle del admin**: "Retiro 8:00 p. m. · Programado" (o
  "Retiro ~8:00 p. m. · Lo antes posible").
- **Confirmación del cliente**: fila "Hora de retiro", con `~` cuando es estimada.

**El semáforo se mide contra la hora prometida, no contra la antigüedad del pedido.** La
regla anterior pintaba de rojo cualquier pedido abierto hace más de 20 minutos
(`ADMIN_ORDER_LATE_MINUTES`, ahora borrada): uno programado para las 21:00 aparecía en
rojo a las 19:20, con una hora de margen. Un aviso que grita cuando no pasa nada deja de
significar algo. Ahora: **verde** hasta la hora, **naranja** desde que se pasa, **rojo**
a los 15 minutos. Los colores son tokens propios (`--pickup-on-time/past/late`), no los
del estado del pedido: un pedido puede estar "listo" e ir tarde contra lo que se prometió.

Verificado: 1069 unitarios (28 nuevos, con jsdom de la bandeja y del detalle), lint,
typecheck, build y `security:secrets` en verde. E2E completo: **27 pasaron, 7 salteados,
0 fallos**, incluido un test de punta a punta que programa una hora en el checkout y
comprueba que el pedido aparezca como "Programado" en la bandeja del admin.

**Tres cosas que solo aparecieron al correr el E2E en un navegador real** (commit
`b207593`): el checkout era más estricto que el servidor al bloquear; el nombre accesible
del botón salía pegado ("RetiroLo antes posible…") porque dos spans de bloque no dejan
espacio en el texto; y el radio con `sr-only` no era clickeable, así que el arnés no podía
tocarlo (ahora cubre la tarjeta con opacidad 0: sigue siendo nativo y además se puede
automatizar).

Verificado además **en producción** (solo lectura, sin confirmar ningún pedido): el
control colapsado muestra su estado **visible** —`"Lo antes posible · listo ~1:40 p. m."`
con caja real de 628×20 px, comprobado con `boundingBox` y no solo con el nombre
accesible—, ofrece 5 turnos, el CTA queda habilitado con su importe, y
`GET /api/admin/orders` responde 200 (si la columna `pickupScheduled` no existiera, Prisma
fallaría al mapear y daría 500). Smoke 4/4 y dominios 6/6.

### Deploy del retiro programable (2026-09-11)

Desplegado `abc2183` como `build-20260911-191047` con `deployService` sobre el servicio
existente. La migración `20260911160000_add_order_pickup_scheduled` la validó antes el job
`migrations` de CI contra un Postgres limpio, y el camino de escritura (crear un pedido
programado y verlo en el admin) se verificó en local contra un Postgres real.

### Auditoría del mock completo del checkout (2026-09-12)

El owner entregó un **mock completo** (`stitch_full_pwa_builder/`, export de Stitch de la marca "Casa
Antigua": 7 pantallas + su `DESIGN.md`). En vez de leerlo a ojo se **midió**: se escribió
`scripts/audit-checkout-mock.mjs`, que abre cada pantalla en **Chromium real a 375×812 y 1280×900** y
extrae textos, controles con su caja real, objetivos táctiles, contraste WCAG contra el fondo
efectivo, capas fijas, imágenes rotas, hosts externos, landmarks y ARIA; más dos sondas que **usan**
los controles para ver si responden. El informe es [`ops/audit-checkout-mock.md`](audit-checkout-mock.md).

Lo que la medición dejó claro:

- **No es nuestro producto.** Es un PWA de **delivery con dos sucursales**, pago en la puerta,
  propina para el repartidor, favoritos y reseñas. De las 7 pantallas, solo el checkout y la
  confirmación tocan esta tarea.
- **No se puede copiar.** Su checkout tiene **0 inputs** (se perdió la sección
  `Datos de Contacto (Guest Checkout)`: quedó el comentario sin markup) y **0 controles de hora**: no
  existe el retiro programable. Copiarlo borraría nombre, WhatsApp y hora de retiro, los tres exigidos
  por el servidor.
- **No funciona.** En el checkout el CTA no tiene `onclick` y tocar sucursal, método de pago o propina
  **no cambia nada** (estado visual idéntico antes/después); en la confirmación los 4 enlaces son
  `href="#"`. La única pantalla funcional es la de personalizar platillo.
- **No es accesible.** Las 7 pantallas **bloquean el zoom**, hay **0 `role`** y **0 `aria-live`** en
  todo el mock, hasta **81 "controles falsos"** por pantalla (`<div>` con cursor de mano que no se
  alcanzan con teclado), 15 de 16 controles del checkout por debajo de 44 px y **45 fallos de
  contraste verificables**. (Dos aparentes de la confirmación quedaron excluidos: caen sobre
  degradado y no se pueden afirmar sin la imagen de fondo.)
- **No cierra sus cuentas ni su design system.** El seguimiento suma C$795 + C$70 + C$78 = **C$943** y
  muestra **C$858**; y `DESIGN.md` declara 44 colores de los que el checkout usa **10 %**, la home 9 %
  y el menú 4 % (cada pantalla trae su propio `tailwind.config` inline).
- **Sin escritorio.** El checkout queda anclado a 448 px y la confirmación no tiene ancho máximo (su
  CTA mide 1240 px a 1280 px de viewport); la home usa un marco de altura fija de 844 px y a 375×812
  su barra inferior **queda fuera del viewport**.
- **Lo que sí aporta:** el **rango de preparación** ("20-30 min", "Listo en aprox. 20-30 min"), el
  estimado en la confirmación, la **dirección del local** junto al retiro (**fase 3 nueva**) y el
  patrón de edición por ítem. También sirve de referencia visual para `/menu`, el seguimiento y el
  historial, que son **otras tareas** (no el checkout).

**No se escribió código de producto**: solo las herramientas de medición y el informe. El mock no se
commitea (es la carpeta de trabajo del owner).

El owner pidió después **adoptar el mock**: copiar su orden, sus colores y todos sus botones, con la
regla de que lo que no tenga API se valore para implementar y **no quede solo como texto**. Eso está
traducido a un programa con 5 reglas (ningún control decorativo, nada hardcodeado, la paleta como
preset que pasa el test de contraste, TDD por tarea, y 375 px + 1280 px porque el mock no tiene
escritorio), una **matriz de adopción** (mock → nuestro control → API/estado → test) y **7 tareas en
el orden del mock**: [`ops/tasks/TASK-mock-adoption.md`](tasks/TASK-mock-adoption.md). `TASK-checkout-v2`
queda absorbida como la tarea T5. Falta tu decisión sobre la tipografía (D-A), sobre la ola 2
(segunda sucursal, delivery, reseñas, promos, favoritos, método de pago, vuelto, PIN) y confirmar el
orden (D-C).

### Adopción del mock · T1.1: la paleta del mock como preset (2026-09-12)

Primer incremento del programa (`ops/tasks/TASK-mock-adoption.md`, ola 1, T1.1), con TDD: primero el
test que falla, después el preset.

- **Test rojo**: `color-contrast.test.ts` → "incluye la paleta del mock completo, con sus colores
  reales". Falló como debía (`falta el preset con la paleta del mock: expected undefined to be
  defined`) antes de tocar `color-presets.ts`.
- **Verde**: el preset `pimienta` ("Pimienta") con los **colores reales del mock medido**: primario
  `#d32f2f` (el rojo del CTA), lienzo `#faf1d6` (la crema), tarjeta `#fffdf9`, tinta `#1f1916` y
  acento `#efe2c5`. No hubo que corregir ningún tono: **la paleta del mock pasa el control de
  contraste de nuestro sistema** (el texto del botón da 4,75:1 y el texto sobre el lienzo 15,4:1),
  cosa que sus propias pantallas no logran porque usan blanco de 12 px sobre naranja (3,59:1).
- **Sin datos hardcodeados**: es un preset más; el owner lo aplica desde `/admin/settings` y puede
  cambiar cualquier color. El default del sitio no cambia.
- **T1 completa**: T1.2 y T1.3 se cerraron después (ver abajo).
- **Verificado en el camino real** (Postgres 17 local + migraciones + seed + `next start -p 3210` con
  el build que sirve el preset): **E2E completo 28 pasaron, 7 salteados, 0 fallos**. Se sumó un caso
  nuevo, "la paleta del mock se aplica como preset y se ve en la vista previa (375 px)", que entra al
  admin, toca el preset y lee los colores del **navegador real** sobre la vista previa en vivo
  (`--brand` `#d32f2f`, `--background` `#faf1d6`, `--card` `#fffdf9`), comprueba que el botón cumple
  el mínimo táctil de 44 px y que **sin guardar el sitio publicado no cambia**. El test **tiene
  dientes**: con una expectativa falsa a propósito falla mostrando `Received: "#d32f2f"`.

### Adopción del mock · T1.3: escala tipográfica, radios y sombras como tokens (2026-09-12)

Segundo incremento de T1, también con TDD, y el que cierra la capa de diseño: **la escala del mock
existe una sola vez**, en `globals.css`, y las pantallas de T2-T7 la consumen.

- **Test rojo**: se agregó a `business-settings-style.test.ts` el bloque "tokens del mock (escala
  tipográfica, radios y sombras)", que parsea los bloques `@theme` de `globals.css`. Falló como debía
  antes de tocar el CSS: 5 casos en rojo (`falta --text-display`, `expected undefined to be '1rem'`,
  `falta --shadow-card`). Después, el mismo camino para los consumidores:
  `home-page-helpers.test.ts` en rojo (`getHomeBrandNameClassName is not a function`).
- **Verde**: los **13 pasos tipográficos** del `DESIGN.md` del mock (display 30/38/800 en celular y
  40/48/800 en escritorio, headline, title, body, caption y label) con su interlineado, su peso y su
  tracking, en `rem` y **nunca en `px`** —el mock bloquea el zoom en sus 7 pantallas y eso no se
  copia—; las curvaturas de tarjeta (16 px) y panel (24 px); y las **tres elevaciones** del mock,
  teñidas con `color-mix()` sobre `--brand` para que sigan el color que el owner elige en
  `/admin/settings` en vez de un gris fijo.
- **Una desviación, a propósito y documentada**: su `label-sm` de 10 px entra como 12 px. Es el piso
  legible en un teléfono real, y el audit ya lista el texto diminuto del mock entre los defectos que
  no se arrastran.
- **Primer consumidor real** (y lo que hace que los tokens no sean código muerto): el título del hero
  de la home pasó de tres tamaños sueltos (`text-3xl`, `sm:text-[2.25rem]`, `lg:text-[2.5rem]`) a
  `text-display lg:text-display-lg`, y el nombre del negocio del encabezado a `text-headline`. En el
  camino, ese nombre pasó de `<p>` a `<h1>`: la home **no tenía ningún h1**, así que la página no
  tenía título para un lector de pantalla ni para un buscador.
- **Verificado en el camino real** (Postgres 17 local + migraciones + seed + `next start -p 3210` con
  el build que sirve los tokens): **E2E completo 33 pasaron, 7 salteados, 0 fallos** (antes 28; los 5
  nuevos son `tests/e2e/design-tokens.spec.ts`). Ese spec **mide en el navegador real** los dos anchos
  que exige el repo: a 375 px el paso display da 30 px/38 px/800 y a 1280 px la variante `-lg` da
  40 px/48 px/800, con su tracking; además comprueba que las sombras se resuelven con el color
  configurado (si `--brand` no llegara, `color-mix()` daría transparente) y que las curvaturas son
  16/24 px.
- **No se re-viste el admin**: las curvaturas nuevas son tokens aparte (`rounded-card`,
  `rounded-panel`) y no se tocó la cadena `--radius-*` global, que el mock no cubre.

### Adopción del mock · T1.2: Plus Jakarta Sans como tercera tipografía (2026-09-12)

Tercer y último incremento de T1 (**T1 cerrada**: la capa de diseño ya está completa). Decisión D-A:
la tipografía del mock entra como **opción nueva**, no reemplaza a Fraunces ni a Inter.

- **Test rojo**: `business-settings.schema.test.ts` — "acepta las tres tipografías del build y rechaza
  una que no existe" falló como debía (`BusinessSettingsError: ... errores de validación` al pedir
  `jakarta`); `settings-client.test.tsx` en rojo en "ofrece las tres tipografías con su nombre real y
  previsualiza la elegida"; y el contrato del layout en rojo (`expected ... to match /className=\{fontVariables\}/`).
- **Verde**: `jakarta` entra en `FONT_CHOICES`, con sus **dos pesos reales** (400 y 700) en
  `src/app/fonts/plus-jakarta-sans-{regular,bold}.ttf` (63 KB cada uno, SIL OFL) y la variable
  `--font-jakarta` en el layout raíz. El `font-weight: 800` de la escala del mock resuelve a 700, que
  es el peso que el diseño usa.
- **Dos bugs latentes que aparecieron al agregar la tercera opción** (los dos por listas fijas de dos):
  el desplegable del admin mostraba `font === "fraunces" ? "Fraunces" : "Inter"`, así que la tercera
  opción se llamaba "Inter"; y la vista previa usaba el mismo ternario, así que la tercera se
  previsualizaba con la tipografía equivocada. Ahora los nombres salen de `FONT_LABELS` y la vista
  previa deriva `var(--font-<elección>)`.
- **El layout ya no elige tipografías a mano**: los `localFont` viven en un objeto
  `satisfies Record<FontChoice, ...>` y el `<html>` recibe todas las variables derivadas. Antes el
  `className` nombraba dos; agregar una tercera y olvidarla ahí dejaba la variable sin definir y el
  navegador caía a la del sistema **sin ningún error**. El `satisfies` hace que el compilador frene
  si `FONT_CHOICES` crece sin su fuente.
- **El contrato tiene dientes** (comprobado): renombrando `plus-jakarta-sans-bold.ttf` el test falla
  con `falta src/app/fonts/plus-jakarta-sans-bold.ttf`; el archivo se restauró después.
- **Verificado en el camino real** (mismo Postgres + build servido en `next start -p 3210`, con la
  CSS servida comprobada: `font-family:jakarta`): **E2E completo 34 pasaron, 7 salteados, 0 fallos**
  (antes 33). El caso nuevo entra al admin a 375 px, comprueba que el desplegable ofrece las tres con
  su nombre real, elige una, y **mide en el navegador real** que la vista previa usa esa familia y que
  `document.fonts.check('700 16px ...')` es `true` —o sea que la fuente se descargó de verdad, no que
  la variable exista—; y que **sin guardar** el sitio publicado conserva la suya.

### Adopción del mock · T2: la home en el orden del mock (2026-09-12)

Primer pantalla de la ola 1. Se adoptó el **orden** del mock (de arriba hacia abajo: estado del
local → buscador → categorías → destacado → productos → información del restaurante) y su anatomía de
tarjeta, sin copiar lo que no funciona ni lo que no existe.

- **Test rojo**: `home-page-helpers.test.ts` sumó 15 casos (estado operativo, estimado de retiro,
  aplanado del menú, búsqueda y agregado rápido) que fallaron como debían
  (`TypeError: resolveHomeOpenState is not a function`). Después, `page.dom.test.tsx` (jsdom) cubre la
  pantalla armada: productos, chips, buscador, agregado al carrito e información del local.
- **Estado del local**: usa **la misma regla que el servidor** (`resolveOrderAcceptance`), así que el
  cartel no puede decir "Abierto" mientras el checkout rechaza el pedido. Con los pedidos pausados
  muestra el mensaje del negocio; fuera del horario, el horario de hoy. Se calcula **en el cliente**
  (con el reloj del servidor sería la hora del build).
- **Estimado de retiro**: sale de `pickupLeadMinutes` ("Retiro: ~25 min"); sin tiempo configurado dice
  "lo antes posible" en vez de prometer una espera que no existe. T5 lo extiende al rango mín-máx.
- **Buscador real**: filtra el menú ya cargado con el **mismo criterio que el del menú**
  (`normalizeSearchText` se movió a `src/shared/lib/` para que no haya dos normalizaciones distintas),
  muestra cuántas coincidencias hay y, sin resultados, explica y ofrece limpiar.
- **El "+" ahora agrega de verdad**: el mock tiene un "+" de 24 px que no hace nada; acá agrega al
  carrito cuando el producto **no obliga a elegir** nada, mide 44 px y se anuncia (`role="status"`).
  Cuando el producto sí exige opciones, la tarjeta entera lleva a elegirlas y el "+" no se dibuja:
  ningún control que mienta. La tarjeta usa enlace estirado, así que hay **un solo** punto de tabulación.
- **Chips de categoría**: el mock rotula a mano ("Top #1", "Favorito", "Guarnición"); acá el chip sale
  de los datos (la categoría del producto), porque ese copy es del negocio del mock.
- **Información del restaurante**: dirección, horario y teléfono de `/admin/settings`, con "Cómo
  llegar" (la URL de mapas del admin, o una búsqueda armada con la dirección, o nada: nunca un botón
  muerto) y "Llamar" (`tel:`). El pie viejo de la home repetía dirección y horario: se retiró.
- **Verificado en el camino real** (Postgres 17 local + `next start -p 3210` con el build nuevo):
  **E2E completo 42 pasaron, 7 salteados, 0 fallos** (antes 34). El spec nuevo
  `tests/e2e/public-home.spec.ts` mide a 375 px (estado, estimado, enlaces, "+" de ≥44 px, buscador,
  agregar al carrito y verlo en `/cart`, sin scroll horizontal) y a **1280 px** (grilla de 4 columnas
  en una sola fila, sin scroll horizontal), porque el mock **no tiene escritorio**.
- **Pendiente dentro de la home**: los ❤️ favoritos y las ⭐ reseñas del mock son de la ola 2 (no hay
  modelo ni cuenta), y la barra inferior flotante del mock se reemplaza por la navegación que el sitio
  ya tiene en el layout público.

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
| 7 | **Personalización / quitar hardcodeo** (nombre, colores, logo, contacto, horarios, dirección) | **Cerrada (fases 1-4 y 6)** | Aprobada el 2026-09-10; brief en `ops/tasks/TASK-whitelabel-branding.md`. Sitio público, `/admin/settings`, apariencia con presets y contrato anti-hardcode, todo en `main` con CI verde. La **fase 5 (subida de logos)** se descartó: necesita un volumen persistente en Easypanel. Quedó **una excepción**: los turnos de retiro siguen hardcodeados y se trasladaron a la tarea #8. |
| 8 | **Checkout sin redundancias** (textos y botones repetidos) | **Cerrada y desplegada** | `ops/tasks/TASK-checkout-ux.md`. Cuatro commits (`2832a93`…`aba4156`), en producción como `build-20260911-145656`. El checkout pasó de 807 a 476 líneas, un solo resumen compartido con el carrito, un solo CTA visible por viewport y los turnos de retiro calculados desde la configuración. |
| 9 | **Validar el estado operativo en el servidor** | **Cerrada y desplegada** | Commits `3a67c37` y `ca474c8`, en producción como `build-20260911-154014`. `isAcceptingOrders` ya corta pedidos de verdad (antes no lo leía nadie) y la hora de retiro se valida contra el horario del día. Incluye el horario demo del seed y el límite de login del arnés E2E. |
| 10 | **Retiro opcional y programable + la hora visible en toda la cadena** | **Cerrada y desplegada** | Commits `6f85a3c`, `c101f82`, `b207593` y `abc2183`, en producción como `build-20260911-191047`. Incluye **una migración** (`pickupScheduled`). El retiro es opcional, la hora la resuelve el servidor, el ticket de cocina y el admin la muestran, y el semáforo va contra la hora prometida. Ver el detalle arriba. |
| 11 | **Adopción del mock completo (rediseño de la UI pública)** | **En ejecución · ola 1: T1 (tokens) y T2 (home) cerradas** | [`ops/tasks/TASK-mock-adoption.md`](tasks/TASK-mock-adoption.md). Plan **aprobado** el 2026-09-12 (D-A tipografía: Plus Jakarta Sans como tercera opción · D-B ola 2 completa **sin reseñas ni delivery** · D-C orden: tokens primero y después las pantallas en el orden del mock). **Reglas del programa**: ningún control decorativo (implementado con API/estado y test, o eliminado con motivo), nada hardcodeado, la paleta como preset que pasa el test de contraste, TDD por tarea, y verificación a 375 px **y 1280 px** (el mock no tiene escritorio). **Ola 1**: T1 tokens **cerrada** (T1.1 paleta ✅, T1.3 escala/radios/sombras ✅, T1.2 Plus Jakarta Sans ✅) · T2 home **cerrada** ✅ · **sigue T3 menú** · T4 producto · T5 carrito+checkout (absorbe `TASK-checkout-v2`) · T6 confirmación · T7 seguimiento e historial. **Ola 2** (aprobada): T8 multi-sucursal, T9 promos, T10 favoritos (**bloqueada**: necesita login de cliente real; el OTP da 503), T11 método de pago, T12 vuelto, T13 PIN de retiro. Evidencia del mock: [`ops/audit-checkout-mock.md`](audit-checkout-mock.md). |

## 5. Cómo continuar

```bash
# 1. Estado
git log --oneline -10 && git status -sb

# 2. Validación mínima (ver AGENTS.md)
npm run test && npm run lint && npm run typecheck && npm run build

# 3. Entorno local completo (Postgres + seed + server) para E2E
docker compose up -d
# ⚠️ `npm run build` NO regenera el cliente de Prisma (el Dockerfile y CI sí lo hacen).
# Después de tocar `schema.prisma` hay que correr `npx prisma generate` o el build
# compila bien y el runtime falla con "Unknown argument".
npx prisma generate
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/oneburger?schema=public" npx prisma migrate deploy
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/oneburger?schema=public" npx tsx prisma/seed.ts
# (ojo: el puerto 3000 de esta máquina lo ocupa un servicio VPN; usar 3210)
# ADMIN_LOGIN_RATE_LIMIT alto: la suite entra al admin muchas veces y con el límite de
# producción (10/min por IP) dos corridas seguidas se pisan y el test del manager falla
# por rate limit en vez de por permisos.
DATABASE_URL="..." APP_ENV=production NODE_ENV=production ADMIN_LOGIN_RATE_LIMIT=200 npx next start -p 3210
BASE_URL=http://127.0.0.1:3210 E2E_ALLOW_MUTATIONS=true npm run test:e2e:prod:full

# 4. Deploy — ⚠️ NO usar `npm run deploy:easypanel`: fusiona variables y puede crear
#    servicios. El deploy es UNA llamada a deployService sobre el servicio que ya existe:
#    POST {EASYPANEL_URL}/api/rpc/services/app/deployService
#    body {"json":{"projectName":"brunobot","serviceName":"oneburguerweb","forceRebuild":true}}
#    (tarda varios minutos; el POST puede cortar por timeout mientras el build sigue)
#    Verificar después: commit.sha vía services/app/inspectService + el sitio real.

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
