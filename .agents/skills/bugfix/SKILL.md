# SKILL: bugfix — corregir una anomalía

**Se activa** cuando algo está roto: un bug, una regresión, un hallazgo de auditoría o un
comportamiento que contradice una invariante.

**Regla general que manda** (está en [`../../../AGENTS.md`](../../../AGENTS.md)): *todo bug debe
demostrar la regresión antes de corregirse.*

**Regla fundamental**: un test de regresión tiene que **ponerse rojo si se reintroduce el bug**. Un
test que pasa con el bug y sin el bug no es un test: es decoración.

---

## 1. Procedimiento obligatorio

1. **Reproducir el bug.** Antes de explicarlo. Si no se reproduce, no se arregla: se cierra como
   *no-repro* con el intento escrito (ver [`../audit/SKILL.md`](../audit/SKILL.md) §4).
2. **Identificar la causa raíz.** No la causa aparente: *por qué* el código permite esto. Si la
   explicación es «faltaba un `if`», todavía no hay causa raíz.
3. **Declarar la invariante** que se violó, en una frase: «un cobro de un pedido cancelado no puede
   contar en el arqueo».
4. **Escribir el regression test** que captura esa invariante.
5. **Ejecutarlo ANTES del fix.**
6. **Observar RED por la razón correcta** — no por un import roto, un fixture mal armado ni un typo.
   El mensaje de fallo tiene que hablar de la invariante.
7. **Implementar el cambio mínimo** que la pone en verde. Nada de refactor oportunista.
8. **Observar GREEN.**
9. **Refactorizar solo dentro del scope** de la TASK.
10. **Mutation check**: reintroducir temporalmente la condición defectuosa (o una mutación
    equivalente) y verificar que el test **falla**. Después restaurar. **La mutación no se commitea.**
11. **Correr los tests del bounded context** completo (no solo el archivo nuevo).
12. **Correr los contratos**: `npm run test:contracts`.
13. **Correr integración/E2E** si el bug toca un flujo de usuario.
14. **Actualizar la documentación necesaria** (el backlog si el hallazgo se cierra, y `MEMORY.md` si
    la lección es reutilizable).
15. **Registrar aprendizaje** solo si de verdad es reutilizable — si es de esta tarea, va al PR.

Comando para el ciclo corto (el archivo del test, no la suite entera):

```bash
npx vitest run <ruta-del-test>
```

---

## 2. Si el rojo no se pudo observar

Casos legítimos: test y código escritos en el mismo paso, contexto agotado, caracterización de código
heredado. En ese caso se documenta **en el commit**:

- el **motivo** por el que no se observó el rojo,
- **cómo se validó** el test (mutación: verde → rojo → verde),
- **qué flujo** cubre.

Escribirlo después **sin documentarlo** está prohibido. Si se validó invirtiendo el código, eso
**cuenta como TDD efectivo** y se documenta igual.

---

## 3. Si un test existente falla por mi cambio

**No se cambia automáticamente.** Primero se determina cuál de las dos cosas pasó:

| Caso | Qué significa | Qué se hace |
|---|---|---|
| **A** | La implementación introdujo una **regresión** | Se arregla el código |
| **B** | El test es **obsoleto** porque el contrato cambió **a propósito** | El cambio del test se justifica con la TASK o con una decisión explícita del owner |

Prohibido: *test rojo → cambiar el expected → verde* sin demostrar que cambió el contrato.

---

## 4. Prohibiciones específicas

- Escribir el test **después** y afirmar que hubo TDD.
- Ocultar que no se observó RED.
- Bajar expectativas, borrar el test que molesta o relajar una aserción para conseguir verde.
- Arreglar el síntoma (un `try/catch` que se traga el error) sin la causa raíz.
- Dejar la mutación en el árbol de trabajo o en un commit.
- Arreglar «de paso» otra cosa que la TASK no pidió: **eso es otra TASK**.
- Corregir el bug y la auditoría que lo encontró en el mismo PR (ver `../audit/SKILL.md`).

---

## 5. Cierre

- [ ] Bug reproducido y causa raíz escrita (no la aparente).
- [ ] Invariante declarada en una frase.
- [ ] Test rojo escrito y **observado rojo por la razón correcta** antes del fix.
- [ ] Fix mínimo; mutación verificada y restaurada.
- [ ] Tests del bounded context + contratos en verde.
- [ ] E2E si el bug toca un flujo de usuario.
- [ ] Backlog/`CURRENT.md` actualizados si el hallazgo se cierra.
- [ ] `MEMORY.md` actualizado **solo** si la lección es reutilizable.
- [ ] Validación completa de [`../../../AGENTS.md`](../../../AGENTS.md) § *Validación*.
