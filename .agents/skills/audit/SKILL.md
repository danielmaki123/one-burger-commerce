# SKILL: audit — auditar sin arreglar

**Se activa** cuando el pedido es revisar, medir, verificar o buscar problemas: «auditá X», «mirá si
esto está bien», «encontrá los huecos de Y».

> **Una auditoría es READ-ONLY por defecto.**
> Se puede leer, ejecutar comandos de solo lectura, medir y correr tests. **No** se toca código de
> producto, ni la base, ni configuración, salvo que la TASK lo pida explícitamente.

---

## 1. Reglas del ciclo

1. **No se mezcla auditoría y remediación en el mismo PR.** Auditar es producir hallazgos; corregir es
   otra TASK (ver [`../bugfix/SKILL.md`](../bugfix/SKILL.md)).
2. **Evidencia, no impresiones.** Cada hallazgo lleva `archivo:línea`, el comando o el test que lo
   muestra, y **qué se midió**. Si algo se afirma sin verificarlo, se marca como **sospecha**.
3. **Reproducir antes de proponer el arreglo.** Lo que no se reproduce se cierra como *no-repro* con el
   intento escrito. No se parchea a ciegas.
4. **Un hallazgo no es una decisión de producto.** Si el arreglo correcto depende de qué quiere el
   negocio, se marca `decisión` y se le pregunta al owner: **no se implementa sin respuesta**.
5. **Registrar en** [`../../../ops/audit-backlog.md`](../../../ops/audit-backlog.md) con el formato del
   archivo (ID siguiente libre, tipo, severidad, estado, detalle).
6. **Si encontrás un bug que no es el objeto de la auditoría: documentalo, no lo corrijas.**

## 2. Anatomía de un hallazgo

Separar siempre estas seis cosas. Mezclarlas es lo que convierte una auditoría en una opinión.

| Campo | Qué es | Ejemplo |
|---|---|---|
| **Evidencia** | Lo que se observó, reproducible | `src/modules/orders/adapters/prisma-payment-repository.ts:92` filtra por local y ventana sin mirar el estado del pedido |
| **Observación** | Qué significa, en una frase | Un cobro de un pedido cancelado sigue contando en el arqueo |
| **Riesgo** | Qué se rompe si no se toca | El cierre marca faltante sin forma de registrarlo |
| **Severidad** | `P1` (plata o datos), `P2` (función o fuga), `P3` (deuda, UI, docs) | `P1` |
| **Recomendación** | Qué habría que hacer, sin implementarlo | Excluir pedidos cancelados o registrar una compensación |
| **Posible TASK** | El título de la TASK que lo cerraría, con su clase de riesgo | «Cobros de pedidos cancelados» — riesgo *dinero* |

**Clasificación** del tipo: `bug` (está roto) · `dato` (mal cargado) · `infra` · `deuda` · `decisión`
(producto: no se implementa sin respuesta) · `documentación` (el doc miente).

## 3. Método

1. **Delimitar el objeto**: qué se audita y qué queda afuera.
2. **Leer el código, no la prosa.** Si un documento y el código se contradicen, **gana el código**; la
   contradicción es un hallazgo de tipo `documentación`.
3. **Medir**: correr el comando, el test o la consulta. Un número sin comando no es evidencia.
4. **Buscar el caso negativo**: no solo el camino feliz. ¿Qué pasa con el rol equivocado, con dos
   requests a la vez, con el turno cerrado, con el dato vacío?
5. **Ordenar** por severidad y dependencia, no en un listado suelto.
6. **Registrar** y **detenerse**.

Zonas que históricamente rinden: autorización que vive solo en la UI, cálculos duplicados, reglas con
dos fuentes, escrituras sin transacción, `try/catch` que se tragan errores, documentos que afirman algo
que el código no hace.

## 4. Resultado

- Hallazgos **en el backlog**, con ID, tipo, severidad y evidencia.
- Lo que **no** se pudo reproducir, dicho como *no-repro* con el intento.
- Lo que requiere **decisión del owner**, marcado y sin implementar.
- Lo que se confirmó **sano**, también dicho: saber qué ya está bien evita re-auditarlo.

## 5. Prohibiciones

- Corregir mientras se audita (salvo pedido explícito en la TASK).
- Reportar un hallazgo sin evidencia reproducible.
- Inventar severidad sin impacto real.
- Presentar una decisión de producto como un bug.
- Tocar producción, la base o secretos.
- Mezclar el PR de auditoría con el de la corrección.
