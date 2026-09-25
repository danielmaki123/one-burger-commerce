# MEMORY.md — conocimiento estable aprendido

**Qué es este archivo**: lo que ya nos costó tiempo una vez y **no conviene volver a redescubrir**.
Cada línea es una lección **verificada** (por un test, por una medición o por producción), no una
opinión y no un plan.

**Qué NO va acá**:

- **No es un changelog** ni un diario: no lleva fechas por bloque ni «qué se hizo esta semana».
- **No es el backlog**: las anomalías **abiertas** viven en
  [`../ops/audit-backlog.md`](../ops/audit-backlog.md) y en [`../ops/CURRENT.md`](../ops/CURRENT.md).
  Una anomalía sin corregir **no** se escribe acá como si fuera una decisión resuelta.
- **No es estado**: lo desplegado hoy está en `../ops/CURRENT.md`.

Criterio para agregar algo: *¿es estable, reutilizable y verificable?* Si es de una tarea puntual,
va al historial o al PR. Si cambia semana a semana, va a `CURRENT.md`.

---

## Decisiones cerradas

- **Una sola fuente por cálculo de dinero**: los totales salen de `src/shared/lib/order-totals.ts`
  (`calculateOrderTotal` / `calculateOrderTotals`). Prohibido sumar `subtotal + packaging + tip` a
  mano; un contrato lo impide.
- **Una sola fuente para el estado del pedido**: `src/modules/orders/domain/order-workflows.ts`.
- **Una sola fuente para la regla de modificadores**: `src/modules/menu/domain/modifier-selection.ts`
  (`validateModifierSelections`, `isModifierSelectionRequired`, `canQuickAddProduct`). La consumen la
  carta, el POS y el alta del pedido: **no crear otra**.
- **Un producto sin fila en `LocationProduct` SÍ se vende**, al precio del negocio. Es decisión del
  owner; se corrigió el comentario del esquema, no el código.
- **El arqueo ciego es una regla de servidor, no un sello de pantalla**: al rol `cashier` el servidor
  no le manda el esperado ni la diferencia (el filtro vive en la respuesta de la ruta, no en el caso
  de uso, porque el aviso al dueño y el traspaso se firman con el arqueo completo).
- **La zona horaria del negocio sale de `BusinessSettings.timezone`**; `America/Managua` y `-06:00`
  están prohibidos como literales (los detecta el contrato anti-hardcode).
- **La aceptación de pedidos tiene una sola puerta**: `order-acceptance.ts`. Un control que nadie lee
  es una mentira: `isAcceptingOrders` existía en el esquema y en la UI, pero **ningún** caso de uso lo
  consultaba.
- **Los datos del negocio no se hardcodean** (nombre, colores, contacto, horarios, precios, propina,
  zona horaria): se leen de la configuración editable en el admin.
- **Los módulos fuera del MVP** (inventario, reservas, mesas, delivery, reportes avanzados) no se
  reactivan en navegación ni en APIs públicas sin pedido explícito del owner.
- **El landing no se reescribe**: se midió que solo ~4 KB de su JS es la página y ~129 KB es el
  runtime del App Router. Decisión del owner.
- **Reabrir un turno se quitó de la UI**, no del modelo: el esquema, el caso de uso y la API siguen.
  Restaurarlo es una decisión de pantalla.
- **El design system oficial es `ops/references/stitch/design-system.md`** y el panel es **oscuro**.
  Los documentos viejos (`DESIGN_REFERENCES.md`, `DESIGN_SYSTEM.md`, `design/*.md`) están borrados: no
  se citan ni se recrean.
- **La venta del mostrador es una sola operación atómica**: el pedido (con su cupón y el consumo de su uso)
  y **todos** sus cobros, en una transacción; si falla cualquiera, no queda nada. El límite lo **declara** el
  caso de uso por un puerto (`runInSaleTransaction`) y lo implementa el adaptador con `prisma.$transaction`.
  Los efectos **posteriores** a la persistencia —el aviso `OrderCreated` al outbox— se publican **después del
  commit** y por eso la dependencia del alta es inyectable (`publishOrderCreated`).
- **El cierre de turno es un documento: se firma completo o no se firma**: el snapshot del `Shift` (esperado,
  desglose, diferencia, diferencia de banco), los `ShiftCashCount` de cierre y los `ShiftBankClose` van en
  **una** transacción, con la fila del turno **bloqueada** antes de leer los cobros. Cerrar dos veces no pisa
  el arqueo del primero (`WHERE status = 'open'`), y por eso un cierre a medias no se puede reparar después.

## Errores ya comprendidos

- **Un BOM en una migración Prisma rompe `migrate deploy`** en cualquier base nueva (P3018). Hay un
  test que lo verifica.
- **La imagen podía construir y no arrancar**: la etapa runner no copiaba `scripts/` ni `src/`. Por eso
  el CI construye la imagen, la levanta contra Postgres, exige readiness y prueba el bootstrap del
  admin.
- **`exit 141` (SIGPIPE) en CI**: `docker logs … | grep -q` cierra el pipe antes de tiempo bajo
  `pipefail`. La salida se escribe a un archivo **primero**; hay un contrato que vigila el patrón.
- **Borrar un token CSS no es gratis**: la regla base de Tailwind compila `outline-ring/50` a
  `var(--ring)`, así que quitar `--ring` rompe el foco **en runtime sin fallar el build**.
- **Tailwind emite `.rounded-full` antes que `.rounded-md`**: un `rounded-full` pasado por `className`
  puede renderizar cuadrado. El radio va **dentro del primitivo**; el E2E mide el radio computado.
- **Un `.test.tsx` hermano de un `.test.ts` con el mismo nombre base** queda fuera del programa de
  `tsc` y rompe `lint`.
- **`getByLabel` de Playwright es por subcadena; `getByLabelText` de testing-library es exacto**:
  `getByLabel("Código")` también matchea el select de «Estado».
- **Un `asyncUtilTimeout` igual al `testTimeout` mata el test justo cuando la espera resuelve.** Las
  esperas van holgadas y **por debajo** del presupuesto del test.
- **Hay un arnés de PostgreSQL real para Vitest** (`TASK-AUD-004`): los archivos `*.postgres.test.ts` corren
  con `npm run test:postgres` (`vitest.postgres.config.ts`, `src/shared/testing/postgres.ts`), **no** entran
  en `npm test` (el job `verify` no tiene base) y los corre el job **`migrations`** del CI, que ya levanta
  PostgreSQL 17 y aplica las migraciones. Es lo que se usa para **atomicidad, rollback, índice único,
  transacciones y carreras**: un repositorio en memoria no puede fallar como falla la base. Si falta
  `DATABASE_URL` el arnés falla fuerte en vez de saltearse. Para inyectar una falla **adentro** de la
  transacción se envuelve el repositorio del alcance con un `Proxy` que delega al real y rompe en la
  N-ésima llamada.
- **`lineTotal` no debe incluir el packaging**: el «+» rápido lo contaba dos veces y el total mostrado
  superaba el cobrado. Fue un bug de plata real.
- **Un correlativo (o cualquier «último + 1») es un recurso que se ASIGNA, no un dato que se lee**: leer el
  último e insertar después deja la carrera en manos del índice único, que evita el duplicado pero **le falla
  al usuario** (el cajero ve un error y el documento no sale). La forma que funciona es **una** operación con
  reintento acotado —releyendo el último número— y, si el conflicto es de la clave de negocio (el `orderId`),
  devolver lo que ya existe (`TASK-AUD-006`, `src/modules/invoices/adapters/prisma-invoice-repository.ts`).
- **Una invariante se cierra sobre TODOS los que escriben el campo, no sobre el camino que estabas mirando**:
  `Payment.shiftId` lo escriben la venta del mostrador **y** el cobro de un pedido que ya existe
  (`POST /api/admin/orders/[id]/payment`). Cerrar el lock en uno solo dejaba el otro camino firmando un turno
  cerrado. Antes de declarar una invariante, `grep` de **todos** los `create`/`update` del campo
  (`TASK-AUD-005`, review adversarial).
- **Dos operaciones que escriben sobre el mismo agregado se guardan con un lock de fila, no con un `if`**: el
  cierre de turno lee los cobros que va a firmar y el cobro le firma el turno a un `Payment`. Sin
  `SELECT … FOR UPDATE` sobre la fila del `Shift`, la ventana entre «leer» y «escribir» deja plata fuera del
  arqueo (o un cobro firmado por un turno cerrado). El orden que funciona es **bloquear primero, leer
  después**: el que llega segundo **espera** a que el primero commitee y recién ahí ve el estado de verdad
  (`TASK-AUD-005`, `src/modules/orders/adapters/prisma-shift-repository.ts`).
- **`inspectService` de Easypanel devuelve los secretos del servicio en claro** (`DATABASE_URL`,
  `NEXTAUTH_SECRET`, el token): se usa un `grep` acotado, **nunca** se vuelca la respuesta entera.
  En la misma clase: `services/postgres/destroyService` **no** valida el nombre del servicio.
- **La marca que invalida un registro se excluye en la CONSULTA, no en cada consumidor, y las dos puntas
  de la invariante se rechazan entre sí**: cuando un registro puede quedar anulado (un `Payment` mal
  cargado), la regla «no cuenta» vive **una sola vez** por adaptador —el filtro `voidedAt: null` en cada
  consulta de lista y en el agregado— en vez de repetirse en los diez consumidores (arqueo, saldo del
  pedido, conciliación, documentos). Y la operación que mueve plata sobre ese registro tiene que
  **rechazarlo en los dos sentidos**: no se anula un cobro con devolución viva (pendiente o aprobada) y no
  se aprueba la devolución de un cobro anulado; cada lado por separado deja la puerta abierta a descontar
  la misma plata dos veces. La guarda de la carrera va en el `WHERE` (`voidedAt: null` en el `updateMany`),
  no en el `if` de la lectura: dos anulaciones simultáneas firman **una sola** y la otra es un 409
  (`TASK-AUD-059`, `src/modules/orders/features/void-payment/void-payment.ts`).
- **Los `sr-only` no se pueden automatizar**: para un radio nativo testeable se usa un overlay con
  `opacity-0`.
- **Un `P2002` adentro de un `$transaction` de Prisma aborta la transacción entera** (`25P02 current
  transaction is aborted, commands ignored until end of transaction block`): a diferencia de la conexión
  suelta, la recuperación «chocó con el índice único → re-leo la fila que ya existe» **no puede correr
  adentro**. Se devuelve el conflicto original y quien abrió la transacción la **rehace** (en el intento
  nuevo la lectura encuentra la fila antes de escribir). Un `catch` que se traga el error de la re-lectura
  esconde el `25P02` y el síntoma pasa a ser un 500 sin significado (`TASK-AUD-004`,
  `src/modules/orders/adapters/prisma-order-repository.ts`).

## Restricciones permanentes

- **`main` no recibe push directo por política del repo**: se trabaja en rama, se abre PR y se mergea con
  `--squash` **después** del CI verde. Política y enforcement **coinciden** desde TASK-AUD-002: el ruleset
  `Protect main` exige Pull Request (`required_approving_review_count: 0`, así que el owner completa el flujo
  sin una segunda cuenta) además de borrado, force push y los cuatro checks. Se verifica con
  `gh api repos/<owner>/<repo>/rulesets`: `/branches/main/protection` devuelve **404** con ruleset.
- **`publish` jamás va como *required check***: no corre en PRs y el PR quedaría en «Expected» para
  siempre.
- **No hacer `db:seed` ni `migrate reset` contra producción.** El `seed` crea credenciales demo.
- **No tocar servicios ajenos del panel compartido** (`cacommerce`, `capostgres`, `imagehost`,
  `postimage`, proyecto `n8n`).
- **No dejar `BOOTSTRAP_ADMIN_*` ni secretos temporales** en el entorno del servicio.
- **Los secretos van solo por entorno**, nunca en el repo, un commit o un chat.
- **Las migraciones son versionadas, aditivas primero y sin BOM**; en producción no hay
  down-migrations: se resuelve con *fix-forward* apoyado en el backup.
- **Los route handlers no tienen lógica**: máximo **50 líneas**, sin importar `getPrismaClient()` ni
  `@prisma/client`.
- **Tamaño**: máximo **400 líneas por archivo** y **80 por función**.
- **La autorización vive en el servidor.** Ocultar algo en React no es autorización, y una UI nunca es
  por sí sola una frontera de autorización.
- **Los techos de deuda solo bajan.** Ver *Ratcheting de calidad* en `../AGENTS.md`.

## Lecciones de testing

- **TDD exige observar el rojo por la razón correcta** (no por un import roto). Si el rojo no se pudo
  observar, se documenta en el commit el motivo, cómo se validó el test y qué flujo cubre.
- **Un test de regresión tiene que ponerse rojo si se reintroduce el bug.** Si se escribió después de
  la implementación, se verifica por **mutación** (reintroducir la condición defectuosa, ver el rojo,
  restaurar) y se deja dicho en el commit. La mutación **no** se commitea.
- **Coverage no es correctness.** Se prefieren invariantes, ramas críticas, escenarios negativos,
  integración, mutación, concurrencia, autorización y persistencia antes que un porcentaje.
- **Los dobles implementan el puerto completo**; lo de infraestructura se cubre con contratos que leen
  archivos o con el job que construye la imagen; los flujos de usuario van en `tests/e2e/`.
- **Un guardrail mecánico solo puede vigilar propiedades objetivas**: `expect(X).toBe(X)` con la misma
  expresión, un `.only` o una fila nueva en una allowlist se detectan por AST; si el `expected` es el valor
  de negocio correcto, si el mock es permisivo o si el test se escribió después **no** se detectan sin
  adivinar intenciones. Conviene decirlo **en el propio gate**, para que nadie le pida lo que no puede dar
  (`src/shared/contracts/test-integrity-contract.test.ts`).
- **Una allowlist de deuda solo vale si su crecimiento duele**: los contratos del repo detectaban filas
  *muertas* pero no filas *nuevas*, así que agregar una excepción era apagar un guardrail en silencio. El
  ratchet compara las claves contra la rama base y contra un inventario congelado.
- **Un gate que se saltea en silencio no existe**: si necesita historia de git, el CI tiene que traerla
  (`fetch-depth: 0`) **y** un contrato tiene que exigir esa línea; si no, alguien la saca y el gate queda
  mirando el vacío sin que nadie lo note.
- **Nunca se cambia un acceptance test para conseguir verde.** Primero se decide si la implementación
  introdujo una regresión (arreglar el código) o si el contrato cambió a propósito (justificarlo con
  la TASK o con una decisión del owner).
- **Los E2E de admin mutan la base local**: un spec cortado a la mitad deja sucursales, usuarios y
  pedidos de prueba que hacen fallar a los siguientes. El residuo se limpia con SQL contra el
  contenedor, nunca editando datos a mano en el repo.
- **Los E2E locales necesitan límites de tasa altos** (`ADMIN_LOGIN_RATE_LIMIT=200`,
  `ORDER_CREATE_RATE_LIMIT=200`): sin eso el checkout «falla» y el que falla es el limitador, no el
  producto.
- **El E2E es sensible a la medianoche** del huso del negocio: cerca de las 00:00 el retiro cae al día
  siguiente y el tablero de «Hoy» no muestra el pedido recién creado. (Hacerlo determinista está
  pendiente y registrado en el backlog.)
- **Las aserciones de zona horaria van contra el instante UTC**, no contra `getHours()` ni
  `toLocaleString()`: conviene correr `TZ=UTC npm run test` antes de pushear.
- **Un test de contrato que depende de `git log` se saltea en un clon superficial** — y un contrato que
  a veces no corre es un contrato que no existe. Los guardrails leen **archivos** y nada más.
- **Los overlays montados en un portal** (la hoja de edición, el `Modal`) tienen que llevar el alcance
  `dark` o salen en modo claro; hay un contrato que lo verifica.

## Lecciones de CI/build

- **Una página (`src/app/**/page.tsx`) necesita además `npm run build:webpack`**: el build de
  Turbopack no valida los exports de una página y el problema queda escondido hasta producción.
- **Si el build local falla por el cliente de Prisma**, hay que correr `npx prisma generate`: el build
  no lo regenera. Con `next start` levantado, la regeneración está bloqueada: hay que pararlo antes.
- **El CI exige que los checks requeridos pasen con `strict`**: si `main` avanzó, el PR tiene que
  volver a correr los cuatro.
- **La configuración de rama se toca solo con pedido explícito del owner**, y se verifica contra la
  API real de GitHub; si algo falla por protección, se reporta al humano en vez de saltearla.

## Lecciones de producción

- **El deploy es una sola llamada a `deployService`** sobre el servicio existente
  (`forceRebuild: true`). **No** usar `npm run deploy:easypanel`: fusiona variables y puede crear
  servicios.
- **La llamada puede cortar por timeout sin haber fallado**: el build sigue en segundo plano. La
  confirmación real es `inspectService` (`commit.sha`) más la versión de `/api/health`.
- **El `sha` del panel puede quedar atrás de `main`** si el último push fue solo de documentación: se
  compara contra **el commit que se quiso desplegar**, no contra `HEAD`.
- **Un backup sin restore probado no es un backup.** El drill de restore se hace en una base aislada y
  se registra la evidencia.
- **Una migración que backfillea y después pone `NOT NULL` se despliega fuera del horario comercial**
  (existe una ventana entre el `NOT NULL` y el cambio de tráfico).
- **Un 404 con HTML ajeno en el apex**: primero se identifica de quién es ese HTML
  (`domains/listDomains`) antes de tocar la app.
- **Nunca se despliega sin el OK explícito del owner**, y nunca se despliega una rama de trabajo.
