# SKILL: delivery-e2e — la entrega por defecto de una TASK

**Se activa** al abrir cualquier TASK: es la que decide **hasta dónde llega** esa TASK sin volver a pedir
permiso. Es la **fuente de la política de entrega** del repo: el flujo, los tres modos, las condiciones de
parada y la política de backups se escriben acá y se enlazan desde `AGENTS.md`, `new-task`,
`production-release` y la plantilla.

> **La decisión del owner (2026-09-26)**: una TASK **aprobada** autoriza su ejecución completa hasta el
> estado operativo final —implementación, tests, PR, CI, merge, deploy, QA en producción y estado— **sin
> pedir permisos intermedios**. Preguntar «¿mergeo?», «¿procedo?», «¿deployo?» o «¿borro la rama?» con los
> gates verdes no es prudencia: es trabajo perdido.

---

## 1. El flujo por defecto

```
discovery/spec (si aplica) → implementación → TDD/tests → QA → PR → CI verde → squash merge
→ main verde → deploy → health/readiness → smokes → QA en producción
→ CURRENT/roadmap → reporte final → STOP
```

El tramo final (**deploy → … → reporte**) **solo** existe en los modos que llegan a producción. Si aparece
una **Stop Condition** (§3) en cualquier punto, se para ahí y se reporta la condición: eso es una parada
real, no una duda.

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
