# SKILL: database-migration — tocar el esquema o los datos

**Se activa** cuando una TASK cambia `prisma/schema.prisma`, agrega o edita una migración, agrega un
índice o una constraint, backfillea datos, o cambia cómo se leen/escriben datos existentes.

**Regla general** (está en [`../../../AGENTS.md`](../../../AGENTS.md)): las migraciones son
versionadas, **aditivas primero** y **sin BOM**.

---

## 1. Procedimiento

### 1.1 Antes de escribir el esquema

1. **Leer el modelo real**, no el recuerdo: `prisma/schema.prisma` y lo que ya existe en
   `prisma/migrations/`.
2. **Escribir la ruta de upgrade**: cómo pasa una base **con datos** de hoy al estado nuevo. Si no se
   puede escribir en tres líneas, la migración es demasiado grande: se parte.
3. **Declarar la compatibilidad**: ¿el código **anterior** puede seguir corriendo contra el esquema
   nuevo? (es lo que permite desplegar sin ventana de caída).
4. **Declarar la concurrencia**: ¿hay tráfico escribiendo mientras migra? Una migración que agrega
   `NOT NULL` sobre una tabla viva necesita su plan (ver §1.3).

### 1.2 Aditivo primero (expand / contract)

El orden que evita romper producción:

1. **Expandir**: agregar la columna/tabla/índice **nullable** o con default. El código viejo sigue
   andando.
2. **Backfill**: llenar los datos existentes, en lotes si la tabla es grande.
3. **Contraer**: recién entonces poner `NOT NULL`, borrar la columna vieja o agregar la constraint
   fuerte.

Nunca en un solo paso: `DROP COLUMN` + `ADD COLUMN NOT NULL` sobre la misma tabla en la misma
migración deja al código viejo sin poder servir.

### 1.3 Nullable → backfill → `NOT NULL`

Cuando la migración backfillea y **después** pone `NOT NULL`:

- El `NOT NULL` va en una migración **posterior** al backfill, no en la misma.
- **Se despliega fuera del horario comercial**: existe una ventana entre el `NOT NULL` y el cambio de
  tráfico donde un insert del código viejo puede fallar.
- Si la tabla es grande, el backfill va por lotes; un `UPDATE` de toda la tabla deja la primera carga
  bloqueada.

### 1.4 Índices y constraints

- Un índice nuevo en una tabla viva se crea **de forma concurrente** cuando el volumen lo justifica.
- La integridad se garantiza con **constraints en la base** (unique, foreign key, check), no solo con
  un `if` en el código: la base es la única que puede ganarle a una race condition.
- Una unique constraint que el código necesita (idempotencia, numeración de facturas, un turno abierto
  por terminal) es la prueba de que la propiedad es real.

### 1.5 Migraciones sin BOM

Un **BOM UTF-8** al inicio del archivo SQL rompe `prisma migrate deploy` en **cualquier base nueva**
(P3018) — y no se nota en la base donde ya se aplicó. Las migraciones se guardan **sin BOM** y hay un
test que lo verifica: no editar el archivo con una herramienta que lo agregue.

---

## 2. Verificación obligatoria

### 2.1 Base vacía + drift (espejo del CI)

```bash
npx prisma migrate deploy
npx prisma migrate diff --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma --exit-code
```

El primero aplica **todas** las migraciones en orden sobre una base limpia. El segundo falla si hay
**drift** entre lo aplicado y el esquema declarado. Estos dos comandos son exactamente los pasos del
job **`migrations`** del CI (`postgres:17`): si pasan local, pasan ahí.

### 2.2 Pruebas sobre PostgreSQL real cuando corresponda

Si el riesgo es **unique constraint · race condition · transaction · rollback · lock · partial write**,
un doble en memoria **no** demuestra la propiedad. Ver `../money-change/SKILL.md` §2 para el estado
real del arnés y qué se acepta como evidencia.

### 2.3 Código

```bash
npx prisma generate     # el build no lo regenera; con `next start` levantado está bloqueado
npm run typecheck
npm run test
npm run test:contracts
```

Si tocaste una página, además `npm run build:webpack`.

---

## 3. `migrate deploy` en producción

- El contenedor aplica `prisma migrate deploy` **al arrancar, antes de servir tráfico**, con reintentos
  (`MIGRATION_MAX_ATTEMPTS`, `MIGRATION_RETRY_DELAY_MS`).
- Con `MIGRATIONS_AUTO=false` el arranque **no** migra: el paso se corre explícito y recién entonces se
  habilita el tráfico. Es el modo para una migración que necesita control fino.
- Si el arranque falla, Easypanel **no** promueve la versión y sigue sirviendo la anterior.

## 4. Rollback operativo

- **No hay down-migrations.** Toda migración aplicada se resuelve con **fix-forward** apoyado en el
  backup previo.
- Antes de un deploy con migraciones: backup y anotar su identificador (ver
  [`../../../ops/production-readiness.md`](../../../ops/production-readiness.md) §3).
- Una migración destructiva necesita en el mismo PR la **reversión lógica** escrita (script SQL o
  migración nueva).

---

## 5. Prohibiciones

- **`prisma migrate reset` contra producción.** Nunca. Borra los datos.
- **`npm run db:seed` contra producción.** Crea credenciales demo (`admin@example.com` /
  `Admin1234!`).
- Migración destructiva sin backup previo ni reversión lógica escrita.
- `DROP COLUMN` o renombrar una columna en el mismo paso en que el código deja de usarla.
- Editar una migración **ya aplicada** (en vez de agregar una nueva): el drift lo detecta el CI y en
  producción ya no existe.
- Backfill masivo en horario comercial sin plan.
- Commitear un archivo de migración con BOM.
- Tocar datos de producción desde una TASK que no lo pidió explícitamente.

---

## 6. Cierre

- [ ] Ruta de upgrade escrita y compatibilidad declarada.
- [ ] Aditivo primero; `NOT NULL` separado del backfill.
- [ ] Índices/constraints pensados para concurrencia.
- [ ] Migración sin BOM.
- [ ] `migrate deploy` + `migrate diff --exit-code` en verde sobre base vacía.
- [ ] `prisma generate`, typecheck, tests y contratos en verde.
- [ ] Rollback operativo (fix-forward + backup) documentado.
- [ ] Si toca datos existentes: plan de backfill y ventana declarados.
