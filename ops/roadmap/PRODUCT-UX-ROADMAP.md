# One Burger — roadmap maestro de producto y UX

**Qué es**: la **fuente del roadmap maestro de producto y UX** del repo — el **único** roadmap maestro. La
secuencia del trabajo de producto, las leyes que lo gobiernan y el punto donde está hoy viven acá; el
**programa de remediación técnica** (hallazgos `A-*`, con objetivo, prioridad y riesgo) sigue en
[`../tasks/AUDIT-REMEDIATION-ROADMAP.md`](../tasks/AUDIT-REMEDIATION-ROADMAP.md).

**Qué NO es**: no es el estado operativo (eso es [`../CURRENT.md`](../CURRENT.md)), no es la arquitectura de
producto (eso es [`../product/MODULE_ARCHITECTURE.md`](../product/MODULE_ARCHITECTURE.md)) y no es la ley
visual (eso es [`../design/DESIGN_SYSTEM.md`](../design/DESIGN_SYSTEM.md)). **No hay un segundo roadmap**: lo
que no esté en el orden de §2 no está planificado, y si aparece la necesidad se discute con el owner y se
anota acá **antes** de empezar.

**Última actualización**: 2026-09-28, por **`TASK-MONEY-PAYMENTS-FOUNDATIONS-001`** (fundaciones de Money /
Payments: auditoría real, ownership, contratos, snapshot, idempotencia, boundaries y Design Freeze de
Finanzas). Antes: 2026-09-27, por **`TASK-ORDERS-KITCHEN-FOUNDATIONS-001`** (fundaciones de Pedidos / Cocina).

---

## 1. Principio central

```text
AUDITORÍA REAL DEL REPO
        ↓
REUSE AUDIT (¿ya existe?)
        ↓
OWNERSHIP / ARQUITECTURA (¿de quién es la regla?)
        ↓
SPEC (+ reference.html si el owner dejó referencia)
        ↓
APROBACIÓN / DESIGN FREEZE
        ↓
IMPLEMENTACIÓN → TESTS/QA → PR/CI → MERGE → DEPLOY → QA DE PRODUCCIÓN
        ↓
AUDITORÍA INDEPENDIENTE (spec/reference vs runtime)
        ↓
CURRENT / roadmap → STOP
```

No se vuelve a:

```text
programar una pantalla ↓ descubrir que estaba mal ubicada ↓ rediseñarla ↓ reprogramarla
```

**Una sola TASK de runtime activa por vez**, y **deploy no equivale a aceptación**: el release se acepta
cuando la implementación se compara contra la spec y la referencia **después** del merge. El flujo completo,
sus gates y las condiciones de parada **se escriben una sola vez** en [`delivery-e2e`](../../.agents/skills/delivery-e2e/SKILL.md) y no se repiten acá.

---

## 2. Orden autoritativo

Cada paso se abre como **una TASK**, con su brief en `ops/tasks/` y su Delivery Mode declarado. Lo que está
«cerrado» se deja escrito para que nadie lo reabra por accidente.

```text
0.  Gobierno y reglas ................ TASK-GOV-001 · docs-only · CERRADA
1.  POS Fase 1 (venta rápida) ........ CERRADA (SCREEN-POS-QUICK-SALE-001.2, desplegada)
2.  Consolidación arquitectónica ..... TASK-GOV-001 · docs-only · CERRADA (arquitectura objetivo + orden)
3.  Separar Pedidos / Cocina ......... CERRADA (TASK-ORDERS-KITCHEN-FOUNDATIONS-001 · docs-only)
3b. Cocina runtime ................... CERRADA Y DESPLEGADA (/admin/kitchen como proyección de orders)
4.  Money ownership .................. CERRADA Y DESPLEGADA (módulo `money` + /admin/finance)
5.  Payments ownership ............... CERRADA Y DESPLEGADA (módulo `payments` + estado financiero canónico)
5b. Pedidos runtime .................. /admin/orders denso y paginado + detalle con su historia y su cobro · SIGUIENTE
6.  Pedido existente → Cobrar en POS . Órdenes localiza el pedido y el POS lo cobra (cierra `A-67`)
7.  Cash ownership ................... Shift, apertura, movimientos, conteo, cierre, handover y conciliación
8.  Separar Configuración: Negocio / Finanzas / Personalización / Locales ... cada una con su entrada
9.  Separar Cierres / Facturas ....... dos capacidades distintas, dos documentos, dos dueños
10. Promotions ownership ............. elegibilidad, scope, límites, redemption y BOGO fuera de `orders`
11. Consolidar /activity + /orders + /orders/track ... una sola historia del pedido para el cliente
12. Clasificar y sanear FROZEN/LEGACY  inventario, reservas, delivery zones, mesas, coupons, table-ordering
13. Check únicamente si aparece necesidad real ... no se crea por anticipación; solo con una necesidad real
14. Table Service/Mesas .............. reabrir el servicio de mesa, con decisión del owner
15. Refinamiento restante de Catálogo  lo que no entró en las secciones anteriores
16. Resumen, cuando las fuentes estén maduras ... `/admin`, al final, cuando las fuentes estén maduras
```

**Los órdenes 4 y 5 se cerraron en dos pasadas**: el **runtime** (`TASK-MONEY-PAYMENTS-RUNTIME-001`) y su
**cierre de aceptación** (`TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002`), porque los criterios 3, 9 y 12 del
primero no se cumplían en el runtime que quedó desplegado. El detalle de cada orden **pendiente** —estado real
auditado, dependencias, qué reutilizar, qué deuda entra y qué queda fuera— está en el
[mapa de ejecución](EXECUTION-MAP.md); el catálogo de dueños y de lo que se reutiliza, en el
[mapa de reutilización de capacidades](../product/CAPABILITY-REUSE-MAP.md).

**Dependencias que no se saltean** (verificadas contra el código en `TASK-ORDERS-KITCHEN-FOUNDATIONS-001` y
revalidadas en `TASK-MONEY-PAYMENTS-FOUNDATIONS-001`):

- **3b antes de 5b, y 3b no depende de 4, 5 ni 6**: la cocina **no toca dinero** —su proyección no incluye un
  solo campo financiero— así que puede ir primero; lo que sí trae es la puerta que impide que el dinero llegue
  a cocina. **3b está cerrado y desplegado.**
- **4 y 5 son una sola entrega de runtime, no dos**: la auditoría de la fundación mostró que `payments` no
  puede cerrar la comparación sin convertir (`A-68`) sin la tasa que sólo `money` define, y `money` no tiene
  hecho histórico que congelar sin `payments`. Van juntos, en una TASK, con dueño, contratos y snapshot ya
  definidos; la SPEC de la superficie, en [`../design/screens/finance.md`](../design/screens/finance.md) con
  su [referencia aprobada](../design/screens/finance-reference.html). **Los dos están cerrados y desplegados**,
  en dos pasadas: el runtime y su cierre de aceptación.
- **4 y 5 antes de 5b**: el listado y el detalle muestran si el pedido está cobrado, y esa regla no se calcula
  en React. **El estado financiero canónico ya existe** (`payments`, `getOrderPaymentStatus`) y es lo que 5b
  tiene que **consumir**, no recalcular.
- **4 y 5 antes de 6** (no se cobra un pedido existente sin dueño del dinero) y **5b antes de 6**: alguien
  tiene que **localizar** el pedido antes de que el POS lo cobre, y hoy no hay superficie (`A-67`).
- **16 al final**, porque un overview solo es honesto cuando las fuentes que resume ya están ordenadas.

**Por qué hay un `3b` y un `5b`**: la auditoría de fundaciones mostró que «Separar Pedidos / Cocina» son **dos**
entregas de runtime con dependencias **distintas** (Cocina no necesita al dueño del dinero; Pedidos sí, porque
muestra el estado de cobro). Se **intercalan sin renumerar el resto** para no romper las referencias cruzadas
de `CURRENT.md`, `START-HERE.md` y `MODULE_ARCHITECTURE.md` a los órdenes 4 a 16: los ítems autoritativos
siguen siendo los mismos 17.

**Lo que este roadmap retira**: la secuencia anterior mandaba a `Resumen` o a una «POS Fase 2» genérica
inmediatamente después del POS. `Resumen` pasa al orden 16 y «POS Fase 2» **deja de existir como fase**: su
contenido se reparte entre los órdenes 4 a 7 y 10 (dinero, cobros, turno, promociones). La Fase 1 del POS
quedó cerrada y **no se reabre**.

---

## 3. Design Freeze

Una vez **aprobadas** la SPEC de una pantalla y su `reference.html`:

- la **composición**, la **information architecture** y el **comportamiento principal** quedan **congelados**
  para la implementación;
- la referencia aprobada es **contrato** (ley 5, *Reference Fidelity*): se traduce a los componentes reales,
  no se copia el HTML y no se reinterpreta;
- una desviación **material** **no** se resuelve en el código: primero se modifica la spec y la decide el
  owner. Si el desvío aparece durante la implementación, es una **Stop Condition**, no una decisión del
  agente;
- la comparación **implementación real vs SPEC/reference** es parte del cierre de una TASK material de UI, y
  la **auditoría independiente** posterior al deploy la repite sobre el runtime.

Aplica a toda pantalla con `ops/design/screens/<pantalla>.md` aprobada (`orders`, `pos-quick-sale`, y las que
vengan).

---

## 4. Leyes que el roadmap aplica (no las reescribe)

Las **leyes del repo** —Reuse First, Reuse Audit, One Canonical Flow, Single Owner, Reference Fidelity,
Viewport Contract, la ley del **dueño único de la configuración con snapshot en los hechos históricos** y
Design Freeze— se enuncian **una sola vez** en [`AGENTS.md`](../../AGENTS.md) § *Leyes del repo*, con el
nombre que un agente cita. Acá solo se dice cómo las usa el roadmap:

- **Reuse Audit** es el **gate obligatorio** de cada TASK antes de implementar (plantilla:
  [`../tasks/TEMPLATE.md`](../tasks/TEMPLATE.md)).
- **One Canonical Flow** es la razón de los órdenes 3b, 5b, 6 y 11: una operación, una superficie que la
  resuelve —**localizar** en Pedidos, **cocinar** en Cocina, **cobrar** en POS—.
- **Single Owner** es la razón de los órdenes 4, 5, 7, 8, 9 y 10: separar dueños que hoy comparten módulo.
- **Viewport Contract** y **Design Freeze** son las condiciones de cierre de cualquier TASK de UI.
- La ley de **configuración y snapshots** es la razón de los órdenes 4, 5, 7 y 9: lo que se firma **congela**
  los valores que lo explican (medios de cobro, desglose del turno, factura, tipo de cambio).

---

## 5. Reglas de proceso del roadmap

1. **Una TASK de runtime activa por vez.** Se cierra entera (implementación, tests, validación, PR, CI verde,
   merge, deploy y QA) antes de abrir la siguiente.
2. **El orden manda sobre la comodidad.** Si una TASK necesita algo de un orden posterior, se para y se
   decide: o se adelanta la dependencia con su brief, o la TASK se acota.
3. **Nada de migración masiva**: cada sección y cada módulo se mueven de a uno, con su TASK, su spec y su QA.
   La arquitectura objetivo de `MODULE_ARCHITECTURE.md` §4.1 es dirección, **no** un big-bang.
4. **Una sección se resuelve una sola vez**: no se implementa primero y se rediseña después.
5. **Lo que no está en este orden no está planificado.** Aparece una necesidad real → se evalúa (orden 13) y,
   si entra, se anota acá antes de empezar.
6. **El estado se escribe donde corresponde**: el día a día en [`../CURRENT.md`](../CURRENT.md), la secuencia
   inmediata en [`NEXT.md`](NEXT.md), las decisiones ya cerradas en [`DECISIONS.md`](DECISIONS.md) y lo que
   pasó, en [`../history/`](../history/).

---

## 6. Anti-patrones

- Crear una pantalla y después decidir dónde pertenece.
- Duplicar una regla de dominio en un dashboard o en una segunda superficie.
- Hardcodear sucursales, productos o precios como estructura de la UI.
- Inventar un KPI o un gráfico que el backend no puede defender.
- Reabrir una fase cerrada (la Fase 1 del POS) o una pantalla congelada sin spec nueva.
- Mantener dos roadmaps, dos arquitecturas objetivo o la misma ley escrita dos veces.
- Reservar rutas vacías o crear módulos por anticipación.
- Declarar `docs-only` una TASK que toca runtime.
