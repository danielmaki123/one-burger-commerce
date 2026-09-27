# SKILL: delivery-e2e — la entrega por defecto de una TASK

**Se activa** al abrir cualquier TASK: es la que decide **hasta dónde llega** esa TASK sin volver a pedir
permiso. Es la **fuente de la política de entrega** del repo y la **fuente del flujo obligatorio**: el flujo,
los tres modos, las condiciones de parada y la política de backups se escriben acá y se enlazan desde
`AGENTS.md`, `new-task`, `production-release`, el roadmap maestro y la plantilla.

> **La decisión del owner (2026-09-26)**: una TASK **aprobada** autoriza su ejecución completa hasta el
> estado operativo final (§1) **sin pedir permisos intermedios**. Preguntar «¿mergeo?», «¿procedo?»,
> «¿deployo?» o «¿borro la rama?» con los gates verdes no es prudencia: es trabajo perdido.

---

## 1. El flujo obligatorio (de punta a punta)

Es **la** secuencia de trabajo del repo: **auditoría real → reuse audit → ownership/arquitectura → SPEC →
reference.html → aprobación/design freeze → implementación → tests/QA → PR/CI → merge → deploy cuando
corresponda → QA de producción → auditoría independiente (spec/reference vs runtime) → CURRENT/roadmap →
STOP**.

1. **Auditoría real del repo** antes de creerle al brief: qué código, contratos y documentos ya resuelven
   parte del pedido. El brief se corrige con lo que se encontró, no al revés.
2. **Reuse audit** ([`../new-task/SKILL.md`](../new-task/SKILL.md) §2 y
   [`../../ops/product/MODULE_ARCHITECTURE.md`](../../ops/product/MODULE_ARCHITECTURE.md) §10.1–§10.3): qué
   existe, qué se reutiliza y qué es realmente nuevo. **Es un gate**: sin ese bloque no se implementa.
3. **Ownership y arquitectura**: qué módulo es dueño de las reglas y si la capacidad merece navegación
   (gate estructural §10.4). Sin dueño claro, no hay TASK.
4. **SPEC** en `ops/design/screens/<pantalla>.md` (skill [`screen-design`](../screen-design/SKILL.md)) cuando
   el trabajo toca una pantalla nueva o un rediseño material.
5. **`reference.html`**, si el owner dejó referencia: vive al lado de la spec y es **contrato** de
   composición y comportamiento (*Reference Fidelity*).
6. **Aprobación del owner y Design Freeze**: aprobadas spec y referencia, composición, IA y comportamiento
   principal quedan **congelados**. Una desviación material modifica primero la spec y la decide el owner.
7. **Implementación**: TDD, sin Prisma en un route handler, sin duplicar una regla de dominio.
8. **Tests y QA**: rojo observado, mutación y la verificación en navegador real (los cuatro viewports del
   **Viewport Contract** cuando la superficie es operativa).
9. **PR + CI verde**: PR hacia `main` con problema, alcance, evidencia y lo que quedó fuera.
10. **Merge** con `--squash`, solo con el CI verde.
11. **Deploy** cuando el Delivery Mode lo incluye (§2), desde `main` y con los guardrails de
    [`production-release`](../production-release/SKILL.md).
12. **QA de producción**: health, readiness y los dos smokes; y la pantalla, en producción y con sesión.
13. **Auditoría independiente** que compara **implementación real vs SPEC/reference**: el deploy **no
    equivale a aceptación**; la aceptación es esa comparación, con evidencia.
14. **`CURRENT.md` y roadmap**: qué quedó desplegado, qué se cerró y qué sigue.
15. **STOP**: no se abre la siguiente TASK sin cerrar esta.

**Una sola TASK de runtime activa por vez.** El tramo final (**deploy → … → STOP**) solo existe en los modos
que llegan a producción. Si aparece una **Stop Condition** (§3) en cualquier punto, se para ahí y se reporta
la condición: eso es una parada real, no una duda.

---

## 2. Los tres modos

| Modo | Cuándo | Hasta dónde llega |
|---|---|---|
| **`docs-only`** | Documentación, ADR, roadmap, contratos sin runtime, backlog, plantillas | PR → CI verde → squash merge → `main` verde → estado. **Sin deploy** |
| **`runtime-e2e`** (default) | Cualquier cambio de producto, UI, navegación, frontend o backend sin riesgo persistente | Todo el flujo: además **deploy**, health/readiness, smokes, QA en producción y estado |
| **`high-risk-e2e`** | Dinero, auth/datos sensibles, esquema/migración, reparación de datos | Igual que `runtime-e2e`, **con los gates especiales** de la skill de su clase (`money-change`, `security-change`, `database-migration`) |

**Cómo se elige** (no se le pregunta al owner cuando es inferible): ¿el cambio toca runtime? → `runtime-e2e`;
¿toca dinero, auth, datos o esquema? → `high-risk-e2e`; ¿es solo documentación o contratos sin runtime? →
`docs-only`.

El modo se declara al arrancar (`new-task` § Decision gate) y se escribe en la TASK y en el cuerpo del PR.
`high-risk-e2e` **no** significa «preguntar por defecto»: significa aplicar los gates de su clase y, si
ninguno exige una aprobación humana, seguir hasta el final.

---

## 3. Stop Conditions (la única lista de cuándo parar)

1. Decisión de **producto** no definida que cambie comportamiento visible.
2. Operación **destructiva** en producción.
3. **Migración destructiva**.
4. **Backfill**, reparación o transformación de datos **no aprobada**.
5. Riesgo de **pérdida o reinterpretación** de datos.
6. **Secreto o permiso externo** inexistente.
7. **Costo externo** no aprobado.
8. **P0/P1 nuevo** causado directamente por la TASK.
9. Operación **irreversible** no contemplada.
10. GitHub o Easypanel **bloquean técnicamente** la ejecución.

Todo lo demás —nombres, formato, ubicación de documentos, orden de commits, borrar la rama, mergear con CI
verde, desplegar una TASK de runtime— **se resuelve y se sigue**.

---

## 4. Backups: por riesgo del release, no por frecuencia

- **No requiere backup manual**: documentación, CSS, UI, navegación, frontend, backend sin cambio persistente
  riesgoso y refactor sin cambio de datos.
- **Sí requiere backup/preflight especial**: migración destructiva, backfill, reparación o transformación de
  datos, cambio persistente de dinero cuyo rollback dependa de un snapshot, u operación que el runbook
  clasifique como riesgosa.
- **Migración aditiva segura**: puede correrse E2E sin detenerse, si la skill
  [`database-migration`](../database-migration/SKILL.md) y el runbook
  [`ops/production-readiness.md`](../../../ops/production-readiness.md) la clasifican como segura.
- **`A-57`** (el backup programado no genera archivos) sigue abierto como problema del **scheduler
  automático**: no obliga a un backup manual en releases que no lo necesitan.

---

## 5. Lo que **no** cambia (la autorización no afloja el procedimiento)

Sigue intacto, y `production-release` lo repite: deploy **solo desde `main`** y **después del CI verde**;
**una sola** llamada a `deployService`; health y readiness; los dos smokes de solo lectura; confirmación del
`commit.sha`; prohibición de `db:seed` y `migrate reset` en producción; prohibición de tocar servicios ajenos;
y el rollback del runbook.

---

## 6. Prohibiciones

- Pedir una **segunda autorización** para merge o deploy cuando el Delivery Mode ya la incluye y los gates
  están verdes (salvo Stop Condition).
- Declarar `docs-only` un cambio que toca runtime para evitar el deploy.
- Saltar el CI, el merge por PR o los smokes «porque es un cambio chico».
- Escribir esta política de nuevo en otro documento: se enlaza.
- Tocar datos de producción desde una TASK que no lo pidió.
