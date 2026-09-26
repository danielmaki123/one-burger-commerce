# PATTERNS.md — arquetipos y composición

**Qué es**: los cinco arquetipos de pantalla del producto y cómo se compone cada uno. Un arquetipo no es una
plantilla rígida: es el conjunto de decisiones visuales que ya están resueltas para ese tipo de tarea.

**Cómo se usa**: la spec de una pantalla (ver [`screens/TEMPLATE.md`](screens/TEMPLATE.md)) declara **su
arquetipo** antes de diseñar. Si una pantalla no encaja en ninguno, el problema es de arquitectura de
producto, no de diseño.

Los arquetipos **no deciden contenido**: qué información muestra una pantalla lo decide su spec con el owner.

---

## 1. Dashboard / Overview

**Responde rápido**: qué está pasando, qué cambió, qué requiere atención. En el primer viewport, y sin
párrafos explicativos.

- **Prioriza**: KPI, comparación (contra el período anterior), tendencia, ranking, alerta accionable.
- **Densidad**: alta y ordenada; el número grande es el protagonista.
- **Composición**: cabecera corta con título + período → tira de KPI → tendencia → señales accionables.
- **Reglas duras**:
  - **No administra entidades** (no crea, no edita, no borra).
  - **No duplica el sidebar**: no repite la lista de secciones; dice **por qué** ir a una sección.
  - **No absorbe dominios**: muestra señales; el detalle y la resolución viven en la sección dueña
    (`../product/MODULE_ARCHITECTURE.md` §6).
  - Cada señal accionable dice **cuánto** y **adónde** (*2 pedidos atrasados → Ver Órdenes*).
- **Tipografía**: `text-kpi`/`text-st-display` para el dato, `text-label`/`text-st-overline` para su
  etiqueta, `text-caption` para el período. Nada más.
- **Charts**: solo si responden una pregunta mejor que dos números
  ([`DATA_VISUALIZATION.md`](DATA_VISUALIZATION.md)).

**Ejemplo real de la ley** (no es una orden de implementación):

```text
Resumen:  2 pedidos atrasados        →  Ver Órdenes
Resumen:  1 cierre con diferencia    →  Revisar cierre
```

---

## 2. Operational

**Se usa con el reloj corriendo y las manos ocupadas**: POS, KDS (comandas), Caja (turno, arqueo).

- **Prioriza**: estado, tiempo, dinero, acción. El orden en pantalla es el orden de la tarea.
- **Densidad**: la más alta del producto. Sin decoración, sin textos largos, sin pasos innecesarios.
- **Composición**: barra de estado (turno/local/tiempo) → área de trabajo → acción principal fija y
  alcanzable. Cabecera y filtros **≤ 20 %** del alto.
- **Reglas duras**:
  - **Controles táctiles ≥ 44 px** en las acciones de trabajo y en el móvil.
  - **Intención, no color**: la acción y la identidad de la pantalla usan `brand-primary`/`brand-accent`; qué
  color tiene cada una es **tema** (hoy el acento es ámbar y el primario azul), no ley (§
  [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) §3.2).
  - `animate-pulse` **solo** en SLA vencido o desincronización.
  - Los números (plata, cronómetro, ticket, vuelto) en `font-mono` + `tabular-nums`.
  - La acción principal no se esconde en un menú; lo destructivo (devolver, anular) sí pide confirmación.
  - **Nada de scroll horizontal**; el tablero de comandas usa el ancho completo.
- **Estados**: cada elemento operativo tiene su estado visual (pendiente, en preparación, listo, vencido) y
  **nunca** se distingue solo por color.

---

## 3. Management

**Administra entidades que existen y crecen**: Usuarios, Productos, Locales, Alertas, Promociones.

- **Prioriza**: toolbar (búsqueda + filtros + acción primaria) → lista/tabla → estado → acción por fila.
- **Densidad**: media. Una fila por entidad, con aire entre filas y sin cards anidadas.
- **Composición**:

```text
Título                                [ acción primaria ]
[búsqueda]  [filtros]
────────────────────────────────────────────────────────
fila · identidad · estado · metadato · acciones
fila · identidad · estado · metadato · acciones
```

- **Reglas duras**:
  - La **acción primaria es una**: crear.
  - El detalle de una entidad es **ruta propia** (`/[id]`), no un acordeón infinito.
  - **Formularios largos en sheet/drawer**, no siempre abiertos empujando la lista.
  - Las filas son **datos**, no componentes hardcodeados: una entidad nueva aparece sin tocar JSX.
  - Listas largas: paginación o scroll acotado con el encabezado fijo; nunca dos scrolls anidados.
  - Vacío, cargando y error tienen su estado explícito ([`CONTENT.md`](CONTENT.md) §7).

---

## 4. Configuration

**Cambia cómo funciona el sistema**: Personalización, Config de Caja, Alertas, reglas del local.

- **Prioriza**: grupo → label → control → estado. Y **ayuda contextual** cuando una decisión no es evidente.
- **Densidad**: puede respirar más que Operational, pero sigue aplicando **progressive disclosure**: lo
  avanzado va detrás de una interacción, no todo abierto.
- **Composición**: secciones con título corto, controles agrupados por la **tarea del usuario** (no por la
  tabla de la base de datos), guardado explícito y visible, y confirmación del resultado.
- **Reglas duras**:
  - **No se construye el formulario siguiendo el esquema de la base**: se agrupa por tarea.
  - Cada control dice qué cambia y, si es irreversible o afecta plata, lo advierte en una línea.
  - Un cambio que afecta a toda la operación (arqueo, marca, horarios) se muestra con su **alcance**.
  - Los valores configurables **no se hardcodean** en componentes: la pantalla los administra, el producto
    los consume por datos.
  - Estado "guardado / sin guardar" siempre visible cuando el guardado no es inmediato.

---

## 5. Detail

**Muestra una entidad concreta y permite actuar sobre ella**: pedido, cierre de caja, factura, local.

- **Prioriza**: identidad (qué es) → estado → información principal → acciones → historial relevante.
- **Densidad**: media-alta; el detalle es donde sí se puede profundizar, sin convertirse en un informe.
- **Composición**: encabezado con identidad y estado + acciones → bloques de información en orden de
  importancia → historial/timeline al final, plegable si es largo.
- **Reglas duras**:
  - **No tiene entrada de navegación propia**: se llega desde su lista o desde una señal
    (`../product/MODULE_ARCHITECTURE.md` §7).
  - La vuelta al listado es obvia y conserva los filtros.
  - Las acciones destructivas viven acá (con confirmación), no en la fila de la lista cuando el efecto es
    grande.
  - El historial se lee, no se edita.
  - Si el detalle necesita más de tres niveles de jerarquía, se revisa la arquitectura antes de agregar
    pantallas.

---

## 6. Composición: reglas transversales

- **Una sola superficie por nivel**: si dos bloques compiten por el mismo peso visual, uno sobra.
- **Un solo encabezado de página** (`AdminPageHeader` en el panel): título, contexto y la acción primaria a
  la derecha.
- **Cards**: solo cuando agrupan semánticamente; si no, filas y separadores
  ([`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) §8).
- **Densidad**: la tarea define la densidad; el arquetipo define el punto de partida.
- **El modo** lo define la superficie (panel oscuro / público claro), no el arquetipo.

---

## 7. Qué NO decide este documento

- **Qué muestra** cada pantalla, qué preguntas responde y qué datos son reales: eso es su spec.
- **Qué métricas existen**: [`DATA_VISUALIZATION.md`](DATA_VISUALIZATION.md) §7 y el backend.
- **Dónde pertenece la pantalla** y si merece navegación:
  [`../product/MODULE_ARCHITECTURE.md`](../product/MODULE_ARCHITECTURE.md).
