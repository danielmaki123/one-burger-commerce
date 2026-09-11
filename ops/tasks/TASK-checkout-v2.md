# TASK: Mejora del checkout (v2)

**Estado:** replanificada el 2026-09-12 · **Fase 0 (auditoría del mock) es la única abierta** ·
**Prioridad:** media-alta (es la pantalla donde se cierra la venta) · **Origen:** el **mock completo**
que entrega el owner + el mock previo `mockup/confirmar pedido.txt` (ver §4) + los pendientes que
quedaron abiertos tras `TASK-checkout-ux` y `TASK-checkout-mockup`.

> Cómo arrancar en un chat nuevo: pegar el prompt de §12.
> Antes de codificar leer `AGENTS.md`, `ops/project-state.md` y este archivo completo.

**Cambio de plan.** El owner está terminando un **mock completo** del checkout. La tarea ya no
arranca implementando el rango de preparación: arranca **auditando ese mock completo** para decidir
qué se adapta a este proyecto y en qué orden (§5). Las fases de implementación de §7 son
**candidatas**: se confirman, se recortan o se reordenan recién cuando la fase 0 cierra y el owner
aprueba el resultado. **No se escribe código de producto antes de eso.**

## 1. Objetivo

Que el cliente sepa **cuándo va a estar listo** su pedido con una promesa que la cocina pueda
cumplir, y cerrar la deuda del área de checkout. No es un rediseño: el checkout ya pasó por dos
tareas (`TASK-checkout-ux` dejó de repetir textos y botones; el retiro ya es opcional y
programable). Esto es la capa de encima, y ahora tiene que salir del mock del owner, no de
interpretarlo a ojo.

## 2. Por qué la auditoría va primero

El mock previo ya mostró el patrón de riesgo: se leyó, se decidió "esto sí / esto no" y quedó
anotado en §4. Con un mock **completo** ese atajo no sirve, por tres motivos medidos:

1. **El mock no es la especificación.** El anterior traía delivery, pasarela de pago, Express +$19 y
   una tarifa de servicio: cosas que el MVP no tiene y que no se pueden prometer al cliente. Un mock
   más completo trae **más** de eso, no menos.
2. **El mock tampoco es correcto.** El anterior no cerraba sus propias cuentas (marcaba 15 % de
   propina y sumaba $25), usaba `alert`/`prompt` como placeholders, un `setTimeout` como backend y
   una clase (`h-13`) que no existe en Tailwind. Copiarlo es arrastrar bugs.
3. **No todo lo que se ve es UI.** Lo que parece un cambio de pantalla puede ser un cambio de
   contrato: elegir el porcentaje de propina, ofrecer días futuros o prometer prioridad paga tocan
   la API, el schema y la operación de la cocina. Eso hay que detectarlo **antes** de estimar.

Auditar primero es más barato que implementar de más y revertir.

## 3. Lo que YA está hecho (no volver a hacerlo)

| Cosa | Estado |
|---|---|
| Un encabezado, un resumen, un CTA visible por viewport | Desplegado (`build-20260911-145656`) |
| Retiro **opcional** y programable, con los turnos calculados desde la configuración | Desplegado (`build-20260911-191047`) |
| El servidor valida el estado operativo: `isAcceptingOrders` corta pedidos de verdad y la hora de retiro se valida contra el horario del día | Desplegado |
| La hora de retiro se ve en el ticket de cocina, en la bandeja y el detalle del admin, y en la confirmación del cliente | Desplegado |
| Semáforo de atraso contra la hora prometida (verde / naranja a los 15 min / rojo) | Desplegado |
| El monto de la propina lo calcula **siempre** el servidor desde `settings.tipRate`; del cliente solo se acepta `tipOptIn` | Vigente · invariante a no romper |
| Los datos del negocio (nombre, contacto, horarios, moneda, propina) salen de `/admin/settings`, no del código | Vigente · contrato anti-hardcode con test |

## 4. El mock: qué es y qué se toma

### 4.1 El mock completo (entrada principal de la fase 0)

El owner entrega un mock completo del checkout. **Cuando llegue**, se guarda en su carpeta de
trabajo (`mockup/`, que **no se versiona**; ver §7 fase 5) y se audita según §5. Este brief no
anticipa su contenido: la fase 0 existe justamente para no adivinar.

### 4.2 El mock previo, ya auditado (contexto, no fuente de verdad)

`mockup/confirmar pedido.txt` (y su gemelo `.html`) es un checkout de **delivery** de un
restaurante mexicano ("Kinetic Appetite", CDMX, MXN). Está **sin versionar a propósito**. Sus
cuentas no cierran con su propio estado resaltado (marca la propina de 15 % = $45 y muestra un
total de $332, que corresponde a una propina de $25; el propio autor lo dejó anotado:
*"$300 + $7 + $19 + $25 = $351, wait: 300 + 7 + 25 = 332"*). Tampoco tiene backend: usa
`alert`/`prompt` y un `setTimeout` para simular el éxito, y `h-13` no existe en Tailwind.

**Se tomó:** el rango de preparación ("25-35 min"), los presets de propina y —opcional— la edición
por ítem. **No se toma:** entrega y dirección (el MVP es solo retiro), pasarela de pago / Apple Pay
/ efectivo (se paga en el local al retirar), **Express +$19**, "tarifa de servicio", "impuestos
incluidos", `$`/MXN, y las fuentes por CDN (el build es hermético). Este análisis sigue valiendo como
criterio de lectura para el mock completo (§5.2).

## 5. Fase 0 — Auditoría completa del mock · **primera fase, bloqueante**

**Entrada:** el mock completo que entrega el owner. **Salida:** `ops/audit-checkout-mock.md`
(versionado) + el plan de fases confirmado.

### 5.1 Regla de oro

El mock es **material de diseño, no de cálculo ni de alcance**. Se audita para extraer *intención*
(cómo quiere el owner que se sienta y se lea el checkout), no para copiar comportamiento. Todo dato
o cuenta que el mock afirme se **verifica contra la configuración real y contra el código** antes de
darlo por bueno.

### 5.2 Método (en este orden)

1. **Inventario exhaustivo.** Recorrer el mock **pantalla por pantalla** y listar **todos** los
   elementos: cada texto, control, campo, estado (vacío / cargando / error / éxito), número y color.
   Sin filtrar: primero el inventario completo, después el juicio.
2. **Verlo en un navegador real.** Abrir el mock en Playwright y medirlo **a 375 px y 1280 px**
   (cajas reales, no HTML estático): qué se ve, qué se tapa, qué no es clickeable, qué se rompe.
   El mock previo tenía un radio con `sr-only` que no se podía clickear: ese tipo de defecto solo
   aparece midiendo.
3. **Clasificar cada elemento**, uno por uno, en una de estas columnas:
   - **Aplica al MVP** (retiro en el local, pago al retirar, propina opcional y desmarcada).
   - **Aplica con cambio** (la intención sirve pero el mecanismo del mock no: p. ej. cuenta la
     propina en el cliente y acá la calcula el servidor).
   - **Fuera de alcance** (entrega, tarifas, impuestos, prioridad paga, pasarela, moneda ajena).
   - **Es un bug del mock** (no se arrastra): cuentas que no cierran, clases inexistentes,
     `alert`/`prompt`, `setTimeout` como backend, datos hardcodeados de otro negocio.
4. **Clasificar el costo real de cada "aplica"**, que es lo que decide el orden:
   - **¿Toca contrato?** API (`POST /api/orders`), schema Prisma (migración), validación zod,
     caso de uso o solo UI/copy. Un cambio de contrato es una fase, no un detalle de pantalla.
   - **¿Toca la operación de la cocina?** (lo guardado, el ticket, el semáforo, lo que ve el admin).
   - **¿Es dato del negocio?** Si el mock escribe un nombre, un teléfono, un horario, una moneda o
     una propina, es hardcodeo: sale de `/admin/settings` (contrato anti-hardcode, §3).
   - **¿Promete algo que el sistema no puede cumplir?** El caso testigo es el toggle "Aceptando
     pedidos" que no leía nadie: un control que el owner cree que hace algo y no lo hace. Toda
     promesa nueva al cliente (prioridad, ETA garantizada, capacidad por turno) se rechaza en la
     auditoría, no en la implementación.
5. **Contrastar con lo que ya está hecho** (§3) para no proponer como nuevo algo desplegado, y con
   los pendientes de `ops/project-state.md` §4.
6. **Proponer el plan**: fases candidatas (§7), orden por relación impacto/costo, y **qué decisiones
   hacen falta del owner antes de cada fase** (§6). Marcar explícitamente lo que se **descarta** y
   por qué.

### 5.3 Entregable: `ops/audit-checkout-mock.md`

Un documento versionado con:

- **Encabezado**: de dónde salió el mock (ruta y fecha), cómo se midió (navegador, resoluciones).
- **Tabla del inventario** con una fila por elemento y las columnas de §5.2.3 y §5.2.4: elemento ·
  qué es · clasificación · toca contrato (sí/no y cuál) · fase propuesta · nota.
- **Sección "lo que no se hace y por qué"**, con el motivo por elemento (no una lista de deseos).
- **Sección "bugs y datos del mock que no se arrastran"**, con la evidencia (la cuenta que no
  cierra, la clase inexistente, el dato de otro negocio).
- **Plan propuesto**: fases, orden, y las decisiones que hay que pedirle al owner.

### 5.4 Qué significa cerrar la fase 0

1. El informe está en `ops/audit-checkout-mock.md`, con evidencia y no con impresiones.
2. Cada elemento del mock tiene una clasificación y una fase propuesta (o un descarte con motivo).
3. El owner aprobó **el plan resultante**, no solo el informe.
4. `ops/project-state.md` §4 queda actualizado con el plan nuevo.
5. Recién entonces se abre la primera fase de implementación.

### 5.5 Cómo se commitea

Un commit de documentación (`docs(ops): auditar el mock completo del checkout y proponer el plan`).
**El mock no se commitea**: solo el informe. Si en la auditoría aparece evidencia útil (una captura,
un número medido), va como texto o tabla dentro del informe, no como binario.

## 6. Decisiones que hay que tomar

Se piden **todas juntas, al cerrar la fase 0** (no a mitad de camino, y no antes: la auditoría puede
agregar o descartar decisiones). Cada una **bloquea** la fase que la necesita.

| # | Decisión | Bloquea | Opciones |
|---|---|---|---|
| **D1** | ¿Pedidos para **días futuros**? Hoy el checkout solo ofrece turnos de hoy; un pedido para mañana se puede crear por API y el admin lo muestra, pero la UI no lo ofrece. | Fase 3 | **No** (se saltea) · **Sí** (selector de día, turnos por día, el servidor ya valida contra el horario del día elegido, y el admin agrupa o filtra por día: es la fase más grande del plan) |
| **D2** | ¿**Presets de propina** o una sola tasa? Dejar elegir el porcentaje **es un cambio de contrato**, no de UI: hoy el monto lo calcula el servidor desde `settings.tipRate`. | Fase 4 | **Sí, con lista cerrada** (los presets se configuran en ajustes y el servidor acepta **solo** una tasa de esa lista, calculando siempre el monto — recomendada) · **No** (una sola tasa, como hoy) · Monto libre del cliente (**no recomendada**: rompe el invariante) |
| **D3** | ¿Se versiona `mockup/`? Hoy la carpeta está afuera del repo por convención (y además figura como *untracked*, no ignorada). | Fase 5 | Ignorarla explícitamente en `.gitignore` · Mover el material a `ops/` con una nota |

La propina sigue **opcional y desmarcada por defecto** (`AGENTS.md`), con D2 o sin D2: el mock
previo la prendía en 15 % y eso no se copia.

## 7. Fases de implementación · **candidatas hasta que cierre la fase 0**

El orden es por relación impacto/costo: primero lo barato y seguro, después lo que depende de una
decisión. La auditoría (§5) puede confirmar, recortar o reordenar esta lista.

### Fase 1 — Rango de preparación (mín–máx)

**Qué gana el negocio:** el cliente sabe entre qué horas esperar en vez de un instante exacto que la
cocina puede fallar.

- `pickupMaxMinutes` opcional en `BusinessSettings` (**migración**) + zod: entero, **mayor o igual**
  a `pickupLeadMinutes`, tope 240. Vacío = sin rango (comportamiento actual).
- Campo en `/admin/settings` → Operación, al lado de "Minutos de preparación".
- Copy del checkout: "Lo antes posible · listo entre 1:40 y 2:00 p. m.", y en la fila "Hora de
  retiro" de la confirmación del cliente.
- **La hora que se guarda sigue siendo el mínimo**, y el ticket de cocina sigue mostrando una hora
  concreta: el rango es copy para el cliente, no un dato operativo. El semáforo del admin no cambia.
- **TDD:** primero el formateo del rango y la validación del zod; después el campo y el copy.

### Fase 2 — El campo de preparación se explica solo

Pedido explícito del owner: hoy la etiqueta dice "Minutos de preparación" y la ayuda "Entre 0 y
180", que es la validación y no para qué sirve.

- Reescribir la ayuda para que diga qué hace: es el mínimo antes del primer retiro **y** define hasta
  qué hora se puede pedir.
- **Vista previa en vivo** en el admin (mismo patrón que la vista previa de colores): con la
  configuración que se está editando, mostrar los turnos que vería el cliente y hasta qué hora se
  puede pedir. Es lo que hoy falta: escribís 25 y no ves que eso significa "última orden 21:35".

### Fase 3 — Pedidos para días futuros · **depende de D1**

Si el negocio los quiere: selector de día en el control de retiro, turnos calculados por día, el
servidor ya valida contra el horario del día elegido (no hace falta cambiarlo), y el admin agrupa o
filtra por día. Es la fase más grande; si la respuesta es no, se saltea.

### Fase 4 — Presets de propina · **depende de D2**

- Los presets se configuran en ajustes; el servidor acepta **solo** una tasa de esa lista y sigue
  calculando el monto. Así se mantiene el invariante "el monto nunca viene del cliente".
- **TDD:** primero la validación de la tasa contra la lista; después el payload y la UI.

### Fase 5 — Deuda menor del área · **incluye D3**

- **El prefijo de WhatsApp por defecto está fijo en `+505`**
  (`src/shared/lib/whatsapp-input-value.ts:20`). Para una plataforma whitelabel es un dato del
  negocio escrito en el código, igual que lo eran el teléfono y la moneda. Derivarlo del teléfono
  del negocio o hacerlo configurable.
- Resolver D3 (qué hacer con `mockup/`).

### Fase 6 — Opcional, solo si se quiere

**Editar por ítem desde el resumen.** Vale únicamente si es **edición en línea** (paso de cantidad y
quitar dentro del resumen, reutilizando `updateQuantity`/`removeItem` del carrito). Como link a
`/cart` duplica el botón "Editar carrito" que ya existe. Contra: el resumen del checkout se parecería
al carrito.

## 8. Fuera de alcance (no hacer sin pedido explícito)

- **Entrega** (dirección, zonas, tarifa) y **propina para el repartidor**: el MVP es solo retiro.
- **Pasarela de pago**: se paga en el local al retirar. No hay cobro online.
- **Express / prioridad paga**: además de ser producto nuevo, promete algo que el sistema no puede
  cumplir — no hay cola con prioridades, y el turno de retiro es una *preferencia* sin capacidad. Es
  la misma clase de bug que el toggle "Aceptando pedidos" que no hacía nada.
- **Tarifa de servicio e impuestos**: no existen en el modelo (`order-totals.ts` tiene subtotal,
  descuento, empaque, envío y propina).
- **ETA duplicada en el header**: el checkout ya muestra la hora en el control de retiro; un segundo
  lugar es repetir, que es exactamente lo que arregló `TASK-checkout-ux`.
- **Límite de pedidos por turno**: decisión ya tomada en contra (no hay reservas, son órdenes).

> Esta lista es el punto de partida de §5.2.3, no su reemplazo: si el mock completo trae algo nuevo
> fuera del MVP, se descarta en la auditoría con el motivo escrito.

## 9. Criterios de aceptación

**De la fase 0 (auditoría):**

1. Existe `ops/audit-checkout-mock.md` con el inventario **completo** del mock, medido en navegador
   real a 375 px y 1280 px.
2. Cada elemento está clasificado (aplica / aplica con cambio / fuera de alcance / bug del mock) y
   tiene fase propuesta o descarte con motivo.
3. Está explícito qué toca contrato (API, schema, migración, zod) y qué es solo UI/copy.
4. El owner aprobó el plan resultante.
5. **No se escribió código de producto** antes de este cierre.

**De la implementación (se confirman contra la auditoría):**

6. En `/admin/settings` se puede poner el mínimo y el máximo de preparación, y **se ve el efecto
   antes de guardar** (los turnos resultantes y hasta qué hora se puede pedir).
7. El checkout y la confirmación muestran "listo entre X y Y" cuando hay máximo; con el máximo vacío
   se comportan como hoy.
8. La hora guardada y la que ve la cocina **siguen siendo el mínimo**: el semáforo del admin no
   cambia de comportamiento.
9. Un máximo menor que el mínimo se rechaza con mensaje por campo.
10. Si se aprueba D2: el servidor rechaza una tasa que no esté en la lista configurada, y el monto
    sigue calculándose en el servidor.

## 10. Riesgos

- **Auditar el mock como si fuera la especificación.** Es el riesgo central de esta replanificación:
  un mock completo se siente como un plano y no lo es. La auditoría clasifica; no copia.
- **Configurarse el local sin poder tomar pedidos.** Ya pasó con `isAcceptingOrders`: un control que
  el owner cree que hace algo y no lo hace. La validación cruzada (máx ≥ mín) y la vista previa son
  la red que hace seguros estos campos.
- **El rango como excusa.** Prometer "entre 1:40 y 2:00" y entregar 2:20 sigue siendo incumplir. El
  rango no reemplaza al semáforo del admin, que es el que avisa.
- **Agregar lo que el MVP no tiene.** El mock empuja a sumar pago, envío y prioridad. Cada una es una
  promesa al cliente que hoy no se puede cumplir.
- **Que la auditoría se vuelva un documento de deseos.** Se cierra con clasificación y fase por
  elemento (§5.4), no con una lista de ideas.

## 11. Cómo verificar

```bash
# Entorno local (Postgres + seed + server) — para las fases de implementación
docker compose up -d
npx prisma generate        # ⚠️ `npm run build` NO lo hace: tras tocar el schema hay que correrlo
npx prisma migrate deploy
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/oneburger?schema=public" npx tsx prisma/seed.ts
DATABASE_URL="..." APP_ENV=production NODE_ENV=production ADMIN_LOGIN_RATE_LIMIT=200 npx next start -p 3210
BASE_URL=http://127.0.0.1:3210 E2E_ALLOW_MUTATIONS=true npm run test:e2e:prod:full
```

- **Ojo con el horario:** el seed local deja el local abierto 00:00–23:59 y preparación 0 para que
  los E2E no dependan de la hora. **Producción tiene 12:00–22:00 y 25 min**, así que fuera de esa
  franja el checkout se ve bloqueado (es correcto, no es un bug).
- Verificar a **375 px** además de escritorio: el CTA fijo y el panel de turnos solo se notan ahí.
- El navegador real es obligatorio para lo visual: un test de HTML estático no ve el CSS.
- Para la fase 0, el "test" es el propio informe: se verifica abriendo el mock en Playwright y
  midiendo, y cada afirmación del informe tiene que poder reproducirse.

## 12. Prompt para el chat nuevo

> Trabajás en `one-burger-commerce` (Next.js 16 + Prisma + Postgres, deploy en Easypanel).
> Antes de escribir código leé, en este orden: `AGENTS.md`, `ops/project-state.md`,
> `ops/production-readiness.md` y `ops/tasks/TASK-checkout-v2.md`.
> La tarea es la **mejora del checkout (v2)**. **La primera fase es una auditoría completa del mock
> completo del owner** (`ops/tasks/TASK-checkout-v2.md` §5): inventario de todos los elementos,
> medidos en navegador real a 375 px y 1280 px, cada uno clasificado (aplica / aplica con cambio /
> fuera de alcance / bug del mock), con lo que toca contrato (API, schema, migración, zod) separado
> de lo que es UI/copy. El entregable es `ops/audit-checkout-mock.md` y **no se escribe código de
> producto hasta que el owner apruebe el plan resultante**.
> Las decisiones de §6 (días futuros, presets de propina y qué hacer con `mockup/`) se preguntan
> **todas juntas al cerrar la auditoría**, antes de las fases que bloquean.
> A partir de ahí, las fases de implementación candidatas de §7 se ejecutan **en orden, una por
> commit**, con **TDD siempre**: escribí primero el test que falla, corrélo y confirmá el rojo antes
> de implementar. Nada de código antes del test.
> Trabajá en español, con commits propios, y validá con `npm run test`, `lint`, `typecheck`, `build`
> y `security:secrets` antes de cerrar cada fase. Si tocás `schema.prisma`, corré
> `npx prisma generate` (el build local no lo regenera).
> Lo visual se verifica en navegador real (Playwright) a 375 px y 1280 px, no en HTML estático.
> Al terminar cada fase: actualizá `ops/project-state.md`, hacé push a `main` y confirmá que el CI
> quedó verde. **No despliegues a producción sin pedir confirmación.**
