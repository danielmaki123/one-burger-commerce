# SKILL: screen-design — diseñar una pantalla antes de implementarla

**Se activa** cuando el trabajo es: una **pantalla nueva**, un **rediseño material**, un **cambio sustancial
de information architecture** o un **dashboard nuevo**.

**No se activa** para: un bugfix visual chico, un ajuste de copy, un padding roto, un token mal usado. Eso va
por [`ui-change`](../ui-change/SKILL.md), sin spec y sin ceremonia.

**Produce**: una **spec aprobada** en `ops/design/screens/<pantalla>.md`. **No** produce código. La
implementación viene después, con [`ui-change`](../ui-change/SKILL.md).

> Regla que esta skill existe para proteger: **no se implementa primero y se diseña después**.

---

## 1. Procedimiento (en este orden)

1. **Módulo.** ¿A qué módulo pertenece la capacidad y quién es dueño de sus reglas?
   [`../../../ops/product/MODULE_ARCHITECTURE.md`](../../../ops/product/MODULE_ARCHITECTURE.md) §4–§5. Si la
   respuesta pide un módulo o una sección nueva, **parar**: eso es una decisión del owner, no un paso del
   diseño.
2. **Usuario.** Qué rol la usa, con qué alcance (local/sucursal) y en qué momento del día. Si son varios
   roles, qué ve cada uno.
3. **Propósito.** Una frase: qué tarea resuelve. Si hacen falta dos párrafos, la pantalla está mal planteada.
4. **Preguntas y decisiones.** Qué preguntas responde (2–4, en orden) y qué decide el usuario acá. Lo que no
   se decide, se declara fuera.
5. **Datos reales.** Solo lo que el backend **ya** tiene, con su fuente. Lo que falta se marca **FALTA** y el
   copy no miente ([`../../../ops/design/DATA_VISUALIZATION.md`](../../../ops/design/DATA_VISUALIZATION.md) §7).
6. **Arquetipo.** Dashboard/Overview · Operational · Management · Configuration · Detail
   ([`../../../ops/design/PATTERNS.md`](../../../ops/design/PATTERNS.md)). Si no encaja en ninguno, el problema
   es de arquitectura.
7. **Information architecture.** Qué es principal, qué es secundario, qué es detalle y qué se elimina.
8. **Representación.** Qué se muestra como número, tabla, lista, gráfico o estado; y qué **no** se muestra.
   Aplica [`DATA_VISUALIZATION.md`](../../../ops/design/DATA_VISUALIZATION.md) y
   [`CONTENT.md`](../../../ops/design/CONTENT.md).
9. **Wireframe / spec.** Se completa
   [`../../../ops/design/screens/TEMPLATE.md`](../../../ops/design/screens/TEMPLATE.md) entero, con los tres
   anchos (375/768/1280), todos los estados y lo que se elimina.
10. **Aprobación del owner.** Sin aprobación **no hay implementación**. La spec es el contrato: si algo
    cambia después, se cambia la spec primero.
11. **Implementación.** Recién acá: [`ui-change`](../ui-change/SKILL.md), con la spec como fuente del alcance.

---

## 2. Leyes que la spec aplica (y no reescribe)

- [`../../../ops/design/DESIGN_SYSTEM.md`](../../../ops/design/DESIGN_SYSTEM.md) — tokens, tipografía,
  densidad, superficies, botones, estados, responsive y accesibilidad. **No se inventan tokens en una spec.**
- [`../../../ops/design/CONTENT.md`](../../../ops/design/CONTENT.md) — presupuesto de texto por arquetipo y
  cómo se escribe cada control.
- [`../../../ops/design/PATTERNS.md`](../../../ops/design/PATTERNS.md) — composición del arquetipo elegido.
- [`../../../ops/design/DATA_VISUALIZATION.md`](../../../ops/design/DATA_VISUALIZATION.md) — qué patrón
  responde qué pregunta y qué métrica es defendible.
- [`../../../ops/design/MOTION.md`](../../../ops/design/MOTION.md) — cuándo se mueve algo y qué pasa con
  `prefers-reduced-motion`.
- [`../../../ops/product/MODULE_ARCHITECTURE.md`](../../../ops/product/MODULE_ARCHITECTURE.md) — quién es
  dueño de las reglas y si la pantalla merece navegación.

**Si una necesidad parece universal** (un patrón nuevo, un token nuevo), la pregunta es *¿esto aplica a todo
el producto?*: si sí, se propone un cambio al Design System **como TASK aparte**; si no, se resuelve local en
la spec. Una pantalla no cambia la ley.

---

## 3. Checklist de la spec

- [ ] El módulo dueño está identificado (o la excepción está justificada y aprobada).
- [ ] El arquetipo está declarado.
- [ ] Cada dato mostrado existe hoy en el backend, o está marcado **FALTA**.
- [ ] Ninguna métrica sin fórmula, período, comparación y fuente.
- [ ] Todos los estados definidos: cargando, vacío, con datos, error, sin permiso.
- [ ] 375 / 768 / 1280 resueltos, sin scroll horizontal.
- [ ] Está escrito **qué se elimina**.
- [ ] Los componentes necesarios **ya existen** en el registro (o se propone su alta).
- [ ] El texto cumple el presupuesto del arquetipo.
- [ ] La spec **no** contradice el Design System ni la arquitectura de producto.
- [ ] El owner la aprobó **antes** de que exista código.

---

## 4. Cuándo parar y preguntar

- La pantalla necesita un módulo, una sección o una entrada de navegación nueva.
- Hace falta un dato que el backend **no** tiene (y mostrarlo exigiría inventarlo o mentir en el copy).
- La spec pide una métrica que no se puede defender con datos reales.
- El rediseño cambia el comportamiento visible de dinero, permisos o datos.
- Cambiar la pantalla implicaría cambiar el Design System.

Todo lo demás (orden, densidad, textos, componentes existentes) se resuelve en la spec y se sigue.
