# TEMPLATE de spec de pantalla

> **Cómo se usa**: se copia a `ops/design/screens/<pantalla>.md` **antes** de escribir UI. Es el contrato de
> arranque de la skill [`screen-design`](../../../.agents/skills/screen-design/SKILL.md) y lo aprueba el
> owner. Una spec **no** crea leyes de diseño: aplica [`DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) y
> [`PATTERNS.md`](../PATTERNS.md).
>
> **Sin spec no se implementa** una pantalla nueva ni un rediseño material. Un bugfix visual chico **no**
> necesita spec (va por [`ui-change`](../../../.agents/skills/ui-change/SKILL.md)).

---

## Ruta

`/admin/...` o `/...` (la ruta real, no una inventada). Si es una ruta de detalle, decirlo.

## Módulo

Módulo dueño de la capacidad y por qué (`../../product/MODULE_ARCHITECTURE.md` §4–§5). Si la pantalla
consume varios módulos, cuáles y para qué.

## Usuario / roles

Quién la usa, con qué rol y con qué alcance (local/sucursal). Qué **no** ve cada rol y por qué.

## Propósito

Una frase: qué tarea resuelve y cuándo se entra a esta pantalla. Si hacen falta dos párrafos, la pantalla
está mal planteada.

## Preguntas

Las preguntas que la pantalla responde, en orden de importancia (2–4). Son la base de la jerarquía.

## Decisiones

Qué decide el usuario acá y qué pasa después de decidir. Qué **no** se decide en esta pantalla.

## Datos disponibles

Solo lo que el backend **ya** tiene, con su fuente (tabla, caso de uso, campo). Lo que falta se marca
**FALTA** —no se inventa ni se mockea— y el copy no miente.

## Jerarquía

Qué es lo primero, lo segundo y lo que se puede perder. Cómo se logra (tamaño, peso, espacio, posición) y
qué se elimina para que esa jerarquía se lea.

## Acciones

Acción primaria (una sola), secundarias, destructivas y de navegación. Con su label exacto
([`CONTENT.md`](../CONTENT.md) §5).

## Estados

Cargando · vacío · con datos · error · sin permiso · parcial (si aplica). Qué dice y qué se puede hacer en
cada uno.

## Empty / error / loading

El texto y la acción de cada uno. Sin ilustraciones decorativas y sin párrafos.

## Desktop

Composición a 1280: qué ocupa el ancho, qué columnas, qué queda fijo.

## Tablet

Composición a 768: qué cambia respecto de desktop y por qué.

## Mobile

Composición a 375: qué se conserva, qué se pliega, qué se va. Sin scroll horizontal.

## Qué se elimina

Lo que la pantalla actual muestra y deja de mostrar. Se escribe explícitamente: es la parte que evita el
rediseño a medias. Si algo se mantiene por deuda, se dice.

## Fuera de scope

Lo que esta spec **no** toca (otras pantallas, otras secciones, tokens globales, backend). Si aparece deuda,
se documenta, no se arregla de paso.

---

## Checklist antes de aprobar la spec

- [ ] La pantalla pertenece a un módulo existente (o se justificó la excepción).
- [ ] Se declara su **arquetipo** y la composición sigue ese arquetipo.
- [ ] Cada dato que se muestra existe hoy en el backend (o está marcado **FALTA**).
- [ ] Ninguna métrica nueva sin fórmula, período, comparación y fuente.
- [ ] Todos los estados están definidos, incluidos error y sin permiso.
- [ ] Los tres anchos (375/768/1280) están resueltos sin scroll horizontal.
- [ ] En el **primer viewport de 375 px** se ven el estado crítico, la acción principal y lo mínimo para
      iniciar la tarea (el resto puede scrollear).
- [ ] Está escrito qué se elimina.
- [ ] Lo visual aplica [`DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md): tokens, tipografía numérica, densidad.
- [ ] El texto aplica [`CONTENT.md`](../CONTENT.md): presupuesto por arquetipo y sin explicaciones de relleno.
- [ ] Los componentes que necesita **ya existen** en el registro (o se propone el alta en el mismo commit).
