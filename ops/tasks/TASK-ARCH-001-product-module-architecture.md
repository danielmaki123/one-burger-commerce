# TASK-ARCH-001 — Product & Module Architecture

## TASK ID

`TASK-ARCH-001` (fase 1 del [roadmap de producto](../roadmap/PRODUCT-UX-ROADMAP.md)).

## Título

Fijar la constitución mínima de producto: dónde pertenece cada capacidad y quién es dueño de sus reglas.

## Prioridad

`P3` (documentación y arquitectura; **no** toca producto, dinero, datos ni rutas).

## Clase de riesgo

`docs/CI`.

---

## PROBLEMA

El repo tiene una arquitectura **de código** muy custodiada (módulos, capas, contratos) y una **de producto**
inexistente: no hay ninguna fuente que diga dónde pertenece una capacidad nueva ni quién es dueño de sus
reglas. Sin eso, cada agente y cada sección nueva deciden otra vez, y el resultado natural es una pantalla
que después hay que reubicar, una sección que duplica a otra y una regla de negocio reimplementada en un
dashboard.

## EVIDENCIA

Verificación previa medida sobre el código real (2026-09-25), no sobre documentos:

- **Navegación**: fuente única `src/app/(admin)/admin/admin-layout-helpers.ts` — secciones Operación
  (Resumen, Órdenes), Control (POS, Caja, Cierres, Aprobaciones, Config de Caja), Catálogo (Menú) y
  Configuración (Locales, Usuarios, Personalización, Alertas), con el grupo Control armado ítem por ítem con
  su propia puerta.
- **Rutas**: 40 `page.tsx` bajo `src/app/(admin)`; 70 `route.ts` bajo `src/app/api/admin`.
- **Autorización**: 24 puertas en `src/modules/auth/domain/admin-permissions.ts`, aplicadas server-side en
  las rutas, en los casos de uso o en la página; **no existe** `src/middleware.ts`.
- **Módulos**: 19 carpetas en `src/modules`, con sus excepciones ya congeladas en
  `src/shared/contracts/module-contract.test.ts`.
- **Ownership real**: `orders` (pedido, cobro, devolución, promoción, turno, movimiento de caja), `pos`
  (venta de mostrador y cierre del turno), `menu` (catálogo), `locations`, `cash-config`, `banks`,
  `invoices`, `auth`, `business-settings`, `notifications`, `customers`, `audit`, `dashboard` (read models).

**Clasificación interna de la verificación** (queda documentada acá, no como segunda constitución):

| Clasificación | Qué entró |
|---|---|
| **REAL** | Las cuatro secciones y sus entradas; las 24 puertas; los 13 módulos del MVP; el ownership de pedido, cobro, devolución, catálogo, local, usuario, configuración, factura y banco |
| **LEGACY** | `landing` (solo `domain`), los cascarones `coupons` y `table-ordering` (solo `README.md`), `tables` (bootstrap heredado), los route handlers de `api/admin/tables/**` con Prisma y las 49 rutas fuera del tope de 50 líneas |
| **CONTRADICTORIO** | El roadmap dibuja Resumen como overview separado y POS en Operación; el código pone Resumen como primer ítem de Operación y POS en Control. También: el dueño conceptual de Caja es único, pero su dominio está repartido entre `orders` y `pos` |
| **FUTURO** | `Ventas`, `Analytics`, `Productos`, `Inventario` como sección: **no** se crean, se registran como evolución posible |

## CAUSA RAÍZ

La arquitectura de producto nunca se escribió como fuente única: se fue **deduciendo** del código y de
conversaciones. Todo lo que no está escrito se vuelve a decidir, y decidir dos veces la misma ubicación es
exactamente lo que produce el rediseño repetido que el roadmap busca evitar.

## INVARIANTE

1. Una capacidad nueva pertenece a un **módulo existente** salvo justificación explícita y aprobada.
2. Una entidad se **muestra** en varias pantallas; sus **reglas** viven en un solo módulo.
3. Resumen **muestra señales**; las secciones propietarias **resuelven** el detalle.
4. Las entidades administrables (sucursales, productos, categorías, usuarios) **no** se hardcodean como
   estructura cerrada de la UI.

## BOUNDED CONTEXT

N/A — la TASK no modifica código de producto. Su alcance es documental y de contratos
(`src/shared/contracts/`), que es donde vive el enforcement objetivo.

---

## SCOPE IN

- **Nuevo**: `ops/product/MODULE_ARCHITECTURE.md` — definiciones (módulo, sección, pantalla, feature,
  overview), regla fundamental, estado real verificado del panel, módulos existentes con su estado,
  ownership de cada agregado, regla especial de Resumen, navegación, roles, datos dinámicos, gate de
  capacidades nuevas, enforcement, **deuda conocida** y evolución registrada.
- **Nuevo**: este brief.
- **Contratos** (`src/shared/contracts/`): la fuente existe una sola vez; `AGENTS.md`,
  `ops/CURRENT.md` y `ops/tasks/START-HERE.md` la citan; las skills `new-task` y `ui-change` la referencian;
  sus propias referencias no apuntan al vacío; y no crece como un manual (techo de líneas).
- **Puntos de entrada**: `AGENTS.md` (mapa del sistema, misma cantidad de líneas), `ops/CURRENT.md`,
  `ops/tasks/START-HERE.md`, `ops/roadmap/NEXT.md` y las dos skills.

## SCOPE OUT

No se toca: ninguna pantalla, ningún componente, ningún route handler, ningún caso de uso, ningún módulo de
`src/modules/`, el esquema Prisma, la navegación real, el sidebar ni el sistema de diseño. **No** se crea
`DESIGN_SYSTEM.md` (es de `DS-001`), **no** se crean specs de pantalla, **no** se crean las secciones
futuras, **no** se mueven módulos y **no** se renombran rutas. La deuda encontrada se **documenta**, no se
corrige.

## DEPENDENCIAS

`ROADMAP-001` (adopción del roadmap, PR #51) mergeado. Ninguna credencial. Ninguna migración.

## ARCHIVOS PROBABLES

| Archivo | Quién más lo consume |
|---|---|
| `ops/product/MODULE_ARCHITECTURE.md` (nuevo) | Agentes y TASKs futuras; lo citan `AGENTS.md`, `START-HERE.md`, `CURRENT.md` y dos skills |
| `src/shared/contracts/agent-system-contract.test.ts` | El job `contracts` del CI |
| `src/shared/contracts/docs-sync-contract.test.ts` | El job `contracts` del CI |
| `AGENTS.md`, `ops/CURRENT.md`, `ops/tasks/START-HERE.md`, `ops/roadmap/NEXT.md` | El camino de entrada de toda sesión nueva |
| `.agents/skills/new-task/SKILL.md`, `.agents/skills/ui-change/SKILL.md` | Todo agente que crea una feature o una pantalla |

---

## TEST ROJO

Primero el contrato, después el documento:

- `src/shared/contracts/agent-system-contract.test.ts` — «la arquitectura de producto es una sola fuente y
  el camino de entrada la cita» y «la arquitectura de producto enlaza la autoridad del repo en vez de
  duplicarla».
- `src/shared/contracts/docs-sync-contract.test.ts` — el documento entra en el camino de entrada, así que
  sus referencias se validan.

**Rojo esperado y observado** (por la razón correcta: la fuente todavía no existe, no por un test mal escrito):
`falta ops/product/MODULE_ARCHITECTURE.md: sin la fuente canónica cada agente decide de nuevo dónde vive
cada capacidad: expected false to be true` y, en el contrato de documentación,
`ops/product/MODULE_ARCHITECTURE.md: no existe`. 3 tests en rojo, 13 en verde.

## ESTRATEGIA

Escribir el contrato que exige la fuente, crear la fuente, y recién después enlazarla desde los puntos de
entrada. El documento se escribe **desde el código verificado**; donde el código y la dirección conceptual
difieren, se registra la divergencia con su ruta exacta en vez de "corregir" el producto.

## DDD

N/A — no cambia ninguna capa. La TASK **describe** las capas existentes (`domain` · `features` · `ports` ·
`adapters` · `route`) y cuál es la dueña de cada regla; no mueve una línea de código.

## TRANSACCIÓN

N/A — no hay operaciones de escritura de producto.

## CONCURRENCIA

N/A — no hay estado compartido nuevo.

## IDEMPOTENCIA

N/A.

## AUTORIZACIÓN

N/A en código. El documento **fija** la regla vigente: una entidad se muestra donde haga falta, pero su
puerta de autorización es server-side (las 24 de `src/modules/auth/domain/admin-permissions.ts`) y no se
duplica por pantalla. Las puertas sin call site detectadas quedan en la deuda documentada.

## MIGRACIÓN

N/A — sin cambios de esquema.

## OBSERVABILIDAD

N/A — sin nuevas operaciones. La TASK **registra** observabilidad existente (asientos de `audit`,
historial de estados, movimientos de caja) solo para ubicar su dueño.

---

## TESTS UNITARIOS

Los dos contratos del § *TEST ROJO*, verdes al cerrar: 17 tests entre los dos archivos (13 + 4).

## TESTS DE INTEGRACIÓN

N/A — no toca PostgreSQL ni flujos.

## E2E

N/A — no toca flujos de usuario.

## MUTATION CHECK

Sobre el enforcement, que es lo único ejecutable:

1. quitar la cita de `AGENTS.md` → el contrato de la fuente canónica tiene que fallar;
2. quitar la referencia de `src/shared/contracts/docs-sync-contract.test.ts` a este documento y romper un
   link interno suyo → el contrato de documentación tiene que fallar;
3. escribir la declaración de autoridad de la arquitectura de producto en **otro** documento normativo
   (`ops/roadmap/DECISIONS.md`) → el contrato de **autoridad única** tiene que delatarlo, para que no
   aparezca una segunda constitución en silencio.

Las tres mutaciones se restauran y **no** se commitean. Rojo observado en las tres, por la razón correcta y
con el mensaje esperado.

## VALIDACIÓN

```bash
npm run security:secrets && npm run lint && npm run typecheck && npm run test && npm run test:contracts && npm run build
```

Sin `build:webpack` (no se tocó ninguna página) y sin E2E (no se tocó ningún flujo). **Sin deploy.**

## CRITERIOS DE ACEPTACIÓN

- [x] `ops/product/MODULE_ARCHITECTURE.md` existe, es la única fuente de arquitectura de producto y fija las
      cinco definiciones, la regla fundamental, el ownership, la regla de Resumen, navegación, roles, datos
      dinámicos y el gate de capacidades nuevas.
- [x] El documento parte del **código verificado**, y las divergencias con la dirección conceptual del
      roadmap (Resumen/POS en la navegación) quedan registradas, no corregidas.
- [x] La deuda encontrada queda escrita con su evidencia, sin repararla.
- [x] `AGENTS.md`, `ops/CURRENT.md`, `ops/tasks/START-HERE.md` y las skills `new-task` y `ui-change` la citan
      **enlazando**, sin duplicar su contenido.
- [x] Los techos de los documentos **no** suben (`AGENTS.md` 300, `ops/CURRENT.md` ≤ 250).
- [x] Los contratos que lo custodian fallan si se rompe alguna de esas propiedades (mutation check).
- [x] Cero cambios funcionales: ni producto, ni rutas, ni navegación, ni diseño, ni DB.

## REGRESIÓN

Si alguien borra la fuente, deja de citarla desde `AGENTS.md`/`START-HERE.md`/`CURRENT.md` o deja de
referenciarla desde las skills, el test de la fuente canónica falla. Si el documento crece más allá de su
techo, falla el mismo test.

## ROLLBACK

Revert del commit: es documental y de contratos; no hay estado que deshacer y ninguna migración que
revertir.

## DOCUMENTACIÓN

Este brief, `ops/product/MODULE_ARCHITECTURE.md`, `ops/CURRENT.md`, `ops/roadmap/NEXT.md`,
`ops/tasks/START-HERE.md` y la fila correspondiente del mapa del sistema en `AGENTS.md`.

## MEMORY

N/A — específico de esta TASK. La lección general (el enforcement automático custodia **propiedades
objetivas**, no criterio) queda escrita en el propio documento §11.

## DEFINITION OF DONE

Ver [`../../AGENTS.md`](../../AGENTS.md) § *Definition of Done*. Excepciones documentadas: no hay UI que
verificar en navegador, ni capturas antes/después, ni E2E, porque la TASK no toca pantallas ni flujos.
