# SKILL: production-release — desplegar a producción

**Se activa** cuando una TASK va a llevar código a producción, o cuando hay que verificar o revertir un
despliegue.

> **Solo se despliega desde `main` y después del CI verde.** La aprobación de una TASK de entrega
> (`runtime-e2e` o `high-risk-e2e`) —o el pedido explícito del owner— **autoriza** su merge y su release:
> **no se solicita una segunda autorización** salvo que se active una **Stop Condition**
> ([`delivery-e2e`](../delivery-e2e/SKILL.md) §3). Nunca desde una rama de trabajo.

Este archivo resume el procedimiento y sus porqués. La **secuencia exacta de comandos, los límites
conocidos y las recetas operativas viven en**
[`../../../ops/production-readiness.md`](../../../ops/production-readiness.md): si hay conflicto, manda
el runbook.

---

## 1. Antes de desplegar

- [ ] El PR está **mergeado a `main`** y el CI está verde (los cuatro checks: `verify`, `contracts`,
      `migrations`, `container`).
- [ ] `git checkout main && git pull --ff-only origin main` y anotar el **commit que se va a
      desplegar** (el `sha` de código, no `HEAD` si el último push fue de documentación).
- [ ] `npm run security:secrets` en verde.
- [ ] El **Delivery Mode** de la TASK incluye deploy (`runtime-e2e` o `high-risk-e2e`) y no hay ninguna
      **Stop Condition** activa ([`delivery-e2e`](../delivery-e2e/SKILL.md)).
- [ ] Si el release **sí** lo necesita —migración destructiva, backfill, reparación o transformación de
      datos, o cambio persistente de dinero cuyo rollback dependa de un snapshot—: **backup identificado** y
      la reversión lógica escrita. Un release de UI, CSS, navegación, frontend, docs o refactor **no**
      requiere backup manual.
- [ ] No hay otra release en curso (una sola cosa a la vez).

## 2. Migraciones

- El contenedor aplica `prisma migrate deploy` **al arrancar y antes de servir tráfico**, con
  reintentos. Es el procedimiento vigente.
- Con `MIGRATIONS_AUTO=false` el paso se corre explícito y recién entonces se habilita el tráfico: es
  el modo para una migración que necesita control fino.
- Una migración que backfillea y después pone `NOT NULL` va **fuera del horario comercial**.
- Detalle y verificación en [`../database-migration/SKILL.md`](../database-migration/SKILL.md).
- Si el arranque falla, Easypanel **no** promueve la versión: sigue sirviendo la anterior.

## 3. Desplegar

- **Una sola llamada** a `deployService` (proyecto `brunobot`, servicio `oneburguerweb`,
  `forceRebuild: true`) con `EASYPANEL_TOKEN` **por entorno**.
- ⚠️ **No** usar `npm run deploy:easypanel`: fusiona variables de entorno y puede crear servicios.
- La llamada **puede cortar por timeout sin haber fallado**: el build sigue en segundo plano.

## 4. Verificar (health, readiness y smokes)

```bash
# 1. Qué commit quedó configurado + que el build nuevo ya sirve
curl -sS .../inspectService | grep -o '"sha":"[^"]*"'
curl -sS https://<host>/api/health        # versión build-AAAAMMDD-HHMMSS

# 2. Readiness: SELECT 1 contra la base (503 si la base no responde)
curl -sS https://<host>/api/readiness

# 3. Smokes de solo lectura
BASE_URL="https://<host>" npm run test:e2e:prod          # health, readiness, rutas, login, locales, menú por local, retiro
BASE_URL="https://<host>" npm run test:e2e:prod:hosts     # landing, redirecciones y host del panel
```

- **`/api/health`**: responde con la versión del build.
- **`/api/readiness`**: verifica la base; **503** si no responde.
- Los dos smokes son de **solo lectura** y se corren **después** del deploy.
- Comparar `commit.sha` contra **el commit que se quiso desplegar**, no contra `HEAD`.
- ⚠️ **Nunca imprimir la respuesta completa de `inspectService`**: devuelve los secretos del servicio
  en claro (`DATABASE_URL`, `NEXTAUTH_SECRET`, el token). Usar un `grep` acotado.

## 5. Rollback

- **Aplicación**: revertir el commit en `main` y volver a disparar `deployService`. El servicio
  construye siempre desde `main`, no está apuntado a una imagen fija.
- **Artefacto inmutable**: el workflow publica `ghcr.io/<owner>/one-burger-commerce:<sha>`; apuntar el
  servicio a esa imagen permite volver a una versión exacta sin reconstruir.
- **Base de datos**: **no hay down-migrations**. Se resuelve con *fix-forward* apoyado en el backup
  previo.
- **Backup/restore**: el respaldo diario está configurado y **el drill de restore está hecho y
  verificado**; un backup sin restore probado no es un backup. El drill se repite
  (ver [`../../../ops/production-readiness.md`](../../../ops/production-readiness.md) §3 y §8.1).

## 6. Después

- Registrar qué quedó desplegado (build, commit, PR) en
  [`../../../ops/CURRENT.md`](../../../ops/CURRENT.md).
- Si la release cierra un hallazgo, actualizar
  [`../../../ops/audit-backlog.md`](../../../ops/audit-backlog.md).
- Si dejó una lección reutilizable, [`../../MEMORY.md`](../../MEMORY.md).
- Reportar al humano: rama, commit de `main`, estado de los smokes y qué queda pendiente.

---

## 7. Prohibiciones

- Desplegar una **rama de trabajo**, sin CI verde o sin un Delivery Mode que incluya deploy.
- Exigir una **segunda autorización** con los gates verdes: la aprobación de la TASK ya autoriza el release
  (salvo Stop Condition).
- Pedir un **backup manual** para un release que no lo necesita por riesgo: ver
  [`delivery-e2e`](../delivery-e2e/SKILL.md) §4.
- Usar `npm run deploy:easypanel` (fusiona variables, puede crear servicios).
- Correr `db:seed` o `migrate reset` contra producción.
- Imprimir configuración sensible o volcar la respuesta de `inspectService`.
- **Modificar otros servicios del servidor** (`cacommerce`, `capostgres`, `imagehost`, `postimage`,
  proyecto `n8n`).
- Dejar `BOOTSTRAP_ADMIN_*` o secretos temporales en el entorno del servicio.
- Declarar el deploy exitoso sin `commit.sha`, versión de `/api/health`, readiness y los dos smokes.
- Tocar datos de producción desde una TASK que no lo pidió.
