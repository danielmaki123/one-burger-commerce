# MODULE_ARCHITECTURE.md — arquitectura de producto y módulos

**Qué es**: la **fuente de la arquitectura de producto** —la constitución mínima del producto— y responde una
sola pregunta:

> ¿Dónde pertenece cada capacidad de One Burger y quién es dueño de sus reglas?

**Qué NO es**: no es el historial, no es el estado actual y no es el manual técnico. **No reemplaza a
[`AGENTS.md`](../../AGENTS.md)** —que sigue mandando en comportamiento y límites— ni a
[`.agents/CONTEXT.md`](../../.agents/CONTEXT.md), donde vive cómo está construido el sistema (superficies,
stack, DDD, bounded contexts, persistencia, auth, CI). El **proceso** que produjo este documento y lo que
viene después está en [`ops/roadmap/PRODUCT-UX-ROADMAP.md`](../roadmap/PRODUCT-UX-ROADMAP.md).

**Cadena de autoridad** (de mayor a menor): instrucción explícita del owner → seguridad, integridad de
datos y accesibilidad → [`AGENTS.md`](../../AGENTS.md) → **este documento** → la constitución visual que
cree `DS-001` → la spec de pantalla → el registro de componentes → la implementación.

**Estado**: escrito en `ARCH-001` (2026-09-25) a partir del **código real**, no de documentos previos. Lo
que hoy no coincide con la dirección conceptual del roadmap queda **registrado** en §12 en vez de
corregirse por decreto: este documento no rediseña nada.

---

## 1. Definiciones

| Término | Definición |
|---|---|
| **Módulo** | Capacidad **estable** del negocio, con responsabilidad y reglas propias. Vive en `src/modules/<módulo>/`. |
| **Sección** | Agrupación coherente de **navegación**. Es una decisión de información, no de código. |
| **Pantalla** | Vista concreta con la que alguien realiza **una tarea**. |
| **Feature** | Capacidad específica **dentro** de un módulo. |
| **Overview** | Vista **transversal** que consume información de varios módulos **sin apropiarse de sus reglas**. |

Las cinco definiciones son independientes: una sección puede agrupar varias pantallas del mismo módulo; una
pantalla puede consumir varios módulos; y un módulo puede no tener sección propia.

---

## 2. Regla fundamental

**Una feature nueva pertenece, por defecto, a un módulo existente.**

Crear un **módulo**, una **sección** o una **entrada nueva de navegación principal** es la **excepción**, y
se justifica porque apareció una **responsabilidad estable del negocio**, nunca porque apareció una pantalla
nueva. La justificación se escribe antes de codear (ver §10) y, si se aprueba, queda anotada acá en el mismo
commit.

Corolario: **una pantalla nueva no crea un módulo**, y **una ruta nueva no crea una sección**.

---

## 3. Estado real del panel (verificado en el código)

Fuente única de la navegación: `src/app/(admin)/admin/admin-layout-helpers.ts`. Secciones y entradas de hoy,
en el orden en que se dibujan:

| Sección | Entradas | Ruta | Quién la ve |
|---|---|---|---|
| **Operación** | Resumen | `/admin` | owner |
| | Órdenes | `/admin/orders` | owner, manager, kitchen, cashier |
| **Control** | POS | `/admin/pos` | owner, manager, cashier (con el mostrador prendido en algún local) |
| | Caja | `/admin/cash` | owner, manager, cashier |
| | Cierres | `/admin/history/cierres` | owner, manager |
| | Aprobaciones | `/admin/approvals` | la entrada la ve también el manager, pero la pantalla exige `canApproveRefund`: el manager rebota a Órdenes (§12.11) |
| | Config de Caja | `/admin/cash/config` | owner |
| **Catálogo** | Menú | `/admin/menu` | owner, manager |
| **Configuración** | Locales | `/admin/locations` | owner |
| | Usuarios | `/admin/users` | owner |
| | Personalización | `/admin/settings` | owner |
| | Alertas | `/admin/settings/notifications` | owner |

El grupo **Control** se arma ítem por ítem con su propia puerta y no se dibuja si queda vacío
(`withControlGroup`). El rol llega **por cliente** (`/api/auth/admin/session`) y **la autorización real es
server-side**: ocultar una entrada no autoriza nada.

**Dirección conceptual del roadmap y realidad del código**: el roadmap dibuja `RESUMEN` como overview
transversal separado y `POS` dentro de `OPERACIÓN`. El código de hoy pone **Resumen como primer ítem de
Operación** y **POS dentro de Control** (después de Operación: primero el turno, después la plata del
turno). Ninguna de las dos es un error: es una **divergencia registrada** y moverla es una decisión
explícita del owner en la revisión de la sección, no un efecto colateral de este documento.

---

## 4. Módulos de dominio

Un módulo nace con las cuatro capas (`domain` · `features` · `ports` · `adapters`); lo custodia
`src/shared/contracts/module-contract.test.ts`, que además **congela** las excepciones con su motivo.

| Módulo | Responsabilidad | Estado |
|---|---|---|
| `orders` | Ciclo de vida del pedido, cobros, devoluciones, promociones/cupones, turno de caja y movimientos de caja | REAL |
| `pos` | Venta de mostrador: borrador, venta, cierre de turno del mostrador, disponibilidad | REAL |
| `menu` | Catálogo: categorías, subcategorías, productos, modificadores, bloques de marketing | REAL |
| `locations` | Sucursales: datos de retiro, horario, catálogo y precio por local | REAL |
| `cash-config` | Reglas del arqueo: monedas, denominaciones, terminales | REAL |
| `banks` | Bancos y su relación con los locales | REAL |
| `invoices` | Factura del pedido: emisión, consulta y anulación | REAL |
| `auth` | Sesión del admin, roles y **todas** las puertas de autorización | REAL |
| `business-settings` | Configuración del negocio: marca, moneda, horarios, propina, aceptación de pedidos | REAL |
| `notifications` | Outbox, ajustes de notificación y Telegram | REAL |
| `customers` | Cliente del menú público: OTP, sesión, datos fiscales | REAL |
| `audit` | Registro de acciones sensibles | REAL |
| `dashboard` | **Read models** transversales: métricas del overview y reportes | REAL (solo `domain` + `features`) |
| `inventory` | Inventario | FUERA DEL MVP (código presente, sin navegación ni API pública) |
| `reservations` | Reservas | FUERA DEL MVP |
| `tables` | Bootstrap heredado de mesas | FUERA DEL MVP + LEGACY |
| `landing` | Secuencia de frames del landing | LEGACY (solo `domain`) |
| `coupons` | — | LEGACY: cascarón sin código (el motor vive en `orders`) |
| `table-ordering` | — | LEGACY: cascarón sin código |

**Fuera del MVP no significa borrado**: significa que **no se ofrece** en navegación ni en APIs públicas y
no se reactiva sin aprobación explícita del owner.

Hay además **reglas transversales que no pertenecen a un módulo** y se consumen desde todos: los totales del
pedido salen de `src/shared/lib/order-totals.ts` y el estado del pedido de
`src/modules/orders/domain/order-workflows.ts`. Una sola fuente por cálculo, siempre.

---

## 5. Ownership

**Una entidad puede mostrarse en varias pantallas; eso no autoriza a duplicar sus reglas.** El owner
conceptual es el módulo donde vive su significado, sus invariantes y sus transiciones.

| Agregado / capacidad | Módulo dueño | Puerta de autorización (hoy) |
|---|---|---|
| Order, OrderItem, estado del pedido | `orders` | `canManageOrderOperations` |
| Cobro de un pedido y **anulación** de un cobro | `orders` | `canUsePOS` (cobrar) · `canVoidPayment` (anular) |
| Devolución (pedido y revisión) | `orders` | `canRefund` (pedir) · `canApproveRefund` (firmar) |
| Turno de caja, conteos, traspaso, cierre de banco, movimientos | **dueño conceptual: Caja** · implementación repartida entre `orders` (`domain`/`adapters`) y `pos` (casos de uso del mostrador) | `canUsePOS` (abrir/cobrar/cerrar) · `canManageCash` (administrar) |
| Reglas del arqueo (monedas, denominaciones, terminales) | `cash-config` | `canManageCashConfig` |
| Bancos | `banks` | `canManageCashConfig` |
| Product, Category, Subcategory, ModifierGroup, bloques de menú | `menu` | `canManageMenu` |
| Promociones y cupones | `orders` (motor y casos de uso) · pantalla en Catálogo | `canManagePromotions` |
| Location, catálogo por local | `locations` | `canManageBusinessSettings` |
| User, Role, sesión del admin | `auth` | `canManageUsers` |
| BusinessSettings (marca, moneda, horarios, propina) | `business-settings` | `canManageBusinessSettings` |
| Invoice (emisión, anulación) | `invoices` | `canUsePOS` (emitir) · owner (anular) |
| Refund (registro financiero) | `orders` | `canApproveRefund` |
| Payment (registro financiero) | `orders` | `canUsePOS` · `canVoidPayment` |
| AdminAuditLog | `audit` | se escribe desde las operaciones sensibles |
| OutboxEvent, NotificationSettings | `notifications` | `canManageBusinessSettings` |
| Customer | `customers` | sesión del cliente |
| Métricas del Resumen y reportes | `dashboard` (read model, **sin** reglas propias) | `canViewAdminOverview` |

**Regla de cruce**: cuando una pantalla de un módulo necesita datos de otro, **consume** sus casos de uso o
sus datos; **no** reimplementa su regla. Una regla duplicada en un dashboard es una regla que va a
divergir.

---

## 6. Regla especial de Resumen

`/admin` — **Resumen** es un **overview transversal**. Puede leer:

- pedidos y su estado;
- caja y turnos;
- cierres;
- locales;
- catálogo (por ejemplo, top de productos);
- métricas comerciales;
- futuras projections / read models.

Y **no absorbe el ownership de ninguno**. Muestra **señales**; las secciones propietarias muestran y
**resuelven** el detalle:

```text
Resumen:  2 pedidos atrasados        → Ver Órdenes
Órdenes:  posee el ciclo de vida del pedido.

Resumen:  1 cierre con diferencia    → Ver Cierres
Caja/Cierres: poseen la investigación y la resolución.
```

Un dato del Resumen **no** crea un módulo: «top de productos» es una señal comercial del catálogo, no un
módulo *Productos*; «ventas del día» es una métrica de pedidos, no un módulo *Ventas*.

---

## 7. Navegación

**El sidebar no es un sitemap.** No toda ruta merece una entrada principal.

```text
Sección
  ↓
Pantalla
  ↓
Detalle
```

Una ruta como `/admin/orders/[id]` o `/admin/cash/history/[id]` **existe sin entrada propia**. Hoy tampoco
tienen entrada: `/admin/menu/*` (se entra por el hub de Menú), `/admin/promotions` (se entra por el hub de
Menú), `/admin/history/facturas` (es la segunda tab de la sección *Cierres*, que cubre la sección con su
`matchPath`) y `/admin/cash/report`.

Si una feature necesita una jerarquía muy profunda, **primero se revisa la arquitectura**, después se
agrega la ruta.

---

## 8. Roles

**Los roles cambian permisos, acciones, alcance y qué información se ve. No crean arquitecturas paralelas.**

Prohibido el patrón `/owner/orders`, `/manager/orders`, `/cashier/orders`. Preferido: **una misma
capacidad** con autorización **server-side** (la puerta de dominio de
`src/modules/auth/domain/admin-permissions.ts`), y como mucho entradas de navegación **filtradas** por rol
sobre esa misma capacidad.

Límites de rol que ya son regla del repo y no se negocian acá: `kitchen` no maneja plata; `cashier` cobra y
cierra su turno, no administra caja, no devuelve, no descuenta a mano y no ve el esperado del arqueo.

---

## 9. Datos dinámicos (invariante)

**Las entidades administrables del negocio no se hardcodean como estructura cerrada de la UI.** Aplica a
sucursales, productos, categorías, usuarios, modificadores y cualquier otra dimensión configurable.

Si se crea una sucursal nueva, las superficies que consumen locales (filtros, comparaciones, gráficos,
selects, POS) **se adaptan por datos**. No debería hacer falta agregar su nombre a mano en un componente.

Corolario de UI: un componente recibe **colecciones**; no conoce la lista de sucursales reales.

---

## 10. Gate para capacidades nuevas

Antes de crear una **ruta o sección importante**, el agente contesta por escrito:

1. ¿Es un **módulo**, una **sección**, una **pantalla** o una **feature**?
2. ¿Existe un módulo que **ya sea dueño** de esta capacidad?
3. ¿Quién posee las **reglas y los datos**?
4. ¿Necesita **navegación principal**?
5. ¿Es una **tarea recurrente**?
6. ¿Está **duplicando** una capacidad existente?

Si la respuesta a (2) es «sí», la capacidad **va ahí** y no se abre nada nuevo. Solo si la capacidad es una
**responsabilidad estable nueva** se propone módulo, sección o entrada —y eso lo aprueba el owner.

**Qué NO pasa por este gate**: un bugfix pequeño dentro de un módulo conocido, un ajuste de copy, un test,
una corrección de estilo. La burocracia es para lo estructural, no para el trabajo normal.

---

## 11. Integración con agentes y enforcement

- Una **feature nueva** consulta este documento antes de decidir dónde vive (skill
  [`new-task`](../../.agents/skills/new-task/SKILL.md)).
- Una **pantalla nueva** identifica primero **su módulo** (skill
  [`ui-change`](../../.agents/skills/ui-change/SKILL.md)).
- Crear una **sección o un módulo** es una **decisión explícita** con la justificación de §10, no un efecto
  colateral.
- Un **bugfix normal** no atraviesa este proceso.

**Automatizado** (solo propiedades objetivas, en `src/shared/contracts/`): que esta fuente exista una sola
vez, que `AGENTS.md`, [`ops/CURRENT.md`](../CURRENT.md) y [`ops/tasks/START-HERE.md`](../tasks/START-HERE.md)
la citen, que las skills que crean capacidades la referencien, que sus propias referencias no apunten al
vacío y que no crezca como un manual.

**NO automatizado a propósito**: decidir si una feature «pertenece» a Caja o a Órdenes. Eso necesita
criterio y lo resuelve §2 + §5 + §10, con revisión humana.

---

## 12. Deuda conocida (documentada, no corregida en `ARCH-001`)

Nada de esta lista se tocó: son hallazgos de la verificación previa y quedan **registrados** para que la
próxima TASK no los herede por accidente.

1. **El dominio de Caja está repartido**: las reglas del turno viven en `src/modules/orders/domain/shift-*.ts`
   y `src/modules/pos/domain/shift-close-policy.ts`, con adaptadores en `orders`. El dueño conceptual es
   **Caja**; hoy no existe un módulo `cash`. Unificarlo es una decisión, no un reflejo.
2. **Promociones**: la entidad y su motor viven en `orders`, la pantalla en `/admin/promotions` y se entra
   por el hub de Menú. Coherente con «una feature vive en un módulo existente», pero el nombre del módulo no
   lo sugiere.
3. **`dashboard` lee Prisma directo** en sus cinco features y no define puertos: es el único módulo que
   construye sus read models sin puerto propio. Riesgo real: que una regla de `orders` se reimplemente ahí.
4. **Cascarones**: `src/modules/coupons/README.md` y `src/modules/table-ordering/README.md` no tienen una
   línea de código (`A-13` en el backlog: borrarlos o completarlos, decide el owner).
5. **`/admin/menu`** (página de servidor) no verifica sesión ni permiso y lee la base con
   `src/modules/menu/adapters/prisma-menu-repository.ts` directamente.
6. **Puertas sin uso**: `canRefund` solo se invoca dentro de `assertCanRefund`, que hoy no tiene call site,
   así que la ruta de devoluciones autoriza por `canManageCash`; `canPrintCashDocuments` se evalúa en la
   pantalla de Caja y ninguna ruta lo exige. `/api/admin/users` no aplica `canManageUsers` en la ruta
   (la aplican los casos de uso, que sí es una frontera de servidor válida).
7. **Locales sin puerta propia**: `/api/admin/locations/**` se autoriza con `canManageBusinessSettings`
   (marca del negocio), no con una puerta `canManageLocations`. Hoy coinciden en rol; son responsabilidades
   distintas.
8. **Entrada muerta en la barra móvil**: `/admin/tables` («Mesas») está declarada como tab del móvil y el
   filtro por permisos la descarta siempre, porque no pertenece a ningún grupo.
9. **Prisma en route handlers** de `src/app/api/admin/tables/**`: deuda congelada por
   `src/shared/contracts/route-contract.test.ts`, que prohíbe ampliarla.
10. **`/admin` no existe para roles sin Resumen** (`A-10`): un `manager` o una `kitchen` aterrizan en
    Órdenes. Es una decisión de producto pendiente, no un bug de arquitectura.
11. **Aprobaciones: la entrada y la pantalla no piden lo mismo.** El ítem del sidebar se dibuja con
    `canManageCash` (owner y manager), pero `/admin/approvals` exige `canApproveRefund` (solo owner), así que
    un manager ve una entrada que lo rebota a Órdenes. La pantalla es la dueña de la decisión; el ítem
    debería usar la misma puerta.

---

## 13. Evolución registrada (no creada)

Secciones que **podrían** existir y que este documento **no** crea: `Ventas`, `Analytics`, `Productos`,
`Inventario` como sección. Si alguna aparece, tiene que ganarse su lugar con el gate de §10 y con una
responsabilidad estable que no sea ya de `dashboard`, `menu`, `orders` o del módulo de inventario que ya
existe fuera del MVP.

**No se reservan rutas vacías** ni se crean módulos por anticipación.

---

## 14. Qué NO decide este documento

- **Lo visual**: colores, tipografía, densidad, motion y componentes. Eso es la constitución visual que cree
  `DS-001` (fase del roadmap; **todavía no existe**, así que hoy la autoridad visual sigue siendo la que
  declara [`AGENTS.md`](../../AGENTS.md)).
- **El diseño de una pantalla**: propósito, información, jerarquía y estados van en la spec de esa pantalla,
  por sección y con aprobación del owner.
- **El detalle técnico de la construcción**: vive en [`.agents/CONTEXT.md`](../../.agents/CONTEXT.md) y en
  los contratos ejecutables.
- **Reglas nuevas de negocio**: este documento **documenta** las que existen; no las inventa ni las cambia.
