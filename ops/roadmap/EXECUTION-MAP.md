# EXECUTION-MAP — qué falta de verdad en cada orden (5b → 16)

> **Qué es**: para cada orden pendiente del [roadmap maestro](../roadmap/PRODUCT-UX-ROADMAP.md) §2, lo que
> hace falta saber **antes de escribir su brief**: objetivo, **estado real auditado**, dependencias,
> `REUSE` obligatorio, `MOVE`/`CONSOLIDATE`, `NEW` de verdad, deuda asignada, fuera de alcance, decisiones que
> todavía necesita el owner y **gate de cierre**.
>
> **Qué NO es**: no es un segundo roadmap — el orden y las dependencias los manda el
> [roadmap maestro](../roadmap/PRODUCT-UX-ROADMAP.md) y la secuencia inmediata, [`../roadmap/NEXT.md`](../roadmap/NEXT.md).
> Tampoco repite el catálogo de capacidades: eso está en
> [`../product/CAPABILITY-REUSE-MAP.md`](../product/CAPABILITY-REUSE-MAP.md).
>
> ⚠️ **Toda la evidencia de este archivo es un snapshot de `main` = `461cc49` (2026-09-30) y debe revalidarse
> al iniciar la TASK que la use.** El código manda: si algo de acá no coincide con el repo, gana el repo y se
> corrige este archivo en el commit de esa TASK. La fila de **5b** sí se revalidó contra `main` = `4d33a0e`
> al abrir `TASK-ORDERS-RUNTIME-5B` (2026-10-01) y quedó con su estado final.

---

## 5b · Pedidos runtime — **cerrada** (`TASK-ORDERS-RUNTIME-5B`, 2026-10-01)

| Campo | Contenido |
|---|---|
| **Objetivo** | `/admin/orders` denso y paginado, y el detalle del pedido con su historia y su estado de cobro |
| **Estado real** | **Entregada**: el tablero viejo se reemplazó por el read model canónico —`OrderListProjection` paginada con los KPI del **filtro completo**, `OrderDetailProjection` con el **historial real con actor** y los sellos por etapa—, el recorte financiero se aplica **en el servidor**, y la puerta nominal `canViewOrders` dejó a cocina afuera (403 y `/admin/kitchen`) y al cajero adentro |
| **Depende de** | Órdenes 4 y 5, **cerrados** (el estado financiero canónico existe) y 3b, **desplegado** |
| **`REUSE` obligatorio** | Se consumió tal cual: `payments/features/get-order-payment-status` (el estado, **sin recalcularlo**), `orders/domain/order-workflows.ts`, `shared/lib/order-totals.ts`, `order-search`, `order-visibility`/`order-scope`, `order-stage-times`, `money` y el historial de `orders` |
| **`MOVE`/`CONSOLIDATE`** | **Hecho**: el recorrido del detalle dejó de ser un mapa paralelo —sale del **historial real**— y el listado dejó de proyectar `items`/`modifiers`/`history` (`A-61`) |
| **`NEW` real** | `canViewOrders`, `OrderListProjection`/`OrderDetailProjection`, la paginación y los KPI server-side, el **resolutor único de landing por rol** (`resolveAdminLanding`) y la composición de las dos pantallas |
| **Deuda asignada** | `A-09`, `A-10`, `A-60`, `A-61`, `A-62`, `A-63`, el remanente de `A-64`, `A-66` y la autorización mínima de `A-70`: **todos cerrados con evidencia**. `A-12` sigue **fuera** por decisión ya tomada |
| **Fuera de alcance** | El **cobro real** del pedido desde la superficie y su handoff al POS: es el **orden 6** (`A-67`). Tampoco entró el move de Caja (7) |
| **Decisiones del owner** | Ninguna pendiente |
| **Gate de cierre** | **Cumplido**: bandeja paginada y detalle con estado de cobro **consumido de `payments`**; Viewport Contract en los cuatro viewports; E2E local (`tests/e2e/admin-orders.spec.ts`); los hallazgos cerrados con test, mutación y evidencia |

## 6 · Pedido existente → Cobrar en POS

| Campo | Contenido |
|---|---|
| **Objetivo** | Órdenes **localiza** el pedido y el POS lo **cobra** |
| **Estado real** | El backend **ya existe y está probado**: `POST /api/admin/orders/[id]/payment` con `canCollectPayment`, alcance por local, idempotencia (`A-71`) y snapshot obligatorio. **Falta la superficie**: hoy `A-67` no tiene UI |
| **Depende de** | 5b (alguien tiene que localizar el pedido) |
| **`REUSE` obligatorio** | La ruta y `register-order-payment` **tal como están**; el POS como superficie de cobro |
| **`MOVE`/`CONSOLIDATE`** | Ninguno: es **composición** de lo que ya existe. Si aparece un segundo flujo de cobro, es un error de diseño |
| **`NEW` real** | El puente de UI Órdenes → POS (elegir el pedido y abrir el cobro con su contexto) |
| **Deuda asignada** | `A-67` (no hay superficie) · `A-76` (`void` no mira el turno ni la factura) si el cobro lo toca · `A-77` (`Payment.tip`, campo muerto) |
| **Fuera de alcance** | Cash ownership (7) y la reforma de Cierres/Facturas (9) |
| **Decisiones del owner** | **Ninguna nueva**: el cobro ya está decidido; si al componer aparece una regla que no está escrita, se pregunta |
| **Gate de cierre** | Un pedido del menú se localiza en Órdenes y se cobra desde el POS **sin segunda ruta**; el estado del pedido cambia por la proyección; E2E del flujo completo; `A-67` cerrado |

## 7 · Cash ownership

| Campo | Contenido |
|---|---|
| **Objetivo** | `Shift`, apertura, movimientos, conteo, cierre, handover y conciliación con **un dueño propio** |
| **Estado real** | Todo **funciona** pero vive bajo `orders` (`features/shift/*`, `domain/shift-cash.ts`, adaptadores de turno) y la configuración bajo `cash-config`. Los **dos** módulos existen y están separados a medias: la regla sigue en `orders` |
| **Depende de** | 5b y 6 (el POS y Órdenes tienen que estar quietos antes de mover la caja) |
| **`REUSE` obligatorio** | La lógica de arqueo **tal como está** (está probada contra PostgreSQL real: lock del turno, cierre atómico); `money` para la conversión; `cash-config` para el conteo |
| **`MOVE`** | `orders/features/shift/**` → `src/modules/cash/` y su puerto/adaptadores, **`git mv` + adaptadores finos**, sin reescribir comportamiento probado |
| **`CONSOLIDATE`** | Los **cuatro** `runIn*Transaction` casi idénticos (`A-79`) en un solo runner parametrizado |
| **`NEW` real** | Sólo el nombre del módulo y su contrato; **no** una caja nueva |
| **Deuda asignada** | `A-79` (runners duplicados) · `A-52` (el repositorio del alcance no está atado al `tx`) · `A-53` (el cierre «no-op» contesta 200 sin datos) · `A-90` (el contexto del cierre) · la parte de Caja de `A-91`/`A-92` |
| **Fuera de alcance** | Reformar el arqueo o el desglose: el move **no cambia números** |
| **Decisiones del owner** | Si el move conserva las rutas públicas de Caja (recomendado) o las renombra |
| **Gate de cierre** | Suite de Caja en verde **sin cambios de expectativas**; PostgreSQL real 100% verde; ninguna ruta ni pantalla cambia de URL; los cuatro runners quedan en uno |

## 8 · Separar Configuración: Negocio / Finanzas / Personalización / Locales

| Campo | Contenido |
|---|---|
| **Objetivo** | Cada área con **su** entrada y **su** dueño |
| **Estado real** | Finanzas **ya salió** (`/admin/finance`, con `money`/`payments`/`banks` como dueños) y Personalización **dejó de editar** moneda, símbolo, locale y tasa (`A-84`). `settings-client.tsx` sigue siendo un archivo enorme (`A-26`, 900+ líneas) y Locales tiene pantalla propia |
| **Depende de** | 7 (para no mover caja y configuración a la vez) |
| **`REUSE` obligatorio** | Las pantallas y rutas que ya existen; los casos de uso de `business-settings` |
| **`MOVE`/`CONSOLIDATE`** | Partir `settings-client.tsx` por área; **sacar de Personalización** lo que ya no le pertenece (si queda algo) y **enlazar** a Finanzas |
| **`NEW` real** | La navegación por área, no una configuración nueva |
| **Deuda asignada** | `A-26` (`settings-client.tsx` de 951 líneas) · `A-24` (controles crudos en el admin) · `A-22` (deuda de UI sin guardrail) · `A-91` (los specs de Locales) |
| **Fuera de alcance** | La reforma **fiscal** de Invoice (`A-34`, orden 9) y la elección de tema |
| **Decisiones del owner** | Qué queda en «Personalización» después de sacar dinero (branding, contacto, horarios) |
| **Gate de cierre** | Ningún formulario edita lo que no es suyo; cada entrada lleva a su área; techos de archivo **bajados** en el mismo commit |

## 9 · Separar Cierres / Facturas

| Campo | Contenido |
|---|---|
| **Objetivo** | Dos capacidades, dos documentos, dos dueños |
| **Estado real** | Viven juntos en `/admin/history`; la factura exige `paid` estricto (`D-021`) y su numeración es atómica (`AUD-006`). La anulación no se imprime y no hay puerta de rol por sucursal (`A-70`); `canPrintCashDocuments` no tiene guarda de servidor (`A-78`) |
| **Depende de** | 7 (los cierres son de Caja) |
| **`REUSE` obligatorio** | `emit-invoice` con su puerta; el snapshot del turno |
| **`MOVE`/`CONSOLIDATE`** | Separar las dos superficies; llevar la impresión de documentos a su dueño |
| **`NEW` real** | La superficie de cada una y la **guarda de servidor** de la impresión |
| **Deuda asignada** | `A-70` · `A-78` · `A-76` (la anulación no marca la factura) · `A-20`/`A-34` (fiscal y RUC) |
| **Fuera de alcance** | Facturación electrónica/fiscal: **no** es de este orden |
| **Decisiones del owner** | Qué se imprime al anular y quién puede imprimir |
| **Gate de cierre** | Cada documento tiene su superficie y su puerta **en el servidor**; la anulación deja rastro impreso; nada se re-emite retroactivamente |

## 10 · Promotions ownership

| Campo | Contenido |
|---|---|
| **Objetivo** | Elegibilidad, alcance, límites, canje y BOGO **fuera** de `orders` |
| **Estado real** | `coupons` existe como módulo pero la elegibilidad y el canje viven en el alta de pedidos; Promociones tiene pantalla propia |
| **Depende de** | 5b (el pedido tiene que estar ordenado antes de mover su descuento) |
| **`REUSE` obligatorio** | `Coupon` y su consumo de uso (ya es atómico) |
| **`MOVE`** | La elegibilidad y el canje desde `orders` → `promotions` |
| **`NEW` real** | BOGO y alcance, si el owner los pide; si no, se declara `FROZEN` |
| **Deuda asignada** | `A-13` (módulos cascarón `coupons` y `table-ordering`) · el remanente de descuentos del POS |
| **Fuera de alcance** | Un motor de reglas genérico: no se construye por anticipación |
| **Decisiones del owner** | Si BOGO entra al MVP y con qué alcance |
| **Gate de cierre** | Un descuento se decide en **un** módulo; el pedido lo **consume**; los cupones siguen sin consumirse dos veces |

## 11 · Consolidar `/activity` + `/orders` + `/orders/track`

| Campo | Contenido |
|---|---|
| **Objetivo** | Una sola historia del pedido para el cliente |
| **Estado real** | Las tres superficies existen y muestran partes distintas |
| **Depende de** | 6 (el cliente tiene que poder ver su cobro) |
| **`REUSE` obligatorio** | Los read models del pedido y el token de consulta (`orderLookupTokenHash`) |
| **`CONSOLIDATE`** | Una superficie con una **sola** lectura; las otras quedan como redirect |
| **`NEW` real** | Sólo la composición |
| **Deuda asignada** | `A-11` (timeouts de la QA de solo lectura) |
| **Fuera de alcance** | Cuentas de cliente con historial largo |
| **Decisiones del owner** | Qué pasa con los enlaces viejos (`/activity`) |
| **Gate de cierre** | Una sola URL sirve la historia; los enlaces viejos siguen funcionando |

## 12 · Clasificar y sanear `FROZEN`/`LEGACY`

| Campo | Contenido |
|---|---|
| **Objetivo** | Decidir qué se queda, qué se apaga y qué se borra: inventario, reservas, zonas de delivery, mesas, cupones, `table-ordering` |
| **Estado real** | Todo el código está presente y **fuera de la navegación**; las páginas quedan por URL directa |
| **Depende de** | 10 (para saber qué queda del motor de promociones) |
| **`REUSE` obligatorio** | Lo que se apague, se apaga con `isActive`/navegación, no se borra a ciegas |
| **`MOVE`/`CONSOLIDATE`** | `A-13`: los cascarones se clasifican |
| **`NEW` real** | Ninguno: es una decisión, no una construcción |
| **Deuda asignada** | `A-13` · `A-16` y `A-18` (revisar si ya están obsoletos) · `A-36` (rama `feat/design-system` de otro dev) |
| **Fuera de alcance** | Reactivar cualquier módulo fuera del MVP |
| **Decisiones del owner** | **Todas**: qué se apaga y qué se conserva. Sin su respuesta, este orden no se abre |
| **Gate de cierre** | Cada capacidad del MVP tiene clasificación escrita (`ACTIVE`/`FROZEN`/`LEGACY`/`FUTURE`) y ninguna se ofrece por accidente |

## 13 · Abstracción de pagos — **sólo si aparece una necesidad real**

| Campo | Contenido |
|---|---|
| **Objetivo** | Poder sumar un proveedor de pago **si y sólo si** el negocio lo pide |
| **Estado real** | El negocio cobra **en el local** (sin pasarela): no hay necesidad declarada. El snapshot y el estado financiero ya están listos para un cobro con referencia externa |
| **Depende de** | 6 (el cobro tiene que estar completo) |
| **`REUSE` obligatorio** | `payments` (snapshot, medios, `requiresReference`) |
| **`NEW` real** | El adaptador del proveedor, **cuando exista** |
| **Deuda asignada** | Ninguna |
| **Fuera de alcance** | Construirlo por anticipación: el roadmap lo dice explícitamente |
| **Decisiones del owner** | Si hay proveedor y cuál |
| **Gate de cierre** | No se abre sin una necesidad escrita del owner |

## 14 · Table Service / Mesas

| Campo | Contenido |
|---|---|
| **Objetivo** | Reabrir el servicio de mesa |
| **Estado real** | El código existe y está `FROZEN`; hoy solo retiro |
| **Depende de** | 12 (la clasificación tiene que haber decidido qué se conserva) |
| **`REUSE` obligatorio** | `tables` y `table-ordering` si sobreviven al orden 12 |
| **`NEW` real** | El flujo de mesa en el POS y en cocina |
| **Deuda asignada** | `A-13` |
| **Fuera de alcance** | Delivery |
| **Decisiones del owner** | **Todas**: es una decisión de negocio |
| **Gate de cierre** | No se abre sin decisión explícita del owner |

## 15 · Refinamiento restante de Catálogo

| Campo | Contenido |
|---|---|
| **Objetivo** | Lo que no entró en las secciones anteriores |
| **Estado real** | El catálogo (categorías, productos, modificadores, bloques) funciona y tiene pantalla propia |
| **Depende de** | 12 y 14 (para saber qué queda) |
| **`REUSE` obligatorio** | `menu` como dueño único de precios y opciones |
| **`NEW` real** | Sólo mejoras de operación: sin motor nuevo |
| **Deuda asignada** | `A-24` · `A-22` |
| **Fuera de alcance** | Fotografía/medios fuera de lo existente |
| **Decisiones del owner** | Qué refinamiento duele más en el día a día |
| **Gate de cierre** | Se define al abrir la TASK, con la lista del owner |

## 16 · Resumen

| Campo | Contenido |
|---|---|
| **Objetivo** | `/admin`, el overview del negocio |
| **Estado real** | El caso de uso existe (`get-admin-overview-performance`, con el neto de devoluciones de `A-58`/`A-74`) y **no tiene pantalla**: `/admin` redirige a Órdenes |
| **Depende de** | **Todo lo anterior**: un overview sólo es honesto cuando las fuentes que resume ya están ordenadas |
| **`REUSE` obligatorio** | Los read models de Pedidos, Caja, Facturas y Pagos; `money` para el formato |
| **`NEW` real** | La composición del tablero |
| **Deuda asignada** | `A-10` (la home del panel no existe para roles sin Resumen) |
| **Fuera de alcance** | Reportes avanzados (fuera del MVP) |
| **Decisiones del owner** | Qué mira primero cada rol |
| **Gate de cierre** | El tablero **consume** datos monetarios y **no** convierte; cada KPI tiene su fuente declarada |

---

## Cómo se usa este archivo

1. **Al abrir una TASK**: se lee su fila y **se revalida contra el código**; lo que haya cambiado se corrige
   acá, en el commit de esa TASK.
2. **Al escribir el brief**: los campos `REUSE`, `MOVE`/`CONSOLIDATE` y `NEW` son el **Reuse Audit** (ley 2);
   `Deuda asignada` y `Fuera de alcance` son el `SCOPE OUT`.
3. **Al cerrar**: el `Gate de cierre` es la lista de aceptación; lo que no se cumpla se degrada con el motivo
   escrito en [`../audit-backlog.md`](../audit-backlog.md), no se borra.

## Lo que NO entra en este mapa

Los hallazgos **operativos y de infraestructura** no pertenecen a ningún orden del roadmap de producto y **no
se meten a la fuerza en una feature**: siguen viviendo, visibles, en [`../audit-backlog.md`](../audit-backlog.md).
El ejemplo vivo es **`A-57`** (el backup programado de producción no genera archivos y no hay retención
declarada): es decisión del **owner** sobre la infraestructura, no trabajo de producto, y no bloquea ninguna
TASK de esta secuencia. Tampoco entran los hallazgos de **calidad del arnés** (`A-91`, `A-92`): se cierran con
una TASK propia de QA, no dentro de un orden de producto.
