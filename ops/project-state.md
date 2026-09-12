# Estado del proyecto — One Burger Commerce

> Actualizado: 2026-09-12 · Último deploy a producción: 2026-09-12, commit `5a487ad`
> (deploy manual por API sobre el servicio `oneburguerweb`)
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

### Adopción del mock · T3: el menú, con el "+" que agrega de verdad (2026-09-12)

Segunda pantalla de la ola 1. La estructura del menú ya seguía el orden del mock (buscador → riel de
categorías → grilla de 2 columnas → precio); lo que faltaba era que sus controles **hicieran** algo.

- **Test rojo**: `menu-product-card.test.tsx` se reescribió como prueba de comportamiento (antes
  afirmaba clases CSS) y falló como debía (`Unable to find an accessible element with the role
  "button" and name "Agregar Taco de Birria al carrito"`). El helper del riel sumó 3 casos rojos en
  `menu-page-helpers.test.ts` (`getCategoryThumbnailUrl is not a function`).
- **El "+" ahora agrega**: el del mock mide **24×24 y no hace nada**; el nuestro mide 44 px, agrega al
  carrito y se anuncia (`role="status"` → "Agregado al carrito", el aviso que el mock promete y nunca
  muestra). Cuando el producto exige elegir opciones **no se dibuja un "+"**: la tarjeta entera lleva a
  la pantalla del producto, así que no queda ningún control que mienta. La tarjeta usa **enlace
  estirado**: un solo punto de tabulación y el botón por encima.
- **El agregado rápido es compartido** (T2 lo estrenó en la home): `canQuickAddProduct` y
  `buildQuickAddCartItem` viven en `src/shared/lib/product-quick-add.ts` con su propio test, y las dos
  grillas usan lo mismo. Si se duplicaba, la home y el menú podían decidir distinto.
- **El riel muestra la foto de la categoría** (como el mock). En nuestro modelo la categoría no tiene
  foto, así que sale de su primer producto pedible; sin fotos, el chip queda solo con el nombre en vez
  de mostrar un hueco.
- **Lo que NO se adopta, con motivo**: el mock pinta cada tarjeta con un color por categoría
  (`#3C882A`, `#4A2D1B`, `#C83E07`…) y le pone un rótulo fijo ("Top #1", "Favorito", "Guarnición").
  Nuestras categorías no tienen color en el modelo y el copy es del negocio del mock: inventarlos sería
  decoración sin dato. Si el owner los quiere, es un campo de categoría en el admin (queda anotado como
  candidato, no como deuda escondida).
- **Verificado en el camino real** (Postgres 17 local + `next start -p 3210` con el build nuevo):
  **E2E completo 47 pasaron, 7 salteados, 0 fallos** (antes 42), con `tests/e2e/public-menu.spec.ts`
  nuevo: a 375 px el "+" mide ≥44 px, agrega y el pedido aparece en `/cart`; el producto con opciones
  obligatorias no tiene botón que agregue; el riel filtra; el buscador filtra y no hay scroll
  horizontal. A **1280 px** las tarjetas se reparten en fila, con el mismo ancho y sin scroll.

### Adopción del mock · T4: la pantalla del producto en el orden del mock (2026-09-12)

Tercera pantalla de la ola 1. La pantalla ya tenía cantidad, modificadores con delta, notas y CTA fijo
con importe; lo que faltaba era **el orden del mock** y dos huecos de accesibilidad.

- **Test rojo**: `menu/[productId]/page.test.ts` sumó 3 casos y falló como debía: el orden
  (`expected 7345 to be less than 3178` — la cantidad estaba después de las opciones), la etiqueta de
  las notas (`Unable to find a label with the text of: Notas especiales`) y el anillo de foco
  (`peer-focus-visible:ring-2`).
- **El orden del mock**: título y descripción → **cantidad** → opciones → notas → CTA fijo. La cantidad
  estaba al final, después de las notas; ahora va donde el mock la pone.
- **Dos huecos de accesibilidad cerrados**: el campo de notas tenía un `<h2>` al lado pero **ninguna
  etiqueta asociada** (el placeholder no es una etiqueta), y los modificadores usan un input oculto con
  una tarjeta visual que **no mostraba el foco del teclado** — el mismo defecto que el audit le mide al
  mock ("controles no alcanzables con teclado"). Ahora la nota tiene su `label` y la tarjeta del
  modificador enciende el anillo con `peer-focus-visible:`.
- **Lo que ya estaba bien y queda cubierto por tests**: el CTA fijo con el importe (que cambia al
  elegir otra opción y se multiplica por la cantidad), el grupo obligatorio que **arranca con su primera
  opción elegida** (igual que el mock, así el CTA nunca queda muerto) y la cantidad anunciada con
  `aria-live`.
- **Verificado en el camino real** (Postgres 17 local + `next start -p 3210` con el build nuevo):
  **E2E completo 52 pasaron, 7 salteados, 0 fallos** (antes 47). `tests/e2e/public-product.spec.ts`
  comprueba a 375 px que el CTA mide ≥44 px, que el importe se multiplica con la cantidad, que la barra
  queda **fija** al scrollear, que la cantidad va antes de las notas (posición real en pantalla), que
  el pedido llega al carrito con sus notas y que no hay scroll horizontal; y a 1280 px que el CTA no se
  estira a lo ancho de la pantalla.

### Adopción del mock · T3.1: color por categoría (2026-09-12)

Pedido del owner al cerrar T4 ("color por categoría: sí"). El mock pinta cada tarjeta del menú con el
color de su categoría; eso necesitaba **un dato que no existía**, así que entra por el admin y no como
color fijo.

- **Contrato nuevo**: `Category.color` (opcional) con migración `add_category_color` (sin BOM, la
  verifica el test que ya existía) y validación `#rrggbb` en la API (crear y editar). El color vacío o
  `null` significa "sin color": la tarjeta vuelve al diseño del sistema.
- **Test rojo**: `src/modules/menu/domain/category-color.test.ts` (10 casos) falló como debía
  (`Cannot find package '@/modules/menu/domain/category-color'`); después, el caso del tinte en
  `menu-product-card.test.tsx` (`expected '' to be 'rgb(211, 47, 47)'`) y el del helper de la búsqueda.
  El contrato de la API tiene dientes comprobados por mutación: sin la validación `#rrggbb`, un color
  inválido pasa y el caso de uso revienta con 500 en vez de 400.
- **El texto encima lo elige el sistema, no el owner**: de los dos textos de la casa (oscuro `#1f1916`,
  claro `#f7fafc`) se usa el que más contraste da sobre el color elegido, y el admin **avisa** cuando ni
  el mejor llega a AA (mismo criterio que la paleta de apariencia: avisa, no bloquea). Sobre el rojo del
  mock el texto claro da 4,75:1; sobre el gris medio `#808080` el mejor posible es 4,4:1, así que ahí
  avisa. Un color a medio escribir no se puede guardar.
- **Dónde se ve**: en las tarjetas del menú (sección y resultados de búsqueda: los resultados llevan el
  color de *su* categoría, no el de la categoría abierta) y en la vista previa del admin. El botón de
  agregar rápido se invierte para seguir siendo legible sobre el color.
- **Un contrato que ya existía atajó un atajo**: la vista previa del admin llevaba un `C$` de ejemplo y
  `anti-hardcode-contract.test.ts` la marcó. Se sacó el importe: el preview muestra el color y el texto,
  no datos del negocio.
- **Verificado en el camino real** (Postgres 17 local + `next start -p 3210` con el build nuevo):
  **E2E completo 53 pasaron, 7 salteados, 0 fallos** (antes 52). `tests/e2e/admin-category-color.spec.ts`
  recorre el camino entero en el navegador: el owner escribe un color inválido (guardar deshabilitado y
  aviso), escribe `#d32f2f`, guarda, y en `/menu` mide el color **calculado** de la tarjeta
  (`rgb(211, 47, 47)` de fondo y de borde) y el del texto (`rgb(247, 250, 252)`); después lo borra y
  comprueba que la tarjeta vuelve al diseño del sistema.

### Adopción del mock · T5: carrito y checkout (2026-09-12)

La tarea que absorbe `TASK-checkout-v2`. Se hicieron sus fases **1, 3, 6 y 7**, y de la 2 la parte
que el owner había pedido explícitamente (que el campo se explique solo).

- **Contrato nuevo (fase 1)**: `pickupMaxMinutes` opcional en `BusinessSettings` con su migración
  (`add_pickup_max_minutes`, sin BOM), validado como entero **≥ `pickupLeadMinutes`** y tope 240. El
  esquema compara los dos números cuando vienen juntos en el payload y el caso de uso los compara
  contra lo guardado cuando llega uno solo: no se puede guardar un rango que termina antes de empezar.
- **El cliente ve una franja, la cocina sigue viendo una hora**: con máximo, el checkout y la
  confirmación dicen "listo entre 1:40 p. m. y 2:00 p. m."; la hora que **se guarda** y el ticket de
  cocina no cambian. Sin máximo, todo sigue como antes ("listo ~2:00 p. m.").
- **Test rojo**: `pickup-slots.test.ts` (5 casos del formateo del rango, incluido el cruce de
  medianoche: 23:50 + 20 min = 12:10 a. m.), `checkout/page.test.tsx` (la franja y el punto de retiro)
  y `pickup-schedule-field.test.tsx`. El contrato del schema y el del caso de uso tienen dientes
  **comprobados por mutación**: sin la comparación cruzada, un máximo menor que el mínimo se guarda.
- **Fase 3**: el checkout ahora dice **dónde se retira** (dirección del local, con enlace al mapa si el
  admin cargó `mapsUrl`). Con la dirección vacía la fila **no se dibuja**, en vez de mostrar un hueco.
- **Fase 6**: el prefijo por defecto del campo de WhatsApp salía del literal `+505`
  (`whatsapp-input-value.ts`). Es un dato del negocio en una plataforma whitelabel: ahora se deriva del
  teléfono configurado y el respaldo queda solo para cuando no hay ninguno. Aplica al checkout, al
  seguimiento y al historial.
- **Fase 7**: la edición por ítem **ya existía** en `/cart` (`updateQuantity`/`removeItem` con
  etiquetas por ítem). No se reescribió: se verificó en navegador real con `tests/e2e/public-cart.spec.ts`
  (sumar, restar, el subtotal cambia y volver a restar lo devuelve, quitar deja el carrito vacío).
- **De la fase 2 quedó pendiente la vista previa en vivo de los turnos** en el admin (mostrar qué
  turnos vería el cliente y hasta qué hora se puede pedir con los números que se están editando). El
  owner la había pedido; no entró en esta tanda y quedó anotada, no escondida. **Cerrada el
  2026-09-12**: ver "T5 · Fase 2" más abajo. La ayuda del campo sí se reescribió acá para que diga qué
  hace ("define el primer turno de retiro y hasta qué hora se puede pedir").
- **Fases 4 y 5 sin hacer, por decisiones abiertas**: pedidos para días futuros (D1) y presets de
  propina (D2) siguen sin respuesta del owner. Nada de eso se implementó a medias.
- **Verificado en el camino real** (Postgres 17 local + `next start -p 3210` con el build nuevo):
  **E2E completo 58 pasaron, 7 salteados, 0 fallos** (antes 53). Los specs nuevos son
  `admin-pickup-range.spec.ts` (el owner configura el máximo, el checkout promete la franja y se puede
  volver a una sola hora; y un máximo menor que el mínimo no se guarda, con el aviso a la vista) y
  `public-cart.spec.ts` (edición en línea, el punto de retiro en el checkout y 1280 px sin scroll).

### Adopción del mock · T6: la confirmación del pedido (2026-09-12)

La pantalla ya estaba casi entera (número, resumen, una sola confirmación y —desde T5— la franja de
retiro). Faltaba lo que el mock sí muestra y nosotros habíamos dejado a medias: **la segunda salida**.

- **Un prop declarado y sin usar**: `OrderSuccessView` recibía `onOrderAgain` y el page lo pasaba
  (`router.push("/menu")`), pero la vista **no lo usaba**. El enlace "Volver a la Carta" del mock no
  existía en ninguna parte. Ahora es un botón junto a "Ver mis pedidos", con el mismo alto de 56 px y
  en una fila a partir de `sm`.
- **Test rojo**: `order-success-view.test.ts` falló como debía (`expected ... to contain 'Volver a la
  carta'`). Los dos casos nuevos también verifican lo que el mock hace mal: **una sola** confirmación
  (su pantalla repite "¡Orden confirmada!" y "¡Recibimos tu pedido!") y **cero** enlaces `href="#"`
  (el mock tiene 4).
- **La decisión del enlace al menú**: el cuerpo de la confirmación ya era deliberadamente mínimo
  (sin detalle de ítems ni nombre del cliente: no es un recibo) y el menú ya es alcanzable desde ahí
  por la barra inferior en celular y por el pie en escritorio. Se agregó la acción igual porque el
  owner pidió mantener lo que muestra el mock, pero con la palabra del mock ("Volver a la carta"), así
  que la intención del test viejo (no convertirla en un recibo) sigue en pie y su aserción no se tocó.
- **Verificado en el camino real** (Postgres 17 local + `next start -p 3210` con el build nuevo):
  **E2E completo 61 pasaron, 7 salteados, 0 fallos** (antes 58). `tests/e2e/public-confirmation.spec.ts`
  crea un pedido de verdad y comprueba a 375 px que hay **una sola** confirmación, que el número de
  pedido se muestra, que la barra inferior no tiene enlaces muertos, que "Volver a la carta" lleva al
  menú y que "Ver mis pedidos" deja el pedido en el historial del dispositivo; y a 1280 px que las dos
  salidas quedan en la misma fila y sin scroll horizontal.

### Adopción del mock · T7: seguimiento e historial (2026-09-12)

La última pantalla de la ola 1. Acá no había que "copiar el mock" sino **arreglar lo que había quedado
a medias**: el historial tenía datos inventados y un botón que mentía.

- **Un control que mentía**: el botón decía "Volver a pedir" y lo único que hacía era abrir el detalle.
  Ahora dice **"Pedir nuevamente"** y vuelve a armar el pedido de verdad: las líneas se guardan con el
  pedido (`DeviceOrderItemRef`) y se agregan al carrito. Un pedido guardado **antes** de este cambio no
  tiene líneas: se ve, no se repite, y el botón no se dibuja (mejor eso que un botón inerte).
- **Datos inventados que salieron**: el resumen de cada tarjeta era un plato escrito a mano
  ("Sangría · ½ Litro", y "Aperol Spritz" para las mesas), y las mesas mostraban "Terraza · Mesa 12".
  Ahora el resumen sale de las líneas guardadas (`2 × Taco de Birria`) y la fila de la mesa no inventa
  un salón ni un número.
- **El timeline, con lo que el mock no tiene**: el mock dibuja 4 barras sin texto y `aria-hidden`.
  Nuestro timeline usa los pasos reales del pedido (5: incluye "Completada", porque un pedido de retiro
  termina cuando se retira), dice **"Paso 3 de 5"**, marca hecho / actual / pendiente, se lee con lector
  de pantalla y usa tokens (antes eran `emerald-900` y `sky-100` a mano). Un pedido cancelado no se
  dibuja como progreso hacia adelante.
- **El buscador del historial filtra de verdad** (el del mock tiene 4 bloques antes y después de
  buscar): por número de pedido o por plato, sin acentos y sin mayúsculas, con un estado vacío que
  explica y ofrece "Ver todos".
- **El estimado de retiro** aparece en la tarjeta ("Listo ~8:35 p. m.", aproximado si no se programó),
  con la hora que ahora viaja en el pedido guardado.
- **El recibo**: la tarjeta abre el detalle, que ya existía, con su nombre real ("Ver recibo").
- **De paso, una tilde**: el paso del timeline decía "En preparacion"; ahora dice "En preparación"
  (se ve en la pantalla pública).
- **Verificado en el camino real** (Postgres 17 local + `next start -p 3210` con el build nuevo):
  **E2E completo 66 pasaron, 7 salteados, 0 fallos** (antes 61). `tests/e2e/public-activity.spec.ts`
  crea un pedido, entra al historial y a 375 px comprueba que el resumen es el real ("1 × Taco de
  Birria"), que el progreso dice "Paso 1 de 5", que el estimado está, que **no queda rastro de los
  platos del mock**, que el buscador filtra (y que "sushi" no encuentra nada), que "Pedir nuevamente"
  arma el carrito y que "Ver recibo" abre el detalle; a 1280 px, sin scroll horizontal.

### Ola 2 · T11: la forma de pago (2026-09-12)

Primera tarea de la ola 2 (aprobada por el owner). El mock tiene "Efectivo / Tarjeta·POS" en su
checkout; el cobro sigue siendo **en el local**, así que el dato es informativo para la caja: no hay
pasarela ni cobro online.

- **Contrato nuevo**: enum `PaymentMethod` (`cash` / `card`) y columna `Order.paymentMethod` con
  **default `cash`** (migración `add_order_payment_method`): un pedido viejo nunca queda sin forma de
  pago. El caso de uso acepta solo esos dos valores (cualquier otro es 400 con el campo señalado) y sin
  dato asume efectivo, que es lo más probable cuando se cobra al retirar.
- **Dónde se ve**: el checkout pregunta "¿Cómo vas a pagar?" (tarjetas de 44 px, arranca en Efectivo),
  la confirmación del cliente agrega la fila "Forma de pago" y el **detalle del admin** muestra el
  chip: la caja necesita saber si preparar el vuelto.
- **El bug que cazó el E2E, no el unitario**: el adaptador de Prisma arma el `data` campo por campo y
  **no pasaba `paymentMethod`**, así que la API guardaba `cash` aunque el cliente hubiera elegido
  tarjeta. El test unitario pasaba porque el adaptador en memoria sí lo persiste; se vio al consultar
  la API con una tarjeta real (un pedido enviado como `card` volvía como `cash`). Corregido y
  re-verificado contra la API.
- **El patrón de los radios**: el input usa el overlay de opacidad 0 que el repo ya documentó en el
  control de retiro (no `sr-only`): con `sr-only` queda sin caja, las herramientas no pueden tocarlo y
  terminan clickeando la etiqueta de costado. Se probó primero con `sr-only` y falló exactamente así.
- **El límite de pedidos ahora es configurable por entorno** (`ORDER_CREATE_RATE_LIMIT`), por el mismo
  motivo que el del login del admin: la suite crea pedidos reales seguidos desde la misma IP y, con el
  límite de producción (10/min), terminaba midiendo el limitador en vez del checkout. En producción
  queda el default.
- **Verificado en el camino real** (Postgres 17 local + `next start -p 3210` con el build nuevo):
  **E2E completo 67 pasaron, 7 salteados, 0 fallos** (antes 66). El caso nuevo elige "Tarjeta" en el
  checkout, confirma el pedido y comprueba que la confirmación muestra "Forma de pago: Tarjeta".

### Ola 2 · T12: el vuelto del efectivo (2026-09-12)

El mock muestra "Pagas C$1.000 · Vuelto" en su historial. Acá el dato entra por el checkout, es
**opcional** y solo tiene sentido con efectivo: sirve en la caja, no en la cocina (la comanda no
necesita saber con qué billete paga alguien).

- **Contrato nuevo**: `Order.paidWithAmount` (decimal, opcional) con la migración
  `add_order_paid_with_amount`. **El cambio no se guarda**: se deriva del monto y el total, así un total
  corregido no deja un vuelto viejo en la caja.
- **Validación en el servidor** (dominio `payment-change.ts`): el monto tiene que alcanzar para pagar
  el total, ser mayor que cero y no ser absurdo — el tope es **relativo al total** (×20) y no un número
  fijo, porque la moneda la elige el negocio. Con tarjeta, un monto declarado se rechaza con el campo
  señalado en vez de calcular un vuelto que no existe.
- **Test rojo**: `payment-change.test.ts` (validación y cálculo), y en `create-order.test.ts` los dos
  casos de guardado y rechazo. El primer vector del redondeo estaba mal elegido (`500.005` no es
  representable exacto en binario): se cambió por valores sin ambigüedad, que es lo que el test quería
  decir.
- **Dónde se ve**: el checkout pregunta "¿Con cuánto vas a pagar?" solo en efectivo, con el **cambio
  estimado en vivo** y el aviso si el monto no alcanza; la confirmación agrega "Pagás con" y "Cambio";
  y el detalle del admin muestra el chip "Paga con C$… · Cambio C$…" para la caja.
- **Un race del arnés que quedó arreglado**: el helper de `public-activity.spec.ts` navegaba al
  historial apenas cambiaba la URL de la confirmación, antes de que esa pantalla terminara de leer el
  pedido y guardarlo en el dispositivo. Pasaba en algunos tests y en otros no (los del historial
  quedaban sin líneas). Ahora espera al resumen del pedido antes de navegar: el test dejó de depender
  de la velocidad de la máquina.
- **Verificado en el camino real** (Postgres 17 local + `next start -p 3210` con el build nuevo):
  **E2E completo 69 pasaron, 7 salteados, 0 fallos** (antes 67). Dos casos nuevos: pagar C$100 un
  pedido de C$35 muestra "Cambio estimado C$65.00" y después "Pagás con C$100.00 · Cambio C$65.00"; y
  con tarjeta el campo del vuelto no se pregunta.

### Ola 2 · T13: el PIN de retiro (2026-09-12)

El mock muestra "PIN de Retiro 4821 · Díctalo en caja". Entra como **código corto para dictar**, con un
límite escrito en el código: **no es un identificador ni un secreto**, no autoriza nada y no reemplaza
al número de pedido ni al token de seguimiento. Su único uso es que el cliente lo diga en caja y el
mostrador encuentre el pedido de un vistazo.

- **Contrato nuevo**: `Order.pickupPin` (texto, opcional) con la migración `add_order_pickup_pin`. Son
  **cuatro dígitos** con ceros a la izquierda, generados con azar del sistema; el generador se inyecta
  en el caso de uso (mismo patrón que el token) para que los tests sean deterministas.
- **El dominio es puro a propósito**: `pickup-pin.ts` no importa `crypto`, porque lo consume también la
  pantalla de confirmación, que corre en el cliente. El azar entra por parámetro desde el servidor.
- **Dónde se ve**: en la confirmación, en grande y con "Díctalo en caja al retirar"; en el **historial
  del dispositivo** (el cliente no siempre tiene el link a mano); y en el **detalle del admin**, donde
  la caja lo lee para entregar el pedido.
- **Lo que el PIN no hace, por diseño**: no autoriza, no identifica y **no se garantiza único entre
  pedidos**. Con cuatro dígitos hay 10.000 combinaciones y dos pedidos activos pueden compartirlo; el
  mostrador tiene el número de pedido y el nombre para desambiguar, igual que en un local real.
  Prometer unicidad global habría sido mentir (y pasar a seis dígitos no lo arregla).
- **Verificado en el camino real** (Postgres 17 local + `next start -p 3210` con el build nuevo):
  **E2E completo 69 pasaron, 7 salteados, 0 fallos**. El caso de la confirmación ahora comprueba que el
  PIN está a la vista y que son cuatro dígitos.

### Ola 2 · T9 (parte 1): el motor de promos por cantidad (2026-09-12)

El mock muestra "PROMO B2G1" (llevá 3, pagá 2). Lo primero que encontré al abrir la tarea: **los
cupones existen solo en la base** — no hay campo en el checkout para escribir un código ni pantalla en
el admin para crearlos. Así que T9 va por partes y esta es la primera: el motor.

- **Contrato nuevo**: `CouponType` suma `bogo`, y `Coupon` suma `buyQuantity`, `freeQuantity`,
  `scopeType` (`all`/`category`/`subcategory`/`product`) y `scopeId` (migración `add_coupon_bogo`).
- **El descuento lo calcula el servidor** desde el código que manda el cliente, nunca desde un monto:
  se pagan las unidades **más caras de cada bloque** y salen gratis las más baratas (el criterio de un
  2×1 de local), y la promo se repite por cada bloque completo (6 unidades con B2G1 → 2 gratis). El
  motor es general: `buy=1, free=1` es un 2×1 y `buy=2, free=1` es el B2G1 del mock.
- **Un vector mal elegido que corregí antes de seguir**: mis primeros tests decían "con dos unidades,
  una gratis" para un B2G1 —eso es un 2×1, no un B2G1—, así que la especificación estaba mal, no el
  código. Los reescribí con la semántica correcta (un bloque de B2G1 son tres unidades).
- **Un invariante que arreglé de paso**: el uso del cupón se consumía **antes** de calcular el
  descuento. Con la promo eso importa: un código que no aplica al pedido se rechaza (409) y **no quema
  un uso**. Ahora el descuento se calcula primero y recién después se reserva el uso (verificado contra
  la API: un intento rechazado dejó `usedCount` en 1, no en 2).
- **Verificado contra la base y la API reales**, no solo con dobles: creé un cupón B2G1 por SQL, mandé
  `POST /api/orders` con 3 tacos de C$35 y el código, y la respuesta fue `subtotal 105 · discount 35 ·
  total 70`; con 2 unidades el mismo código devuelve 409. Después limpié el cupón y el pedido de
  prueba de la base local.
- **Lo que falta para cerrar T9** (anotado, no escondido): (b) el campo del código en el checkout con
  su validación pública, para que el cliente pueda usarlo; y (c) la pantalla del admin para crear y
  editar promos, sin la cual el owner depende de tocar la base. Sin (c), T9 no está terminada.

### Ola 2 · T9 (parte 2): el código de promo en el checkout (2026-09-12)

El cliente ya puede escribir un código y saber si sirve **antes** de confirmar. El descuento definitivo
lo sigue calculando el servidor al crear el pedido: el endpoint público devuelve la forma del cupón,
nunca un monto.

- **Una sola fuente de verdad para "¿se puede usar?"**: las comprobaciones (activo, vigente, con usos
  disponibles) vivían dentro de `create-order`; ahora están en `coupon-eligibility.ts` y las comparten
  el checkout y la creación del pedido, así no pueden desincronizarse. Los mensajes son los mismos en
  los dos caminos.
- **Dos bugs reales que aparecieron al abrir esto**:
  1. **`usageLimit: 0` (el default del modelo) hacía que ningún cupón se pudiera usar**: la
     comprobación era `usedCount >= usageLimit`, o sea `0 >= 0`. Corregido en los dos adaptadores con
     un criterio explícito: **0 = sin límite**.
  2. **El código era sensible a mayúsculas**: la validación del checkout normalizaba "b2g1" y la
     creación del pedido buscaba el texto crudo, así que el cliente veía "sirve" y el pedido fallaba
     después. Ahora los dos normalizan igual.
- **Honestidad en lo que se muestra**: para porcentaje y monto fijo el checkout estima el descuento
  (puede hacerlo: tiene el subtotal); para las promos por cantidad dice **"el descuento se calcula al
  confirmar"** en vez de inventar un número, porque depende de qué unidades entran y eso lo decide el
  servidor.
- **Otro vector mío mal elegido, cazado por el test de la etiqueta**: tenía escrito que un B2G1 es
  "llevá 2 y pagá 1" —eso es un 2×1—; un B2G1 es **llevá 3 y pagá 2** (2 pagas + 1 gratis). Corregí la
  etiqueta, los comentarios y la documentación.
- **Verificado en el camino real** (Postgres 17 local + `next start -p 3210` con el build nuevo):
  **E2E completo 70 pasaron, 7 salteados, 0 fallos** (antes 69). El caso nuevo entra al checkout a
  375 px, escribe un código inexistente, toca "Aplicar" y comprueba que ve el mensaje del servidor y
  que puede confirmar igual (el código es opcional).
- **De paso, el entorno**: el contenedor de Postgres se había caído (Docker Desktop cerrado a mitad de
  la sesión); se levantó de nuevo, se verificaron las 17 migraciones y se repitió la verificación
  completa.
- **Lo que falta para cerrar T9**: la pantalla del admin para crear y editar promos (c). Sigue siendo
  el requisito para que el owner no dependa de tocar la base.

### Ola 2 · T9 (parte 3): la pantalla de promos del admin (2026-09-12) — **T9 cerrada**

Con esto el owner crea, edita, apaga y borra promos sin tocar la base: `/admin/promotions`. El motor
(parte 1) y el campo del código en el checkout (parte 2) ya estaban; faltaba la puerta de entrada.

- **Cuatro casos de uso con las mismas reglas que muestra el formulario**: `list-promotions`,
  `create-promotion`, `update-promotion` y `delete-promotion`. Las reglas viven en
  `domain/promotion-rules.ts` y el formulario del admin las corre **antes** de gastar el viaje; el
  servidor las vuelve a correr igual, y devuelve **error por campo** (`fields`), que es lo que se
  muestra debajo del input que corresponde.
- **Editar no reinicia el uso acumulado**: el uso es historia del negocio, no configuración. Y el
  guardado es un reemplazo completo, así que cambiar de tipo no deja restos del tipo anterior (un
  porcentaje no puede quedar con alcance, ni una promo por cantidad con un monto).
- **El alcance no se puede mentir**: la validación rechaza un alcance en una promo que no sea por
  cantidad (el descuento de un porcentaje no mira categorías). El formulario esconde ese selector
  fuera de "Por cantidad" y manda `all` en los demás tipos.
- **Una fecha sin hora vence al final del día del negocio**: `<input type="date">` manda `2026-12-31`,
  y guardarlo como 31/12 00:00 UTC haría que la promo dejara de servir a las 18:00 del **30** en
  Nicaragua. `business-settings/domain/end-of-day.ts` lo convierte al final de ese día en la zona del
  negocio (con `Intl`, sin librerías, y con ida y vuelta para precargar el formulario). Una zona
  desconocida cae a UTC en vez de romper el guardado.
- **El motor se hizo más útil**: `validateBogoCouponConfig` pasó de devolver un texto a devolver
  `{field, message}`, para que el error caiga en el input correcto (`freeQuantity`, `scopeId`, …) y no
  siempre en "unidades que se llevan". Es el cambio que destrabó el test rojo de la pantalla.
- **Permisos**: `canManagePromotions` = owner + manager (una promo toca precios del menú; cocina no).
- **Hallazgos del camino real** (no de los unitarios):
  1. **`getByLabel("Código")` matcheaba el `<select>` de Estado** porque su opción decía "Activa — el
     código funciona": `getByLabel` de Playwright es *substring*, `getByLabelText` de testing-library
     es exacto. Se cambió el texto de la opción y el E2E usa `{ exact: true }`.
  2. **El botón de guardar arrancaba deshabilitado sin código**: un botón inerte que no explica nada.
     Ahora se puede tocar siempre y el error aparece en el campo.
  3. **El helper de limpieza del E2E no esperaba el fetch de la lista**: una corrida anterior dejaba la
     promo y la siguiente fallaba por código duplicado. El test espera a que la lista cargue.
- **Verificado en el camino real** (Postgres 17 local + `next start -p 3210` con el build nuevo):
  **unitarios 1291 en 211 archivos** (antes 1228), lint/typecheck/build/`security:secrets` verdes, y
  **E2E completo 72 pasaron, 7 salteados, 0 fallos** (antes 70). El caso nuevo hace el recorrido
  entero: crea `E2E-2X1` en el admin, la ve listada ("Llevá 2 y pagá 1"), carga 2 × C$35 en el
  checkout, aplica el código, confirma y comprueba en la confirmación subtotal C$70, descuento
  **−C$35** y total C$35; después verifica que la lista cuenta "1 uso" y borra la promo. Más una
  pasada a 375 px de la lista y el formulario. La base local quedó como estaba: sin promos de prueba.
- **T9 queda cerrada** (motor + checkout + admin). Lo que sigue de la ola 2 es **T8 (multi-sucursal)**,
  que necesita decisión del owner: ¿el menú y los precios son por local, o solo cambian el horario y
  el contacto?

### T5 · Fase 2: el campo de preparación se explica solo (2026-09-12)

Pedido del owner dentro de `TASK-checkout-v2`: escribir "25" en minutos de preparación no decía qué
significa. La ayuda ya explicaba la regla ("con 25, la última orden entra 25 minutos antes del
cierre"); lo que faltaba era **verlo**, que es esta fase.

- **Vista previa en vivo en `/admin/settings`** (`pickup-preview.tsx`): con la configuración que está
  en pantalla —horario, minutos de preparación, máximo del rango y zona horaria— muestra el copy de
  "lo antes posible" tal como lo ve el cliente, los turnos de hoy y **hasta qué hora entra un pedido
  hoy** (`21:35` con cierre 22:00 y 25 minutos). No guarda nada: lo dice el propio panel.
- **No puede mentir**: no reimplementa nada, compone **las mismas funciones que usa el checkout**
  (`buildPickupSlots`, `soonestPickupTime`, `formatPickupRangeLabel`). El caso de "lo antes posible"
  usa la hora calculada (ahora + preparación), no el primer turno de la grilla, porque así lo muestra
  el checkout.
- **`now` se resuelve después de montar** (inyectable en los tests), por el mismo motivo que en el
  checkout: en el servidor y en el cliente daría horas distintas y el HTML no coincidiría al hidratar.
- **Defecto preexistente que apareció al verificar 375 px**: la barra fija de "Guardar cambios" usaba
  `-mx-4` sobre un `<main>` con `px-3`, así que a 375 px la página se salía 4 px y **scrolleaba de
  costado**. Se alineó con el padding real del shell (`-mx-3 sm:-mx-4 md:-mx-7`) y el test lo fija
  (`overflow ≤ 1 px`).
- **Verificado en el camino real**: **unitarios 1301 en 213 archivos** (antes 1291), lint/typecheck/
  build/`security:secrets` verdes, **E2E completo 73 pasaron, 7 salteados, 0 fallos** (antes 72). El
  caso nuevo entra a `/admin/settings` a 375 px, comprueba que el panel está, que la última orden se
  mueve al cambiar los minutos y que **no se guardó nada** (el valor vuelve al recargar). La
  configuración local quedó intacta.

**Lo que queda de `TASK-checkout-v2`**: fase 4 (pedidos para días futuros, depende de **D1**) y fase 5
(presets de propina, depende de **D2**). Las fases 1, 2, 3, 6 y 7 están cerradas.

### Endurecimiento técnico: hash de contraseñas, CSP y el build de webpack (2026-09-12)

El pendiente #5 de la lista de abajo, cerrado en un solo commit. Eran tres cosas que no bloqueaban
nada pero se acumulaban.

**1. El hash de contraseñas era viejo y no se podía subir.** El formato era `salt:digest` con los
parámetros por defecto de Node (N=2^14, ~51 ms medidos acá) y **no guardaba los parámetros**: subirlos
habría dejado afuera a todas las cuentas existentes en el próximo login.

- Formato nuevo autodescriptivo: `scrypt$N$r$p$salt$digest` con **N=2^16, r=8, p=2** (64 MiB de
  memoria, ~270 ms por hash medidos), una de las combinaciones que recomienda OWASP para scrypt. El
  login del admin está limitado a 10 intentos por minuto y por IP, así que ese costo lo paga un
  atacante.
- Los hashes viejos **se siguen verificando** y se actualizan solos: `passwordNeedsRehash()` decide, y
  el login rehashea en el momento en que tiene la contraseña en claro. Nunca debilita (un hash con
  parámetros más altos se deja como está) y si el rehash falla **la entrada sigue** (es una mejora
  interna, no un requisito).
- Puerto: se agregó `updateUserPassword` a `AdminAuthRepository`, implementado en los dos adaptadores
  (el compilador obliga: el doble en memoria lo implementa o no compila).
- Evidencia en la base local: las cuentas que entraron en esta sesión quedaron con
  `scrypt$65536$8$2$…` (178 caracteres) y el resto sigue con el formato viejo (161) hasta que entre.

**2. No había CSP.** Solo HSTS, `nosniff`, `X-Frame-Options` y compañía: nada decía **qué scripts**
pueden correr, así que un `<script>` inyectado corría igual.

- La política se arma en el proxy (`content-security-policy.ts`, puro y con tests) con un **nonce por
  respuesta** y viaja al render en el header del request (`x-nonce` + el propio CSP): así Next lo pone
  en sus `<script>` sin que ninguna página lo pase a mano. Todas las pantallas ya eran dinámicas.
- `default-src 'self'`, `script-src 'self' 'nonce-…' 'strict-dynamic'`, `object-src 'none'`,
  `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'self'`, `connect-src 'self'`.
  `style-src` lleva `'unsafe-inline'` (React escribe estilos en línea; el riesgo real es inyectar
  scripts y eso lo cubre el nonce) e `img-src` permite `https:` porque el owner carga fotos por URL.
- **Sin `upgrade-insecure-requests` a propósito**: reescribe los subrecursos a https y contra el
  servidor local en http (el arnés E2E) dejaría la página sin CSS ni JS. El upgrade lo hace HSTS.
- Verificado en navegador real: `security-csp.spec.ts` recorre home, menú, carrito, checkout, landing
  y login del admin escuchando las violaciones que reporta el navegador (ninguna), y comprueba que la
  hidratación siga viva (el "+" del menú agrega de verdad) y que el admin funcione.

**3. `next build --webpack` fallaba** (el build del deploy usa Turbopack, que no corre esa
validación, así que el problema estaba escondido). La causa: Next genera un tipo por módulo de ruta
que exige que solo exporte lo que él conoce, y tres páginas exportaban de más.

- `activity/page.tsx` exportaba `OrderHistoryCard`, `OrderTimeline` y `OrderDetailView` → movidos a
  `activity/order-history-views.tsx`.
- `menu/[productId]/page.tsx` exportaba `countAvailableSelectionGroups` → movido a
  `menu/product-detail-page-helpers.ts`; `checkout/page.tsx` exportaba `focusCheckoutField` → ahora es
  privada (nadie más la usaba).
- **Test de contrato** (`src/app/route-module-exports.test.ts`): recorre las páginas, layouts y rutas
  y falla si alguna exporta algo que Next no conoce. Comprobado que **caza de verdad** el caso (con un
  archivo de prueba apareció el rojo nombrando el archivo); con esto no hace falta esperar a que
  alguien corra el `--webpack`.
- `npx next build --webpack` **pasa** (compila y termina el listado de rutas; antes cortaba en
  "Failed to type check").

**Verificación:** **1327 unitarios en 216 archivos** (antes 1301 en 213), lint, typecheck,
`npm run build`, `npx next build --webpack` y `security:secrets` verdes; **E2E completo 76 pasaron,
7 salteados, 0 fallos** (antes 73).

### T8 (multi-sucursal) · Fase 1: el modelo de locales (2026-09-12)

Primera fase de la tarea más grande del plan, con el alcance que eligió el owner: **menú y precios por
local**. El brief con el diseño completo está en [`ops/tasks/TASK-multi-location.md`](tasks/TASK-multi-location.md).

- **Dos tablas nuevas**: `Location` (nombre, slug, orden, dirección, contacto, horario, minutos de
  preparación, acepta pedidos, mensaje de cerrado) y `LocationProduct` (qué ofrece cada local, con
  `priceOverride` opcional — `null` = el precio base del producto —, más `isAvailable` e `isActive`).
  Categorías y subcategorías siguen siendo globales: el menú se organiza igual en todos lados.
- **`Order.locationId` obligatorio**, con migración en tres pasos: se agrega nullable, se backfillea al
  local primario y recién ahí se vuelve obligatoria. Agregarla directo como NOT NULL habría fallado con
  los **229 pedidos** que ya existían. Verificado en la base local: 229 de 229 quedaron con local.
- **El local primario lo crea la migración**, copiando la operación que hoy vive en `BusinessSettings`
  (dirección, contacto, horario, preparación, aceptación). El `LEFT JOIN` con una fila fija garantiza
  que se cree **también en una base nueva sin configuración** (ahí usa los defaults del dominio), que es
  el caso del job de migraciones de CI. Sin eso, el negocio quedaría sin local y no se podría pedir.
- **La regla de "qué local atiende" es pura** (`resolveLocation`): sin local elegido se usa el primario
  (primero activo por orden, desempatando por nombre para que no dependa de cómo los devuelva la base) y
  un local pedido que no existe o está apagado **se rechaza**, no se cae al primario: caer al primario
  sería mandar la comida al local equivocado sin avisar.
- **Sin cambios de comportamiento**: el pedido guarda su local, pero el horario y el gate operativo se
  siguen leyendo de la configuración. Los datos son los mismos (el primario los heredó), así que el
  negocio de un solo local no nota nada. El checkout elige local en la fase 6.
- **El contrato anti-hardcode cazó un atajo mío**: el doble en memoria de locales tenía el horario
  escrito a mano (`12:00`–`22:00`) y el test lo rechazó; ahora importa los defaults del dominio. Es
  exactamente para lo que existe ese test.
- **Verificación**: **1348 unitarios en 218 archivos** (antes 1327 en 216), lint, typecheck, `npm run
  build`, `security:secrets` verdes y **E2E completo 76 pasaron, 7 salteados, 0 fallos**. `npx prisma
  migrate dev` quedó sin drift. De paso, `prisma format` alineó `schema.prisma` completo (por eso ese
  archivo aparece con muchas líneas cambiadas: es formato, no modelo).
- **Lo que sigue (fases 2-7)**: API y casos de uso de locales, `/admin/locations`, productos por local,
  lectura pública por local, selector en el checkout y operación por local. Ver el brief.

### T8 (multi-sucursal) · Fase 2: reglas, casos de uso y API de locales (2026-09-12) — **cerrada**

Con esto el admin ya puede administrar locales **por API**; falta la pantalla (fase 3).

- **Reglas puras** (`validateLocationInput`): nombre (2 a 60), slug normalizado a minúsculas con
  guiones, minutos de preparación con **los mismos límites y mensajes** que `/admin/settings`, rango
  máximo ≥ mínimo, horario de cada día (cierre posterior a la apertura, con el día en el mensaje),
  WhatsApp del local y coordenadas dentro del planeta. El formulario las muestra antes de guardar y el
  caso de uso las vuelve a aplicar.
- **Tres casos de uso** (`create`, `update`, `delete`) con `LocationError` propio del módulo (no se
  reusa `OrderError`: son dominios distintos) y el mismo criterio que las promos: el slug se normaliza
  **antes** de validar y antes de buscar duplicados ("Sucursal Norte" y "sucursal-norte" son el mismo
  local), y el guardado es completo.
- **Borrar tiene dos reglas** que evitan dejar el negocio sin dónde despachar: no se puede borrar el
  último local activo (el checkout no tendría a dónde mandar el pedido) ni dejar la lista vacía. Un
  local apagado sí se borra, pero solo si queda otro activo.
- **API**: `GET /api/admin/locations` (cualquier admin con sesión: la lista la usan la pantalla de
  locales y la de pedidos) y `POST`, `PATCH [id]`, `DELETE [id]` **solo owner**
  (`canManageBusinessSettings`), porque de acá salen dirección, horario y si se aceptan pedidos.
- **Bug latente que encontré al escribir las rutas**: había creado `LocationError` **sin mapearlo en
  `createErrorResponse`**, así que un error de dominio de locales habría salido como **500 "Unexpected
  server error"** y el formulario no habría podido marcar el campo. Test primero (rojo: 500 en vez de
  422), mapeo agregado.
- **Verificado en el camino real** (Postgres 17 local + `next start -p 3210`, llamando la API con curl y
  la cookie del owner): `GET` → 1 local (el primario de la migración); `POST` → crea con slug
  normalizado, minutos y rango guardados; `POST` repetido → **409** con `fields.slug` en español;
  `PATCH` → cambia nombre y `isActive`; `DELETE` → borra; borrar el último local → **409**; y al final
  la base quedó **como estaba** (1 local, el primario).
- **Verificación**: **1389 unitarios** (13 de las rutas nuevas + 2 del mapeo de errores), lint,
  typecheck, `npm run build` (las dos rutas aparecen en el listado) y **E2E completo 76 pasaron,
  7 salteados, 0 fallos**.
- **Deuda de test que quedó anotada (y costó tres CI rojos)**: el mismo par de tests de
  `/admin/promotions` falló tres veces en CI. Primero se cambió la espera (del mock a la UI
  visible), después el techo (`asyncUtilTimeout` de 5 s había quedado **igual** que el
  `testTimeout` de vitest, así que el test se moría justo cuando la espera se resolvía), y al
  tercer intento se dejó de adivinar: el test ahora **dice en qué paso falla** (comprueba el
  valor del input después de tipear y espera el POST con 10 s propios antes de mirar la UI).
  Con eso el par quedó verde en CI. La lección escrita en los dos archivos: en un runner
  cargado, jsdom + `userEvent` + fetch simulado pueden tardar varios segundos, y una espera
  tiene que quedar holgada y **por debajo** del presupuesto del test.

### T8 (multi-sucursal) · Fase 3: la pantalla de locales (2026-09-12) — **cerrada**

El owner ya administra los locales sin tocar la API: `/admin/locations`, en la navegación del admin
**solo para el owner** (es configuración del negocio, como Personalización y Usuarios).

- **La lista** muestra, por local: nombre, estado (Activo / Apagado), si dejó de recibir pedidos,
  dirección con ciudad ("Frente al parque, Jinotepe") y **el horario de hoy** con los minutos de
  preparación. Sin dirección cargada lo dice, no deja el hueco.
- **El formulario** cubre todo lo del local: nombre, identificador de URL, dirección, ciudad,
  referencia, enlace al mapa, lat/long, teléfono, WhatsApp, **los siete días de horario** (con
  "cerrado" por día), minutos de preparación, rango máximo, si acepta pedidos, mensaje de cierre,
  orden en la lista y estado. Un local nuevo arranca con **el horario que el negocio ya tiene
  configurado**, no con un horario inventado.
- **Valida con las mismas reglas del servidor antes de gastar el viaje** (`validateLocationInput`), y
  el error del servidor se muestra en el campo que corresponde (por ejemplo el identificador repetido).
- **Borrar pide confirmación** y, cuando la API lo rechaza, muestra el motivo: "El negocio necesita al
  menos un local" o el del último local activo. No queda un botón que falla en silencio.
- **`now` se resuelve después de montar** (el resumen de "hoy" no puede diferir entre servidor y
  cliente), el mismo patrón que la vista previa de turnos.
- **Verificación en el camino real**: **1404 unitarios** (14 de la pantalla y sus helpers, 22 de la
  navegación del admin), lint, typecheck, `npm run build` (las tres rutas nuevas en el listado) y
  **E2E completo 77 pasaron, 7 salteados, 0 fallos**. El caso nuevo entra por la navegación a 375 px,
  crea un local, comprueba la lista y el identificador repetido, lo borra, verifica que **el último
  local no se puede borrar** y que la pantalla no scrollea de costado. La base quedó con un solo local,
  el primario de la migración.
- **Lo que sigue de T8 (fases 4-7)**: productos y precios por local, lectura pública por local,
  selector de local en el checkout y operación por local (filtro del admin, confirmación e historial).

### T8 (multi-sucursal) · Fase 4, primera mitad: el catálogo por local (2026-09-12)

El lado servidor de "menú y precios por local". Falta la pantalla (4b).

- **Cambio de diseño, y el motivo**: el brief decía "sin fila en `LocationProduct` no hay producto en
  ese local" (copiando el catálogo al crear un local). Al implementarlo quedó claro que eso rompía el
  caso real: un negocio de **un solo local** no tiene filas, así que el menú público habría quedado
  **vacío** hasta que alguien copiara el catálogo. La regla ahora es **"sin fila, el producto se vende
  al precio base"**, y el local guarda **excepciones** (precio propio, agotado, "acá no lo vendo"). Tres
  consecuencias buenas: el negocio de un local sigue funcionando sin configurar nada, un producto nuevo
  se vende en todos lados, y el menú no puede quedar vacío por un catálogo sin copiar. La copia del
  catálogo, entonces, ya no hace falta.
- **Reglas puras** (`location-product-rules.ts`): el precio del local gana si existe (**`0` es gratis,
  no "sin precio"**), un precio propio con más de dos decimales o negativo se rechaza, y el resumen
  cuenta el catálogo **del local** (cuántos vende, cuántos agotados, cuántos con precio propio).
- **Dos casos de uso**: `list-location-catalog` (todos los productos del negocio con la excepción del
  local al lado, para que la pantalla pueda mostrar de dónde sale el precio) y `set-location-product`
  (valida, comprueba que el local y el producto existan, y **borra la fila cuando no hay excepción que
  guardar**: volver al precio base no es copiar el precio del negocio).
- **API**: `GET /api/admin/locations/[id]/products` (cualquier admin con sesión) y
  `PUT /api/admin/locations/[id]/products/[productId]` (**solo owner**, es configuración del negocio).
- **Verificado en el camino real** (Postgres 17 local + `next start -p 3210` con curl y la cookie del
  owner): sin excepciones el catálogo muestra los 5 productos al precio base (0 con precio propio);
  un `PUT` con precio 42 y agotado se ve en el catálogo (precio 42, agotado, resumen con 1 precio
  propio); un precio negativo da **422** con el campo en español; un producto inexistente da **404**;
  y volver al precio base **borra la fila** (el catálogo vuelve al base y la tabla queda en 0 filas).
- **Verificación**: **1433 unitarios** (85 del módulo de locales, antes 53), lint, typecheck,
  `npm run build` (las dos rutas nuevas en el listado) y **E2E 75 pasaron, 9 salteados, 0 fallos**.
  Los 9 salteados son 7 de hosts de producción (el arnés apunta a local) y **2 que dependen de la
  hora**: a las 23:31 de Managua al local demo (cierra 23:59) le quedan menos de dos turnos y esos
  casos se saltan solos; a las 22:04 corrían y eran 77 los que pasaban. No es una regresión.
- **Lo que sigue**: 4b (la pantalla del catálogo por local), y después las fases 5-7.

### T8 (multi-sucursal) · Fase 4 (cierre): la pantalla del catálogo por local (2026-09-12)

El owner ya ajusta precios y disponibilidad por sucursal sin tocar la API: `/admin/locations/[id]`,
alcanzable desde el botón "Catálogo" de cada local en la lista.

- **La lista** muestra todo el menú del negocio con el precio que cobra **este** local y, cuando
  tiene precio propio, también el del negocio ("C$42.00 · base C$35.00"), más su estado: "Se vende
  acá", "Agotado acá" o "No se vende acá". El encabezado resume el catálogo del local, no el del
  negocio ("12 productos · 10 en este local · 2 agotados · 3 con precio propio").
- **El sheet de un producto** deja: precio propio (vacío = el del negocio), si se vende en este local
  y si está agotado acá. El botón "Volver al precio base" saca **solo** el precio propio: la
  disponibilidad y "se vende acá" quedan como estaban (un test lo cazó: mi primera versión los
  reseteaba a los valores por defecto, o sea cambiaba algo que el owner no había pedido tocar).
- **El catálogo viaja con el nombre del local** (`meta.location`), así la pantalla no tiene que pedir
  la lista de locales otra vez.
- **Verificación en el camino real**: **1449 unitarios** (30 del módulo de pantallas de locales: 10 de
  los helpers del catálogo + 6 de la pantalla + 14 de la lista y sus helpers), lint, typecheck,
  `npm run build` (`/admin/locations/[id]` en el listado) y **E2E 76 pasaron, 9 salteados, 0 fallos**.
  El caso nuevo entra desde el listado, pone precio propio y agotado, vuelve al precio del negocio,
  saca el plato del local y lo devuelve, y deja **la base sin filas de catálogo** (0 excepciones, un
  solo local). Los 9 salteados son los mismos de la fase 4a (7 de hosts de producción y 2 que dependen
  de la hora del local demo).
- **Lo que sigue de T8**: fase 5 (lectura pública por local: home, menú y producto con el precio del
  local), 6 (selector de local en el checkout) y 7 (operación por local).

### T8 (multi-sucursal) · Fase 5: el menú público cobra lo que cobra el local (2026-09-12)

El cliente ya ve los precios y la disponibilidad del local **sin tocar nada**: la home, la carta y la
ficha de producto salen del mismo `/api/menu`, así que la resolución vive en un solo lugar.

- **`applyLocationPricing`** (puro): aplica las excepciones del local sobre el catálogo del negocio —
  precio propio, agotado en el local, "no se vende acá"— y **descarta las subcategorías que se quedan
  sin productos** (un encabezado vacío se ve como un error de la carta).
- **El `basePrice` del menú público pasa a ser el precio que se cobra en ese local**, que es lo que el
  sitio necesita para armar "desde C$X" con los modificadores. El admin sigue viendo el precio del
  negocio aparte, en su pantalla. Está escrito en el código para que nadie lo confunda.
- **Sin `locationId` se usa el local por defecto** (el primero activo); sin locales activos, los precios
  del negocio. Un `locationId` que no existe o está apagado también cae al por defecto: es una lectura
  pública, y el checkout valida el local de verdad al crear el pedido (fase 6).
- **De paso, deuda que salió a la luz**: el puerto del menú tenía un `locationId` que **nadie usaba**
  (ni el SQL ni los adaptadores). Ahora que la resolución vive en el caso de uso, se quitó: un parámetro
  que no hace nada es una mentira en la firma.
- **Verificación en el camino real** (Postgres 17 local + `next start -p 3210`): **1457 unitarios**
  (6 de las reglas nuevas + 2 de integración del menú público), lint, typecheck, `npm run build` y
  **E2E 78 pasaron, 7 salteados, 0 fallos**. El caso de `admin-locations.spec.ts` ahora cierra el
  círculo completo: arranca con el menú público cobrando C$35, el owner pone C$42 en el catálogo del
  local y **el sitio público pasa a cobrar C$42**, lo marca agotado y **el producto desaparece de la
  carta** ("Producto no encontrado"), lo saca del local y lo devuelve, y al final el sitio vuelve a
  C$35 y **la base queda sin excepciones** (0 filas de catálogo).
- **Lo que sigue de T8**: fase 6 (selector de local en el checkout, con el `locationId` del pedido) y
  fase 7 (operación por local).

### T8 (multi-sucursal) · Fase 6: el checkout elige el local (2026-09-12)

El cliente ya puede retirar en el local que quiera, y **el estado operativo pasó a ser del local**:
cada sucursal tiene su horario, su preparación, su interruptor y su mensaje de cerrado.

- **`GET /api/locations`** (público): solo locales activos y solo los datos del punto de retiro
  (nombre, dirección, mapa, horario, preparación y si acepta pedidos). El teléfono del local, el
  WhatsApp interno y la auditoría no salen a la calle.
- **El checkout sale del local elegido**: dirección, horario, minutos de preparación, rango y el gate
  de "aceptando pedidos". Sin locales cargados (o si la lectura falla) usa la configuración del
  negocio, que es como funcionaba antes; el endpoint devuelve `Location[]` o nada, y cualquier otra
  cosa se ignora en vez de romper la pantalla.
- **El selector aparece solo si hay más de un local activo**: con uno solo sería un control decorativo.
  Al cambiar de local se limpia la hora elegida (era de otro local).
- **El gate del servidor también mira el local** (`/api/orders`): si el local elegido está pausado, el
  pedido se rechaza con su mensaje, no con el genérico del negocio.
- **Gap declarado, no escondido**: `/admin/settings` todavía tiene "Aceptando pedidos" y "Mensaje
  cuando no acepta". Después de T8 esas dos cosas son **por local**, así que quedan como respaldo para
  cuando no hay ningún local cargado y hay que sacarlas de la pantalla de configuración (queda anotado
  en el brief).
- **Dos hallazgos de los tests, los dos reales**:
  1. El test de la propina fallaba con **429**: el archivo de tests de `/api/orders` ya manda más
     pedidos que el límite de producción (10 por minuto por IP) y mi caso nuevo lo pasó. El límite se
     sube **en el archivo de tests** (`ORDER_CREATE_RATE_LIMIT=200`), no en el servicio.
  2. Tres tests del checkout contaban llamadas a `fetch` (`toHaveBeenCalledTimes(1)`) para saber si se
     había enviado el pedido; ahora el checkout también pide `/api/locations` al montar, así que la
     aserción pasó a buscar **la llamada del pedido** (`/api/orders`) en vez de contar.
- **Verificación en el camino real**: **1467 unitarios** (47 del checkout, 19 de la API de pedidos),
  lint, typecheck, `npm run build` (`/api/locations` en el listado) y **E2E 79 pasaron, 7 salteados,
  0 fallos**. El caso nuevo crea un segundo local desde el admin, entra al checkout, ve los dos en el
  selector y comprueba que al elegir el segundo **el punto de retiro cambia de ciudad**; y el caso del
  interruptor se reescribió para apagarlo **desde el local** (antes lo hacía desde la configuración),
  que es el cambio de semántica que trajo T8. La base quedó con un local, el primario, aceptando
  pedidos y sin filas de catálogo.
- **Lo que sigue de T8**: fase 7 (operación por local: filtro del admin, confirmación e historial del
  cliente) y sacar el interruptor global de `/admin/settings`.

### T8 (multi-sucursal) · Fase 7, primera parte: la bandeja por local (2026-09-12)

Cada sucursal tiene su cocina y su caja, así que la bandeja de pedidos ahora se puede mirar por local.

- **Filtro por local** en `/admin/orders` (aparece **solo si hay más de un local activo**; con uno
  solo sería un control decorativo) y **el nombre del local en cada pedido**, resuelto por la API en
  una sola lectura de locales para toda la lista (no una consulta por pedido). Un pedido de un local
  borrado queda sin nombre en vez de romper la pantalla.
- **Bug real que apareció al escribir el E2E, y que valía la pena arreglar**: un local **con pedidos**
  no se puede borrar (la FK de `Order.locationId` es `Restrict`, a propósito: la historia no se pierde)
  y eso salía como **500 "Unexpected server error"**. Ahora el caso de uso lo comprueba antes y
  responde **409** con el motivo: "Este local tiene un pedido: apagalo si no querés ofrecerlo, pero no
  se puede borrar".
- **El E2E también obligó a pensar el orden de los pasos**: para poder borrar el local de prueba, el
  pedido que crea tiene que ir al **principal** (se elige el segundo local, se comprueba que el punto
  de retiro cambia, y se vuelve al principal antes de confirmar). Un local con pedidos no se puede
  borrar, y eso es correcto: el test no puede depender de romper esa regla.
- **Verificación en el camino real**: **1473 unitarios** (3 del listado por local, 5 de borrar un
  local, 2 de la bandeja con varias sucursales), lint, typecheck, `npm run build` y **E2E 79 pasaron,
  7 salteados, 0 fallos**. El caso de E2E crea un segundo local, confirma un pedido para el principal y
  comprueba en la bandeja que **filtrando por el otro local el pedido desaparece y con el suyo vuelve**.
  La base quedó con un solo local, sin filas de catálogo y sin los pedidos de prueba.
- **Lo que falta de T8**: el local en el detalle del pedido, en el ticket y en la confirmación y el
  historial del cliente, y sacar `isAcceptingOrders`/`closedMessage` de `/admin/settings` (hoy son por
  local y quedan como respaldo cuando no hay ningún local cargado).

### T8 (multi-sucursal) · Fase 7, segunda parte: el local en el detalle, la confirmación y el historial (2026-09-12) — **cerrada**

Con la primera parte el local se veía en la bandeja, pero el cliente que volvía a mirar su pedido no
tenía forma de saber a qué local iba, ni la cocina cuál era el suyo al abrir el detalle.

- **El pedido guarda el `locationId`, nunca el nombre ni la dirección**: el punto de retiro se resuelve
  **al leer** (`describePickupLocation` y `formatPickupAddress`, en el dominio de locales). Si el owner
  corrige una dirección, los pedidos que ya están en curso muestran la nueva. Del local sale solo lo del
  punto de retiro: teléfono y WhatsApp internos no se exponen.
- **Detalle del admin**: sección "Punto de retiro" con local, dirección y enlace al mapa.
- **Confirmación del cliente**: "Retiro en <local>" junto al PIN, con dirección y "Cómo llegar" cuando el
  owner los cargó. Es la pantalla que el cliente deja abierta cuando sale a buscar el pedido.
- **Historial de "Mi actividad"**: el local se guarda con el pedido del dispositivo (como el PIN, porque
  el historial se lee sin red) y se muestra en la tarjeta y en el recibo.
- **Bug real que apareció al escribir el test del sync**: `syncTrackedOrderToDeviceOrders` reconstruía el
  pedido guardado solo con lo que devuelve el seguimiento (estado y montos), así que tocar "Actualizar"
  en Mis pedidos **borraba las líneas (T7), el PIN y la hora de retiro (T13)** del historial del
  dispositivo. Ahora parte del pedido guardado y solo pisa lo que el payload trae. El local habría
  sufrido lo mismo.
- **Verificación en el camino real**: **1490 unitarios** (+17), lint, typecheck, `npm run build`,
  `security:secrets` y **E2E 79 pasaron, 7 salteados, 0 fallos**. El caso de dos locales comprueba el
  local en la confirmación, en el historial y en el detalle del admin. Medido a **375 px y 1280 px**: sin
  scroll horizontal en las tres pantallas.

### T8 (multi-sucursal) · Fase 7, cierre: el interruptor global sale de `/admin/settings` (2026-09-12) — **cerrada**

- **"Aceptando pedidos" y "Mensaje de cerrado" ya no están en `/admin/settings`**: con cualquier local
  cargado (y la migración siempre crea el primario) el que manda es el del local, así que el de la
  configuración era **un control que no hacía lo que decía**. En su lugar queda una línea que apunta a
  `/admin/locations`. Los valores guardados **siguen viajando en el payload**: son el respaldo que usa el
  servidor cuando el negocio no tiene ningún local.
- **Bug real de la fase 6, encontrado al sacar ese interruptor**: el cartel de "Abierto/Cerrado" de la
  home seguía leyendo la **configuración del negocio** mientras el checkout y `/api/orders` ya decidían
  por local. Es exactamente lo que la propia función decía que no podía pasar ("el cartel no puede decir
  Abierto mientras el checkout rechaza el pedido"). La home ahora usa el **local por defecto**
  (`/api/locations`, el primero de los activos, la misma regla del servidor) con la configuración como
  respaldo, y lo mismo para el horario del encabezado y el estimado de retiro. El E2E lo comprueba de
  punta a punta: apagando el local, la home dice "Cerrado" y el checkout queda deshabilitado.
- **Verificación**: **1492 unitarios**, lint, typecheck, `npm run build`, `security:secrets` y **E2E 79
  pasaron, 7 salteados, 0 fallos**.
- **Gap declarado (no silencioso)**: el **footer** (`src/app/(public)/layout.tsx`) y el bloque de
  "Información del restaurante" de la home siguen mostrando **horario, ciudad y dirección de la
  configuración del negocio**, no del local. Con un solo local coinciden casi siempre; con dos, la
  pregunta "¿qué horario muestra el footer?" es una **decisión del owner** (listar los locales, mostrar el
  por defecto, o un horario general) y no se inventó una respuesta. Los turnos de retiro, el precio y el
  estado operativo **sí** son por local en todo el camino público.

### Checkout fase 4: pedidos para días futuros (2026-09-12) — **cerrada**

Decisión **D1 = sí** (2026-09-12), con un ajuste del owner en la sesión: **sin límite de días**, el
único tope es el horario de ese día.

- **El cliente elige el día** en el control de retiro (input de fecha con mínimo hoy) y los turnos se
  calculan para ese día desde la apertura —sin sumarle la espera de preparación, que empuja los turnos
  de hoy— y **todos** los del horario, no los primeros cinco.
- **"Lo antes posible" sigue siendo solo de hoy**: al elegir otro día el control pide una hora
  (arranca en el primer turno) porque sin hora el pedido saldría para hoy. Un día cerrado no deja
  confirmar y se explica en pantalla.
- **La hora se resuelve en la zona del negocio** (`pickupInstant`, en el dominio de turnos): el
  checkout la armaba con `setHours` del celular, así que un cliente en otra zona mandaba la fecha
  equivocada. Ese helper (`formatPickupTimeIso`) se eliminó junto con su test, reemplazado por el
  dominio; el servidor ya validaba contra el horario del día elegido y no necesitó cambios.
- **La cocina no lo confunde con el turno de hoy**: la bandeja agrupa los pedidos abiertos de otro
  día en **"Programados"** (bucket nuevo), la etiqueta del retiro dice el día ("Retiro mañana 8:00
  p. m. · Programado"), el semáforo no cuenta minutos de otro día, y la confirmación y el historial
  del cliente también dicen el día ("Listo mañana 12:00 p. m.").
- **Verificación**: **1520 unitarios** (+28), lint, typecheck, `npm run build`, `security:secrets` y
  **E2E 80 pasaron, 7 salteados, 0 fallos** (el caso nuevo hace el recorrido entero: elige mañana,
  confirma y lo encuentra agrupado en "Programados" con el día en la etiqueta).
- **Pendiente declarado**: la bandeja del admin ancla "hoy" a `America/Managua` fijo
  (`orders-page-helpers.ts`), mientras el checkout y el retiro usan la zona de la configuración. En la
  práctica el negocio está en Managua; para una plataforma whitelabel de otra zona hay que mover ese
  anclaje a `BusinessSettings.timezone`. — **cerrado el 2026-09-12** (ver abajo).
- **CI rojo por un test que leía la hora del equipo**: `programar una hora la manda en el pedido`
  afirmaba `new Date(...).getHours()` (20 en esta máquina en UTC-6, 2 en CI en UTC). Además solo era
  cierto con la implementación vieja, que armaba el instante en la zona del navegador. Ahora afirma el
  instante UTC exacto (`fix(test)`, commit `4b204a9`). **Lección**: cuando algo depende de la zona, la
  aserción va contra el instante (UTC), no contra `getHours()`/`toLocaleString()`; y conviene correr
  `TZ=UTC npm run test` antes de pushear.

### Bandeja del admin: "hoy" pasa a ser el día del negocio (2026-09-12) — **cerrada**

Cierra el pendiente que la fase 4 había declarado: la bandeja anclaba "hoy", los rangos de historial y
la hora de cada pedido a una `America/Managua` **fija** con su offset `-06:00` escrito a mano, mientras
el checkout y el retiro público ya usaban `BusinessSettings.timezone`. Un negocio en otra zona veía el
turno del día equivocado.

- Se borraron los helpers locales de la página (`TZ`, `TZ_OFFSET`, `managuaDateString`, `shiftDays`,
  `startOfDayIso`, `endOfDayIso`, `formatOrderTime`) y ahora se usan los del dominio de turnos, ya
  probados: `dateInTimeZone`, `addDays`, `pickupInstant` y `formatTimeInTimeZone`, todos con la zona de
  la configuración. `businessDayRange` reemplaza a los dos helpers de rango y cubre el día **entero**
  (hasta el último milisegundo, no hasta las 23:59:00).
- **El compilador ayuda**: `orderBucket` ahora **exige** la `timeZone`. En la primera pasada me olvidé
  de pasarla en la página y el grupo cayó en silencio al de siempre (lo cazó el E2E de la fase 4, no el
  typecheck, porque el parámetro era opcional). Con la zona obligatoria, olvidarla no compila.
- **Verificación**: **1524 unitarios** (4 nuevos, con casos en otra zona horaria para el grupo y para
  el rango del día), lint, typecheck, `npm run build`, `security:secrets` y **E2E 80 pasaron, 7
  salteados, 0 fallos**.
- **La misma clase de hardcodeo quedaba en el tablero del admin** (`admin-overview-periods.ts`, el
  esquema del payload y el cliente del resumen): **cerrado más abajo** (ver "La zona horaria del
  negocio, en todo el panel").

### Checkout fase 6: el prefijo de WhatsApp deja de asumir Nicaragua (2026-09-12) — **cerrada (queda D3)**

- El prefijo del campo de WhatsApp ya salía del **teléfono del negocio** (T5); lo que quedaba era el
  respaldo cuando el negocio todavía no cargó ninguno: `+505` escrito a mano, más la ayuda del campo
  ("si tu número no es de Nicaragua"). `resolveWhatsappDefaultPrefix` ahora devuelve `null` sin
  teléfono y el campo arranca en **"Otro"** pidiendo el prefijo internacional: sin dato del negocio,
  la plataforma no elige país. La ayuda pasó a "Elegí el prefijo internacional de tu número".
- **Verificación**: **1527 unitarios** (3 del componente nuevos, 2 del helper reescritos), lint,
  typecheck, `npm run build`, `security:secrets` y **E2E 80 pasaron, 7 salteados, 0 fallos**.
- **D3 sigue abierto** (decisión del owner): qué hacer con `mockup/` y `stitch_full_pwa_builder/`
  (están en `.gitignore`; son el material de referencia del mock).

### Deploy a producción del 2026-09-12 (commit `d770895`) — **verificado**

Primer deploy desde el 2026-09-11 (`build-20260911-191047`). Lleva **T8 (multi-sucursal) completo**,
**los pedidos para días futuros** (fase 4 del checkout) y los arreglos de CI, zona horaria de la
bandeja y prefijo de WhatsApp.

- **Cómo se hizo**: una sola llamada a `deployService` por API (proyecto `brunobot`, servicio
  `oneburguerweb`, `forceRebuild: true`), sin `npm run deploy:easypanel` (fusiona variables y puede
  crear servicios). El `commit.sha` del servicio quedó en `d770895` y el contenedor aplicó la
  migración de T8 al arrancar.
- **Verificación**: `/api/health` 200 en los cuatro hosts; `/api/locations` 200 con **un** local
  (`loc_principal`) y los datos que la migración backfilleó desde la configuración (dirección,
  horario 12:00–22:00, 20 min de preparación, aceptando pedidos, mensaje de cerrado); `/api/menu` 200
  con las 2 categorías y sus productos; y el smoke productivo de solo lectura
  (`BASE_URL=https://oneburgernic.com npm run test:e2e:prod`) **4/4**.
- **Riesgo que conviene recordar**: la migración de T8 agrega `Order.locationId` como *nullable*, lo
  backfillea y después lo deja `NOT NULL`. Las migraciones corren al **arrancar el contenedor nuevo**,
  mientras el anterior todavía sirve: entre el `SET NOT NULL` y el cambio de tráfico, un pedido
  creado por el contenedor viejo (que no manda `locationId`) fallaría. Este deploy cayó a las ~05:25
  de Managua, con el local cerrado, así que no hubo ventana real; **para migraciones de esa forma
  conviene desplegar fuera del horario de atención.**
- **El token del panel se volvió a compartir por chat** (ver §3).

### Bug de dinero mostrado: el "+" rápido contaba el empaque dos veces (2026-09-12) — **cerrada**

Encontrando mientras se miraba el total del checkout con varios locales. El "+" de la home y de la
grilla del menú (agregar sin abrir el producto) armaba la línea del carrito con
`lineTotal = precio × cantidad + empaque × cantidad`, y el carrito y el checkout **vuelven a sumar el
empaque por separado** (igual que `createOrder`: `lineTotal = unitPrice * quantity` y el empaque en su
propio campo). El cliente veía un total más alto que el que se le cobra.

- **Estaba vivo en producción**: los cuatro productos del owner tienen C$35 de empaque, así que un
  pedido hecho desde el "+" mostraba C$35 de más (el servidor cobraba bien: el precio lo resuelve el
  servidor).
- Ahora `buildQuickAddCartItem` deja el empaque **fuera** de `lineTotal`, como la ficha de producto y
  como el servidor. El test nuevo fija el invariante ("lo que se muestra es lo que se cobra") con una
  hamburguesa de C$305 + C$35 de empaque = C$340.
- **Verificación**: **1528 unitarios**, lint, typecheck, `npm run build`, `security:secrets` y **E2E 80
  pasaron, 7 salteados, 0 fallos**. El seed local tiene empaque 0, por eso ningún test lo veía.

### Gap del total con varios locales: el checkout re-preciá con el local elegido (2026-09-12) — **cerrada**

Cierra el gap que quedó declarado al terminar T8: el servidor cobra con el local elegido, pero el
total que veía el cliente se calculaba con los precios del carrito (los del menú que miró, o sea el
**local por defecto**). Con dos locales de precios distintos, el cliente podía ver un total y que se
le cobre otro.

- **No se reimplementó ninguna regla de precios**: el checkout pide `GET /api/menu?locationId=` —el
  menú que el servidor **ya cotizó para ese local**— y re-preciá las líneas con ese `basePrice` más
  los deltas de los modificadores elegidos. El empaque no depende del local y sigue en su campo.
- **Decisión del owner sobre lo que el local no vende**: se **frena la confirmación** y se nombran los
  platos ("En Norte no se vende: Papas Fritas. Cambiá de local o quitá esos platos del carrito"), en
  vez de cambiarle el carrito o el total en silencio. La línea que no se puede pedir no se toca, así
  el total no baja sin avisar.
- Si el menú del local no llegó (o la lectura falla) se muestran los precios del carrito y **no se
  bloquea** nada: no se frena un pedido por una lectura que falló.
- **Hallazgo lateral, ya arreglado en `d7de7df`**: revisando esta cuenta apareció que el "+" rápido
  contaba el empaque dos veces en el total (vivo en producción, C$35 por pedido).
- **Verificación**: **1538 unitarios** (10 nuevos: 8 del helper puro y 2 del checkout), lint,
  typecheck, `npm run build`, `security:secrets` y **E2E 80 pasaron, 7 salteados, 0 fallos**. El caso
  de dos locales ahora pone un precio propio en el local de prueba y comprueba que el CTA pasa de
  C$35 a **C$50** y vuelve, en el navegador y contra el servidor real.
- **Fixtures alineados**: el carrito de prueba del checkout tenía `lineTotal` con empaque (la
  semántica del bug); ahora modela lo mismo que produce la app.

### Segundo deploy del 2026-09-12 (commit `5a487ad`) — **verificado**

Lleva los dos arreglos de la tarde: el **"+" que contaba el empaque dos veces** en el total que ve
el cliente (vivo en producción) y el **total del checkout que ahora sigue al local elegido**, con el
aviso de lo que ese local no vende.

- **Verificación**: `commit.sha` del servicio en `5a487ad`; el bundle que sirve el sitio trae el
  código nuevo (marcador "no se vende" en `/_next/static/chunks/3fo7recy4xshf.js`); smoke productivo de
  solo lectura **4/4**; `/api/menu?locationId=` 200.
- Sin migraciones nuevas: no hubo ventana de esquema como en el deploy anterior.

### La zona horaria del negocio, en todo el panel (2026-09-12) — **cerrada**

Cierra el último hardcodeo de zona horaria. El **tablero del admin** (`/admin`) calculaba su "hoy", sus
rangos, sus buckets y la hora de cada pedido con `America/Managua` fija (y el esquema del payload lo
exigía con un `z.literal`), mientras el checkout y el retiro público ya usaban
`BusinessSettings.timezone`.

- El dominio del tablero (`admin-overview-periods.ts`) ahora recibe la **zona del negocio** en
  `buildOverviewRanges`, `buildOverviewBucketKeys` y `formatBusinessDate` (renombrada desde
  `formatManaguaDate`), con los formateadores de `Intl` cacheados por zona. La ruta lee la configuración
  y se la pasa a `getAdminOverviewPerformance`.
- El cliente del tablero dejó de armar el comienzo del día con un offset `-06:00` escrito a mano: usa
  los helpers del dominio con la zona de la configuración.
- El esquema del payload pasó de `z.literal("America/Managua")` a `z.string()`.
- **De paso, dos cosas del historial del cliente**: la fecha de "última actualización" de `/orders` se
  formatea con la zona del negocio (estaba fija en Managua) y la tarjeta del historial ya no escribe
  `"Hoy"` a mano ni la hora con el reloj del dispositivo: dice **Hoy / Ayer / la fecha** y la hora, en
  la zona del negocio. Antes un pedido de la semana pasada se leía "Hoy · Retiro · 1:30 p. m.".
- **Verificación**: **1543 unitarios** (4 nuevos, con casos en `Asia/Tokyo` para los rangos, los buckets
  y el formateo), lint, typecheck, `npm run build`, `security:secrets` y **E2E 80 pasaron, 7 salteados,
  0 fallos**.
- **Lo que queda, a propósito**: `America/Managua` sigue apareciendo como **valor por defecto de la
  configuración** (`business-settings-defaults.ts`, que es donde debe vivir), como ejemplo en la ayuda
  del campo de zona horaria, y en reservas (fuera del MVP y excluido del contrato anti-hardcode).

## 3. Infraestructura y secretos

- `EASYPANEL_URL` y `EASYPANEL_TOKEN`: solo en el entorno de quien ejecuta el deploy (nunca
  en el repo). El token da acceso total al servidor: **rotarlo** si se compartió por chat.
  ⚠️ El 2026-09-10 el token se pasó por chat para desplegar la personalización y **el 2026-09-12
  otra vez** para este deploy: **hay que rotarlo**.
- El deploy es **una sola llamada** a `deployService` (proyecto `brunobot`, servicio
  `oneburguerweb`, `forceRebuild: true`) contra `http://76.13.250.83:3000/api/rpc`. `ops/easypanel-production.md`
  describe un proyecto `oneburguer`/servicio `web` que **no** es el de producción (es el deploy
  abandonado que quedó como servicio huérfano, pendiente #4 de §4).
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
| 4 | **Borrar el servicio duplicado huérfano `oneburguer-web`** (responde 502) | Agente | **Ya no existe**: el 2026-09-12 se inspeccionaron los tres proyectos del panel (`brunobot`, `n8n`, `postgres`) y **no hay ningún `oneburguer-web`**; `brunobot` tiene `oneburguerweb` (producción), `oneburguer-postgres`, y los servicios ajenos. No hay nada que borrar. Si vuelve a aparecer, el runbook `ops/easypanel-production.md` (que describe el proyecto abandonado) ya tiene un aviso arriba. |
| 5 | **Endurecimiento técnico**: scrypt más fuerte con rehash al login, CSP, extraer componentes exportados de las páginas (hoy `next build --webpack` falla) | **Cerrada** | Las tres partes están hechas y verificadas (ver §2, "Endurecimiento técnico"). Queda **una** mejora conocida que no se hizo: `style-src` necesita `'unsafe-inline'` porque React escribe estilos en línea; el día que se quiera cerrar del todo hay que pasar a hojas de estilo. |
| 6 | **Cerrar puertos innecesarios** de otros servicios del servidor (`capostgres` 5455, `postimage` 8585) | Daniel | No es de One Burger, pero están expuestos a internet. |
| 7 | **Personalización / quitar hardcodeo** (nombre, colores, logo, contacto, horarios, dirección) | **Cerrada (fases 1-4 y 6)** | Aprobada el 2026-09-10; brief en `ops/tasks/TASK-whitelabel-branding.md`. Sitio público, `/admin/settings`, apariencia con presets y contrato anti-hardcode, todo en `main` con CI verde. La **fase 5 (subida de logos)** se descartó: necesita un volumen persistente en Easypanel. Quedó **una excepción**: los turnos de retiro siguen hardcodeados y se trasladaron a la tarea #8. |
| 8 | **Checkout sin redundancias** (textos y botones repetidos) | **Cerrada y desplegada** | `ops/tasks/TASK-checkout-ux.md`. Cuatro commits (`2832a93`…`aba4156`), en producción como `build-20260911-145656`. El checkout pasó de 807 a 476 líneas, un solo resumen compartido con el carrito, un solo CTA visible por viewport y los turnos de retiro calculados desde la configuración. |
| 9 | **Validar el estado operativo en el servidor** | **Cerrada y desplegada** | Commits `3a67c37` y `ca474c8`, en producción como `build-20260911-154014`. `isAcceptingOrders` ya corta pedidos de verdad (antes no lo leía nadie) y la hora de retiro se valida contra el horario del día. Incluye el horario demo del seed y el límite de login del arnés E2E. |
| 10 | **Retiro opcional y programable + la hora visible en toda la cadena** | **Cerrada y desplegada** | Commits `6f85a3c`, `c101f82`, `b207593` y `abc2183`, en producción como `build-20260911-191047`. Incluye **una migración** (`pickupScheduled`). El retiro es opcional, la hora la resuelve el servidor, el ticket de cocina y el admin la muestran, y el semáforo va contra la hora prometida. Ver el detalle arriba. |
| 11 | **Adopción del mock completo (rediseño de la UI pública)** | **En ejecución · ola 1 completa (T1-T7) y T9, T11, T12 y T13 de la ola 2** | [`ops/tasks/TASK-mock-adoption.md`](tasks/TASK-mock-adoption.md). Plan **aprobado** el 2026-09-12 (D-A tipografía: Plus Jakarta Sans como tercera opción · D-B ola 2 completa **sin reseñas ni delivery** · D-C orden: tokens primero y después las pantallas en el orden del mock). **Reglas del programa**: ningún control decorativo (implementado con API/estado y test, o eliminado con motivo), nada hardcodeado, la paleta como preset que pasa el test de contraste, TDD por tarea, y verificación a 375 px **y 1280 px** (el mock no tiene escritorio). **Ola 1**: T1 tokens ✅ · T2 home ✅ · T3 menú ✅ · T3.1 color por categoría ✅ · T4 producto ✅ · T5 carrito+checkout ✅ (fases 1, 2, 3, 6 y 7) · T6 confirmación ✅ · T7 seguimiento e historial ✅ · **ola 1 completa** · T11 forma de pago ✅ · T12 vuelto ✅ · T13 PIN de retiro ✅ · **T9 promos cerrada**: motor ✅, campo del código en el checkout ✅ y pantalla del admin `/admin/promotions` ✅ · **T8 (multi-sucursal) cerrada**: alcance **decidido el 2026-09-12 (D-T8) = menú y precios por local**, brief en [`ops/tasks/TASK-multi-location.md`](tasks/TASK-multi-location.md); **fases 1-7 cerradas** (modelo y backfill, API y pantalla de locales, catálogo y precios por local, menú público, selector en el checkout, operación por local, y el local en el detalle, la confirmación y el historial). Queda **un gap declarado**: el footer y el bloque de información de la home siguen mostrando el horario y la dirección de la configuración del negocio, no del local (ver §2, "Fase 7, cierre"). **Decisiones del checkout resueltas el 2026-09-12**: D1 **sí** — **fase 4 cerrada** (pedidos para días futuros, sin límite de días: el tope es el horario del día) y D2 **no** (una sola tasa de propina; la fase 5 queda descartada). **Ola 2** (aprobada): T8 multi-sucursal, T9 promos, T10 favoritos (**descartada por el owner**: "mantengamos el login tal cual lo tenemos"; sin cuenta no hay favoritos), T11 método de pago, T12 vuelto, T13 PIN de retiro. Evidencia del mock: [`ops/audit-checkout-mock.md`](audit-checkout-mock.md). |

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
