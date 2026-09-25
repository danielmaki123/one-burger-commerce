# Auditoría post-deploy — 3 hallazgos reportados por el owner

> **Solo lectura.** No se tocó código, no se migró, no se corrigió nada y no se modificó el backlog ni
> `ops/project-state.md`. El único archivo escrito es este.
>
> **Commit auditado**: `4ffe6da` (`main`, `git log -1 --format=%H` = `4ffe6dae120d2c35d4c8cc1fd65cdf2f122ba896`).
> **Producción auditada**: `build-20260923-010038` (los tres dominios con `health: ok`; `readiness: ready` con
> la base en 2 ms).
> **Documentos leídos**: `AGENTS.md`, `ops/project-state.md`. **`DESIGN.md` no existe en el repo** (la ley
> visual es `ops/references/stitch/design-system.md`, según `AGENTS.md`).
> **Fecha/hora de la medición**: 2026-09-23 ~01:0x–01:40 UTC = **2026-09-22 ~19:0x–19:40 en Managua**
> (UTC−6), o sea el **día del negocio 2026-09-22**.

## 1. Resumen ejecutivo

| # | Hallazgo | Veredicto | Gravedad | Causa raíz |
|---|---|---|---|---|
| 1 | «Bancos configurados pero no aparecen en Caja al cerrar» | **No reproducido / comportamiento esperado** | Informativa | Con la caja abierta y el modal de cierre **abierto**, los 2 bancos aparecen (medido: 2 bloques). Los bloques se crean **al abrir el modal**: si se mira la sección colapsada, o sin turno abierto, no hay nada que ver (`cash-close-modal.tsx`, `CashTurnSection`) |
| 2 | «El cliente pagó y no se refleja en factura» | **Comportamiento esperado del flujo** *y* **hueco de producto** | **P2** (el hueco) | **Ningún cobro emite factura**: se emite a demanda desde el detalle del pedido, y **un pedido sin cobros no se factura** (`invoice.ts:103`, 409). El pedido que el owner intentó facturar es **público (pago al retirar)** y el sistema **no tiene forma de registrarle el cobro** (no hay endpoint de cobro sobre un pedido existente) |
| 3a | «Intenté hacer pedidos y no me dejó» | **No reproducido** (el pedido **sí** se creó) + **mensaje confuso** | **P3** | El alta pública funciona: el pedido está en la base (`P-MUDF8E1K`, `new`). El mensaje que vio es el **genérico** del checkout, que es lo que se muestra ante un **429** del límite de 10 altas/min por IP (`orders/route.ts:30`) — hipótesis principal, **por confirmar** con el Network del intento |
| 3b | «Si el cliente pide desde el menú, no veo cómo darle seguimiento» | **Reproducido · hueco de navegación** | **P3** | El seguimiento **existe** (`/orders/track`, número + WhatsApp) pero **la confirmación (`/success/[orderId]`) no lo enlaza** ni enlaza a `/orders` |

**Ninguno de los tres es una caída de producción.** No hay errores de servidor, ni datos corruptos, ni pedidos
perdidos: lo que hay es **una expectativa sin cerrar (facturas de pedidos públicos)**, **un mensaje de error
que no dice la causa** y **un enlace que falta**.

## 2. Hallazgo 1 — Bancos en Caja

### Qué se midió (producción, solo lectura)

| Medición | Resultado |
|---|---|
| `GET /api/admin/cash/banks` | **200** con **BAC** y **BANPRO**, los dos `isActive: true`, asignados a las 3 sucursales (Camino de Oriente, Carretera Masaya, Casa Antigua) |
| Turno abierto en producción | **Sí**: Camino de Oriente, turno `cmudf4n06…`, abierto **2026-09-23T01:22:31Z** (fondo contado: 1×C$1000, 2×C$100, 3×C$10, 2×US$50). Carretera Masaya y Casa Antigua: **sin turno** |
| `/admin/cash` (Camino de Oriente) | Región «Caja del local» presente, botón **«Cerrar caja»** presente (hay turno abierto) |
| Modal de cierre **abierto** (se abrió y se cerró con «Cancelar», sin firmar) | **2 bloques de banco**: `Monto declarado de BAC` + `Moneda de BAC` + `Lote de BAC` + `Terminal de BAC` + `Notas de BAC` (y lo mismo para BANPRO). Contadores: montos **2**, lotes **2**, terminales **2** |

Texto real del modal (recortado): «Cuadre por banco / Monto declarado de **BAC** / Moneda de BAC / Lote de
BAC / Terminal de BAC / Notas de BAC / Quitar fila / Monto declarado de **BANPRO** / … / Agregar banco /
Consolidado / Declarado: — / Cobrado sin pasar por el cajón: — / Diferencia del cuadre: — / El cierre no se
bloquea por la diferencia… / Cerrar caja / Cancelar».

### Dónde vive el cierre por banco (código)

- `src/app/(admin)/admin/cash/page.tsx:` construye `banksByLocation` = bancos **activos** ∩ las sucursales del
  alcance (mismo `getBankCatalog` que usa Config de Caja).
- `src/app/(admin)/admin/cash/cash-view.tsx:` pasa `banks={banksByLocation[locationId] ?? []}` a
  `CashTurnSection`.
- `src/app/(admin)/admin/cash/cash-turn-section.tsx:` monta `CashCloseModal` (solo existe con turno abierto).
- `src/app/(admin)/admin/cash/cash-close-modal.tsx:` dibuja **un bloque por banco**; las filas se crean en un
  efecto que depende de `open` (`if (!open) { setRows([]) … } else { setRows(banks.map(…)) }`), o sea **al
  abrir el modal**.
- Endpoint de bancos: `src/app/api/admin/cash/banks/route.ts` + `banks-composition.ts` (`GET`/`PUT`, solo dueño).

### Por qué el owner no lo vio (hipótesis, en orden)

1. **Miró Caja sin turno abierto**: sin turno no hay botón «Cerrar caja» ni modal; la sección dice «Sin caja
   abierta en este local: contá con cuánto abrís» y ahí no hay bancos que mostrar (por diseño: el cuadre por
   banco es parte del cierre).
2. **Miró una sucursal sin turno abierto**: en producción solo Camino de Oriente tiene turno; elegir otra
   sucursal en el selector muestra el estado «sin caja abierta».
3. **Miró la sección colapsada**: los bloques se crean al abrir el modal; antes de abrirlo no están en
   pantalla (en el DOM están solo como contenido del `<dialog>` cerrado, y vacíos).

### Veredicto y gravedad

**No reproducido**: la funcionalidad está y funciona con datos reales de producción. Gravedad
**informativa**. Lo único que sí conviene revisar (no es de esta auditoría) es la expectativa: quizás el owner
esperaba **elegir el banco en la pantalla de Caja antes de empezar a contar**, y hoy aparece recién dentro del
modal de cierre.

## 3. Hallazgo 2 — Factura

### Qué se midió (producción, solo lectura)

| Medición | Resultado |
|---|---|
| `GET /api/admin/invoices` **sin filtros** | **0 facturas** en toda la base de producción |
| Día del negocio **2026-09-22** (`dateFrom/dateTo` del día, zona del negocio) | **0** |
| Día anterior (2026-09-21) | **0** |
| `/admin/history/facturas` | Día por defecto **2026-09-22** (el día del negocio de hoy) y «Sin facturas en este rango» |
| Pedido `P-MUDF8E1K` | Existe: `status: new`, `type: pickup`, **C$280**, sucursal **Camino de Oriente**, cliente «daniel maki», creado **2026-09-23T01:25:26Z** (19:25 en Managua) |
| `GET /api/admin/orders/{id}/invoice` de ese pedido | **200**, `invoice: null`, `canEmit: true` |

### Cómo funciona la facturación (código)

1. **Cobrar no factura.** La emisión es **a demanda**: botón «Emitir factura» en el detalle del pedido
   (`src/app/(admin)/admin/orders/order-invoice-panel.tsx:147`) → `POST /api/admin/orders/[id]/invoice`
   (`invoice-composition.ts:33`) → `emitInvoice` (`src/modules/invoices/features/emit-invoice/emit-invoice.ts:145`).
   El checkbox «Cliente pide factura con RUC» del POS solo **guarda los datos fiscales** del cliente.
2. **Se factura lo que se cobró**: `emit-invoice.ts:161-167` consulta `canEmitInvoiceFor({ status, hasPayments })`
   y, **sin cobros**, corta con **409** y el mensaje «Ese pedido todavía no tiene ningún cobro: cobralo y
   volvé a intentar.» (`src/modules/invoices/domain/invoice.ts:103`).
3. El listado filtra por **día del negocio** (`businessDayRange`, `src/shared/lib/business-days.ts`), es
   decir `[00:00, 23:59:59.999]` de Managua, contra `Invoice.issuedAt`
   (`src/app/(admin)/admin/history/facturas/facturas-client.tsx:75-88` + `prisma-invoice-repository.ts:161-166`).
   El dueño estaba mirando **el día correcto**.

### Reproducción local (donde hacía falta mutar)

Servidor local con la base de desarrollo, venta de mostrador por la UI y emisión desde el detalle:

| Paso | Resultado |
|---|---|
| Venta de mostrador (crea el pedido **con sus cobros**) | `P-MUDFPSUL`, C$35.00 |
| Panel del pedido | Mostró **`F-000026 · Emitida · 22/9/26, 7:38 p. m.`** (la emisión funcionó; `issuedAt` = 1 s después del cobro) |
| `/admin/history/facturas` (día 2026-09-22) | **F-000026 aparece**, junto a F-000025/F-000024/… del mismo día |

**La emisión y el listado funcionan.** Lo que no funciona es facturar un pedido **sin cobros**, y ahí está el
hueco:

### El hueco de producto (esto sí es un hallazgo)

Un pedido del **menú público** se paga **al retirar**: no crea `Payment` (no hay pasarela). Y **el sistema no
tiene forma de registrarle el cobro a un pedido existente**:

- No existe `POST /api/admin/orders/[id]/payment` (rutas del pedido: `route.ts`, `[id]/route.ts`,
  `[id]/status`, `[id]/invoice`, `[id]/delivery-fee`).
- La venta de mostrador (`register-pos-sale`) **crea un pedido nuevo** con sus cobros.

Consecuencia: el pedido público **nunca va a poder facturarse** tal como está hoy, porque nunca va a tener
cobros en el sistema. El owner hizo lo correcto (apretar «Emitir factura» en el pedido que el cliente pagó en
el mostrador) y el sistema le respondió —o le habría respondido— **409 «todavía no tiene ningún cobro»**.

### Veredicto y gravedad

**Comportamiento esperado** (no se factura lo que no se cobró: es una regla deliberada y probada) **más
feature incompleta**: falta decidir **cómo entra al sistema el cobro de un pedido público**. Gravedad
**P2** (dinero que se cobra en el mostrador y no queda asociado al pedido que lo originó; hoy se resuelve
cobrando una venta nueva).

## 4. Hallazgo 3 — Pedidos

### 3a — «No me dejó hacer pedidos»

| Medición (producción) | Resultado |
|---|---|
| Pedido `P-MUDF8E1K` | **Existe**, `status: new`, `type: pickup`, C$280, cliente «daniel maki», sucursal Camino de Oriente, creado **01:25:26Z** |
| `GET /api/admin/orders?limit=5` | 200; el más nuevo es el de arriba |
| Smoke público del deploy (`test:e2e:prod`) | **7/7**, incluido el paso de checkout (elegir día de retiro y armar el pedido) |

O sea: **el alta pública nunca dejó de funcionar**, y el pedido del owner está en la bandeja como «nueva».

El mensaje que vio —«No pudimos confirmar el pedido. Intentá de nuevo.»— es el **genérico** del checkout
(`src/app/(public)/checkout/checkout-helpers.ts:74`): se muestra para cualquier error que la pantalla no sepa
traducir. Y el alta pública tiene **límite de 10 pedidos por minuto por IP**
(`src/app/api/orders/route.ts:30`, `ORDER_CREATE_RATE_LIMIT`; respuesta **429** con `Retry-After`,
`shared/lib/rate-limit/rate-limit.ts:161`). Un 429 cae justo en el mensaje genérico.

**Hipótesis principal (por confirmar)**: el owner probó varias veces seguidas ⇒ algunos intentos fueron
**429** (mensaje genérico) y **uno pasó** (el pedido que hoy está en «Por aceptar»). El sistema hizo lo
correcto; lo que falla es **el mensaje**: no dice «esperá un momento», dice «intentá de nuevo», que es
justo lo que empeora el 429.

**Lo que no se pudo medir y por qué**: no reproduje el 429 **en producción** (haría falta martillar el
endpoint público, que es tráfico real y ensucia la base) y la reproducción local quedó inconclusa (mi sonda no
resolvió el id de producto del menú y todas las altas murieron en 404 de validación). Queda **por confirmar**
con el Network/DevTools del intento del owner o con los logs del contenedor.

### 3b — Seguimiento del cliente

| Medición | Resultado |
|---|---|
| Pantalla de seguimiento | **Existe**: `src/app/(public)/orders/track/page.tsx`, se consulta con **número de pedido + WhatsApp** (`GET /api/orders/track`; el alta devuelve además un `orderLookupToken`) |
| ¿Está enlazada desde la confirmación? | **No**: `src/app/(public)/success/[orderId]/order-success-view.tsx` no tiene ningún enlace a `/orders/track` ni a `/orders` (su único `href` es el mapa del local) |
| ¿Y desde el menú? | Existe `/orders` (página del cliente) pero tampoco se llega desde la confirmación |

**Veredicto**: **hueco de navegación real** (feature construida, no alcanzable desde donde el cliente
termina). Gravedad **P3**: el cliente puede seguir su pedido si adivina la URL `/orders/track` y recuerda su
número; el camino natural (terminar el pedido y ver «seguí tu pedido») no existe.

## 5. Hallazgos nuevos

| # | Hallazgo | Veredicto | Gravedad |
|---|---|---|---|
| N1 | El **cuadre por banco no muestra ningún número hasta que se escribe un monto**: con el modal abierto y sin declarar, el consolidado dice «Declarado: — / Cobrado sin pasar por el cajón: — / Diferencia del cuadre: —». Es correcto (no hay lote declarado), pero puede leerse como «no funciona» | Comportamiento esperado, expectativa a ajustar | Informativa |
| N2 | El **mensaje de error del checkout es uno solo para causas muy distintas** (límite por IP, error de red, error de servidor). El cliente no puede saber si reintentar sirve o empeora | UX | **P3** |
| N3 | **No hay camino para cobrar un pedido existente**: un pedido del menú (pago al retirar) queda sin `Payment` para siempre; el mostrador cobra una **venta nueva**. Es la causa raíz de fondo del hallazgo 2 | Feature incompleta / decisión de producto | **P2** |

## 6. Preguntas abiertas para el owner

1. **Bancos**: ¿miraste Caja con la **caja abierta** y con el modal de cierre **abierto**? ¿Era la sucursal
   Camino de Oriente (la única con turno abierto cuando medí)? ¿Esperabas elegir el banco **fuera** del modal
   de cierre?
2. **Factura**: al apretar «Emitir factura» en el pedido `P-MUDF8E1K`, ¿qué viste en pantalla: un mensaje
   rojo con «todavía no tiene ningún cobro», un error distinto, o nada? (Ese pedido es del **menú público**,
   o sea pago al retirar: hoy no tiene cobros y por eso no se puede facturar.)
3. **Factura (producto)**: ¿cómo querés que entre al sistema el cobro de un pedido del menú que se paga al
   retirar? (a) el POS cobra un pedido **existente**; (b) el detalle del pedido permite registrar el cobro;
   (c) se acepta que el POS haga una venta nueva y el pedido público se cierre sin cobro.
4. **Pedidos**: ¿recordás cuántos intentos hiciste y si el mensaje apareció después de varios? Si podés
   mirar el Network (o los logs del contenedor) vemos si fue **429**.
5. **Seguimiento**: ¿querés que la confirmación tenga «Seguí tu pedido» (a `/orders/track`) además del
   WhatsApp `+505`?
6. **«Cajero pagó»** (de tu mensaje): quedó aclarado como «**el cliente pagó**», o sea el hallazgo 2.

## 7. Apéndice · método

**Qué se usó**: Playwright/Chromium contra **producción** (`admin.oneburgernic.com`) con la cuenta del owner y
contra **local** (`http://127.0.0.1:3210`, build de `main` con `DATABASE_URL` de desarrollo); lecturas `GET`
desde el contexto de la página (misma sesión, mismas cookies) y lectura del código con `ruta:línea`.

**Qué NO se tocó en producción**: no se creó ningún pedido, no se abrió ni cerró ninguna caja, no se firmó
ningún traspaso, no se emitió ninguna factura, no se guardó ninguna configuración. El modal de cierre se abrió
y se cerró con **«Cancelar»** (solo lectura: su única escritura sería el botón del pie).

**Qué no se pudo medir y por qué**:

| No medido | Motivo | Cómo se cubre |
|---|---|---|
| Emitir una factura **en producción** | Sería una mutación (crea `Invoice`) | Reproducido en **local** con la misma UI (F-000026) |
| El **429** en producción | Habría que martillar el alta pública (tráfico real + basura en la base) | Código leído (`orders/route.ts:30`, `rate-limit.ts:161`, `checkout-helpers.ts:74`) + pendiente el Network del intento del owner |
| Un pedido **público** cobrado y facturado | Requiere decidir el flujo que hoy no existe (N3) | Documentado como hueco |
| Los logs del contenedor de producción | Sin token del panel en el entorno del agente | Queda como pedido al owner si quiere confirmar el 429 |

**Base de producción consultada por API** (solo lectura, a través del panel autenticado): `locations`, `orders`,
`invoices`, `cash/banks`, `cash/terminals`, `pos/shift`, `orders/{id}/invoice`. La base de **producción** no se
consultó por SQL directo (no hay acceso desde acá); los conteos por día se hicieron con los mismos filtros que
usa la pantalla.
