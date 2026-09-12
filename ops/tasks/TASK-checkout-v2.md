# TASK: Mejora del checkout (v2)

> ⚠️ **Absorbida por [`TASK-mock-adoption.md`](TASK-mock-adoption.md)**, el programa de adopción del
> mock completo: este brief pasa a ser la tarea **T5 (carrito + checkout)** de su ola 1. El plan
> vigente, las reglas (ningún control decorativo, paleta como preset con contraste, TDD por tarea) y
> las decisiones están en ese documento; lo de acá sigue valiendo como detalle de la tarea del
> checkout.

**Estado:** **fase 0 medida** (`ops/audit-checkout-mock.md`) · **pendiente la aprobación del owner**
sobre el plan de §7 y las decisiones de §6 · **Prioridad:** media-alta (es la pantalla donde se cierra
la venta) · **Origen:** el **mock completo** que entregó el owner + el mock previo
`mockup/confirmar pedido.txt` (ver §4) + los pendientes que quedaron abiertos tras
`TASK-checkout-ux` y `TASK-checkout-mockup`.

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

### 4.1 El mock completo (entrada de la fase 0, **ya auditado**)

El mock entregado está en `stitch_full_pwa_builder/stitch_full_pwa_builder/` (export de Stitch, marca
"Casa Antigua", 7 pantallas + su `DESIGN.md`). **No se versiona** (carpeta de trabajo del owner; ver
§6 D3). Su auditoría completa está en **[`ops/audit-checkout-mock.md`](../audit-checkout-mock.md)** y
**es la que manda**: resumen de lo que cambia este brief:

- **Es un PWA de delivery con dos sucursales de otra marca**, no una evolución de nuestro checkout.
  Solo **dos** de sus 7 pantallas tocan esta tarea: el carrito/checkout y la confirmación.
- **Su checkout no tiene un solo `input`**: nombre y WhatsApp se perdieron en el export (quedó el
  comentario `Datos de Contacto (Guest Checkout)` sin markup) y **tampoco tiene hora de retiro**.
  Copiarlo tal cual borraría dos funciones desplegadas.
- **No es funcional** (el CTA no tiene `onclick`; sucursal, método de pago y propina no responden),
  **no es accesible** (zoom bloqueado en las 7, 0 `role`, 0 `aria-live`, 45 fallos de contraste),
  **no cierra sus cuentas** (943 ≠ 858 en el seguimiento) y **no usa su propio design system**.
- **Lo que sí aporta**: el **rango de preparación** (fase 1), el estimado en la confirmación, el punto
  de retiro con dirección (fase 3 nueva) y el patrón de edición por ítem (fase 7).

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

1. El informe está en `ops/audit-checkout-mock.md`, con evidencia y no con impresiones. — **hecho**
   (2026-09-12; los números salen de medir el DOM renderizado, no de leer el HTML a ojo).
2. Cada elemento del mock tiene una clasificación y una fase propuesta (o un descarte con motivo). —
   **hecho** (§4, §5 y §7 del informe).
3. El owner aprobó **el plan resultante**, no solo el informe. — **pendiente**.
4. `ops/project-state.md` §4 queda actualizado con el plan nuevo. — **hecho**.
5. Recién entonces se abre la primera fase de implementación.

### 5.5 Cómo se commitea

Un commit de documentación (`docs(ops): auditar el mock completo del checkout y proponer el plan`).
**El mock no se commitea**: solo el informe y la herramienta de medición. Si en la auditoría aparece
evidencia útil (una captura, un número medido), va como texto o tabla dentro del informe, no como
binario.

## 6. Decisiones que hay que tomar

Se piden **todas juntas** (no a mitad de camino). Cada una **bloquea** la fase que la necesita; las
marcadas "por defecto" no bloquean nada si el owner no responde: se implementa la recomendación.

| # | Decisión | Bloquea | Opciones |
|---|---|---|---|
| **D1** | ¿Pedidos para **días futuros**? Hoy el checkout solo ofrece turnos de hoy; un pedido para mañana se puede crear por API y el admin lo muestra, pero la UI no lo ofrece. | Fase 4 | ✅ **RESUELTA el 2026-09-12: SÍ, con selector de día.** La fase 4 se hace (era la recomendación "No", pero el owner quiere el selector): selector de día, turnos por día, el servidor ya valida contra el horario del día elegido, y el admin agrupa o filtra por día |
| **D2** | ¿**Presets de propina** o una sola tasa? Dejar elegir el porcentaje **es un cambio de contrato**, no de UI: hoy el monto lo calcula el servidor desde `settings.tipRate`. | Fase 5 | ✅ **RESUELTA el 2026-09-12: NO, una sola tasa.** La fase 5 queda **descartada** (no pendiente): el servidor sigue calculando el monto con `settings.tipRate` |
| **D3** | ¿Se versionan `mockup/` y `stitch_full_pwa_builder/`? Hoy las dos figuran como *untracked*, no ignoradas. | Fase 6 | **Ignorarlas** explícitamente en `.gitignore` (recomendada: son carpetas de trabajo) · Mover el material a `ops/` con una nota |
| **D4** | ¿**Upselling** "¿Algo más para acompañar?" en el carrito/checkout (el mock lo trae)? | Fase 7 | **No en el checkout** (recomendada: contradice el "un solo resumen" de `TASK-checkout-ux`) · Sí, pero en `/cart` |
| **D5** | ¿**PIN de retiro** en la confirmación (el mock muestra "4821 · díctalo en caja")? | — | **No** por ahora (recomendada: mostrar el número de pedido) · Sí, un PIN real (**migración**) |
| **D6** | ¿La **paleta del mock** (crimson + crema) como preset de apariencia? | — | **Sí** (recomendada: es un preset más en `color-presets.ts`, con sus avisos de contraste; no cambia el default) · No |
| **D7** | ¿**Método de pago** (efectivo / tarjeta) en el checkout? | — | **No** por ahora (recomendada: se cobra en caja y el dato no aporta a la cocina) · Sí (**persistir** el dato) |
| **D8** | ¿**Calculadora de vuelto** ("pagaré con… / cambio")? | — | **No** (recomendada: dato no autoritativo, sin uso en la operación) · Sí (**contrato**) |

La propina sigue **opcional y desmarcada por defecto** (`AGENTS.md`), con D2 o sin D2: el mock la
trae **premarcada al 10 % y "para el repartidor"**, y eso no se copia.

## 7. Fases de implementación · **plan propuesto por la auditoría, pendiente de aprobación**

El orden es por relación impacto/costo: primero lo barato y seguro, después lo que depende de una
decisión. La auditoría confirmó las fases 1 y 2, agregó la 3 y dejó la edición por ítem al final.

### Protocolo TDD de cada fase · **no negociable**

`AGENTS.md` lo exige y este brief lo repite porque es donde más fácil se saltea: **ningún cambio
funcional se escribe antes de que exista un test rojo**. El orden, por fase, es siempre el mismo:

1. **Escribir el test que falla** (el "primer test" de la tabla de abajo).
2. **Correrlo y confirmar el rojo**: `npm test -- <archivo>` y pegar la salida en el commit. El rojo
   tiene que fallar **por la razón que se está implementando**, no por un import roto o un tipo mal.
3. **Implementar lo mínimo** para el verde.
4. **Refactorizar** con los tests verdes.
5. **Cerrar**: `npm run test`, `lint`, `typecheck`, `build` y `security:secrets`. Si se tocó UI
   pública o de admin, además el E2E (`BASE_URL=… npm run test:e2e:prod:full`) y la verificación a
   **375 px** en navegador real.

Los dobles de test implementan el **puerto completo**: si un puerto suma un método, el adaptador en
memoria lo implementa también (el compilador lo obliga).

| Fase | Primer test (rojo) | Qué tiene que verificar |
|---|---|---|
| 1 | `business-settings/domain/business-settings.schema.test.ts` | `pickupMaxMinutes`: entero, **≥ `pickupLeadMinutes`**, tope 240, y error por campo cuando es menor |
| 1 | `business-settings/domain/pickup-slots.test.ts` | El formateo del rango ("listo entre 1:40 y 2:00 p. m."); **sin máximo devuelve el instante de hoy** |
| 1 | `checkout/page.test.tsx` · `success/[orderId]/order-success-view.test.ts` | El rango aparece en checkout y confirmación; sin máximo, no |
| 1 | `admin/settings/settings-client.test.tsx` | El campo nuevo viaja en el payload |
| 1 | `business-settings/business-settings-migration-contract.test.ts` | La migración y los defaults no se desincronizan (si `pickupMaxMinutes` tiene default) |
| 2 | `admin/settings/settings-client.test.tsx` | La ayuda dice qué hace el campo y la vista previa muestra los turnos y "última orden" |
| 3 | `checkout/page.test.tsx` | Muestra la dirección configurada; **con la dirección vacía no muestra la fila** |
| 4 | `business-settings/domain/pickup-slots.test.ts` · `orders/features/create-order/create-order.test.ts` | Turnos del día elegido y validación contra el horario de **ese** día |
| 5 | `orders/features/create-order/create-order.test.ts` · `business-settings.schema.test.ts` | El servidor rechaza una tasa fuera de la lista y **sigue calculando el monto** |
| 6 | `shared/lib/whatsapp-input-value.test.ts` | El prefijo por defecto sale de la configuración, no del literal `+505` |
| 7 | `app/(public)/cart/page.test.ts` | Edición en línea reutilizando `updateQuantity`/`removeItem` |

Para lo visual y de flujo, el test que manda es el E2E (`tests/e2e/public-order.spec.ts`), en
navegador real: un test de HTML estático no ve el CSS.

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

### Fase 3 — El punto de retiro en el checkout · **nueva, la propone la auditoría**

El mock muestra, junto al retiro, la **dirección del local** y su horario en la tarjeta de sucursal.
Nuestro checkout muestra el horario ("El local atiende …") pero **no dónde se retira**, y el cliente
que hizo el pedido desde el celular no tiene ahí la referencia.

- Mostrar, en el control de retiro, la **dirección configurada** (sale de `/admin/settings`:
  `addressLine`, `city`, `addressReference`) y, si hay `mapsUrl`, el enlace al mapa.
- Sin contrato nuevo: son datos que ya existen y ya se leen en el público.
- **TDD:** el copy con dirección vacía (no mostrar la fila) va primero.

### Fase 4 — Pedidos para días futuros · **D1 resuelta: SÍ (2026-09-12) — CERRADA**

Selector de día en el control de retiro, turnos calculados por día, el servidor ya valida contra el
horario del día elegido (no hizo falta cambiarlo), y el admin separa los pedidos de otro día.

- **Sin límite de días**: decisión del owner en la sesión del 2026-09-12 ("sin límite práctico: todo
  lo que permita el horario"). El único tope es el horario de ese día; un día cerrado no se puede
  elegir y el control lo explica en vez de dejar un botón que falle.
- **El día manda, no el reloj del cliente**: la hora del retiro se resuelve en la **zona del
  negocio** (`pickupInstant`), no con `setHours` del celular — que era lo que hacía el checkout y
  habría mandado la fecha equivocada desde otra zona. Ese helper (`formatPickupTimeIso`) se eliminó
  con su test, reemplazado por el dominio.
- **"Lo antes posible" es solo de hoy**: al elegir otro día el control pide una hora (arranca en el
  primer turno del día) porque sin hora el pedido saldría para hoy.
- **El admin no puede confundirlo con el turno de hoy**: la bandeja agrupa los pedidos abiertos de
  otro día en "Programados" (bucket nuevo, con test propio en `orders-page-helpers.test.ts`), la
  etiqueta del retiro agrega el día ("Retiro mañana 8:00 p. m. · Programado"), el semáforo no cuenta
  minutos de otro día, y la confirmación y el historial del cliente también dicen el día.
- **Verificación**: 1520 unitarios, lint, typecheck, `npm run build`, `security:secrets`, y **E2E 80
  pasaron / 7 salteados / 0 fallos** (`public-order.spec.ts`: "un pedido para otro día no cae en el
  turno de hoy").
- **Pendiente declarado**: la bandeja del admin ancla "hoy" a `America/Managua` fijo
  (`orders-page-helpers.ts`), mientras el checkout y el retiro usan la zona de la configuración. Para
  un negocio en otra zona habría que mover ese anclaje a `BusinessSettings.timezone`. — **cerrado el
  2026-09-12**: la bandeja ya usa la zona del negocio (ver `ops/project-state.md`); la misma clase de
  hardcodeo sigue en el tablero del admin (`admin-overview-periods`). — **cerrado también el
  2026-09-12**: el tablero, el esquema del payload y su cliente usan la zona del negocio.

### Fase 5 — Presets de propina · **D2 resuelta: NO (2026-09-12) — fase descartada**

No se hace. Se mantiene una sola tasa configurable (`settings.tipRate`) y el servidor sigue calculando
el monto, que es el invariante que importa. El mock premarca 10 % y lo calcula sobre subtotal +
empaque; nosotros no copiamos ninguna de las dos cosas.

### Fase 6 — Deuda menor del área · **incluye D3** — **prefijo cerrado (2026-09-12); D3 pendiente del owner**

- **El prefijo de WhatsApp por defecto está fijo en `+505`
  (`src/shared/lib/whatsapp-input-value.ts:20`). Para una plataforma whitelabel es un dato del
  negocio escrito en el código, igual que lo eran el teléfono y la moneda. Derivarlo del teléfono
  del negocio o hacerlo configurable.** → **CERRADO**: el prefijo ya salía del teléfono del negocio
  (T5); lo que quedaba era el **respaldo** cuando el negocio todavía no cargó ninguno, que asumía
  Nicaragua (`+505`) y además la ayuda del campo decía "si tu número no es de Nicaragua". Ahora
  `resolveWhatsappDefaultPrefix` devuelve `null` sin teléfono y el campo arranca en "Otro" pidiendo
  el prefijo internacional: sin dato del negocio, la plataforma no elige país. La ayuda pasó a
  "Elegí el prefijo internacional de tu número".
- Resolver D3 (qué hacer con `mockup/` y `stitch_full_pwa_builder/`) — **pendiente de respuesta del
  owner**: las dos carpetas están en `.gitignore` y son el material de referencia del mock; borrarlas
  no afecta al código ni al deploy.

### Fase 7 — Opcional · **incluye D4** — **CERRADA (2026-09-12): ya estaba implementada; se le agregó el test**

**Editar por ítem desde el resumen** (el mock lo hace: cantidad y quitar dentro de su carrito). Los
controles ya existían desde `TASK-checkout-ux`, **en `/cart`** y no en el checkout (que es lo que
recomendaba la auditoría, para no romper el "un solo resumen" ni el CTA único por viewport):
`CartLineCard` con stepper `− / +` y "Quitar", sobre `updateQuantity`/`removeItem` del carrito.

Lo que faltaba era lo que exige la regla del programa ("ningún control decorativo: implementado **y
cubierto por un test**"): el test de comportamiento. Se agregó
`src/app/(public)/cart/cart-editing.test.tsx`, que usa el **carrito de verdad** (`CartProvider` sobre
`localStorage`) y comprueba que sumar cambia el total (35 → 70), que restar no baja de una unidad (y que
para vaciar está "Quitar"), que quitar deja el estado vacío, y que editar una línea no toca a la otra.

**D4** (si el mock va a `/cart`): resuelto de hecho — la edición quedó en `/cart`.

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

**De la fase 0 (auditoría) — cerrada el 2026-09-12 salvo la aprobación:**

1. Existe `ops/audit-checkout-mock.md` con el inventario **completo** del mock, medido en navegador
   real a 375 px y 1280 px. ✔
2. Cada elemento está clasificado (aplica / aplica con cambio / fuera de alcance / bug del mock) y
   tiene fase propuesta o descarte con motivo. ✔
3. Está explícito qué toca contrato (API, schema, migración, zod) y qué es solo UI/copy. ✔
4. El owner aprobó el plan resultante. **⏳ pendiente**
5. **No se escribió código de producto** antes de este cierre. ✔ (solo la herramienta de medición)

**De la implementación (plan de §7):**

6. En `/admin/settings` se puede poner el mínimo y el máximo de preparación, y **se ve el efecto
   antes de guardar** (los turnos resultantes y hasta qué hora se puede pedir).
7. El checkout y la confirmación muestran "listo entre X y Y" cuando hay máximo; con el máximo vacío
   se comportan como hoy.
8. La hora guardada y la que ve la cocina **siguen siendo el mínimo**: el semáforo del admin no
   cambia de comportamiento.
9. Un máximo menor que el mínimo se rechaza con mensaje por campo.
10. El checkout muestra la **dirección del local** cuando está configurada, y no muestra la fila si
    está vacía.
11. Si se aprueba D2: el servidor rechaza una tasa que no esté en la lista configurada, y el monto
    sigue calculándose en el servidor.

## 10. Riesgos

- **Auditar el mock como si fuera la especificación.** Es el riesgo central de esta replanificación, y
  la auditoría lo confirmó: el mock es un PWA de delivery de otra marca, no funciona (el CTA del
  checkout no tiene `onclick`), no cierra sus cuentas (943 ≠ 858) y no usa su propio design system.
  La auditoría clasifica; no copia.
- **Perder lo que ya está desplegado.** El checkout del mock **no tiene nombre, ni WhatsApp, ni hora
  de retiro**: copiarlo borraría tres cosas que hoy funcionan. Todo lo que se adopte se suma a lo que
  ya está, y el E2E tiene que seguir en verde.
- **Configurarse el local sin poder tomar pedidos.** Ya pasó con `isAcceptingOrders`: un control que
  el owner cree que hace algo y no lo hace. La validación cruzada (máx ≥ mín) y la vista previa son
  la red que hace seguros estos campos.
- **El rango como excusa.** Prometer "entre 1:40 y 2:00" y entregar 2:20 sigue siendo incumplir. El
  rango no reemplaza al semáforo del admin, que es el que avisa.
- **Agregar lo que el MVP no tiene.** El mock empuja a sumar pago, envío, prioridad, sucursales,
  favoritos y reseñas. Cada una es una promesa al cliente que hoy no se puede cumplir (o un contrato
  nuevo). Están todas en §6 (D4-D8) y en el informe §7.
- **Que la auditoría se vuelva un documento de deseos.** Se cerró con clasificación y fase por
  elemento (§5.4), no con una lista de ideas: cada descarte tiene su motivo y cada adopción su fase.

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
> La tarea es la **mejora del checkout (v2)**. **La fase 0 (auditoría del mock) ya está hecha**:
> el informe es `ops/audit-checkout-mock.md` y el plan propuesto está en §7 de ese brief.
> **No escribas código de producto hasta que el owner apruebe el plan y responda las decisiones D1-D8
> de §6.** Con esa aprobación, ejecutá las fases de §7 **en orden, una por commit**, con **TDD
> siempre**: escribí primero el test que falla, corrélo y confirmá el rojo antes de implementar. Nada
> de código antes del test.
> Ojo con dos cosas que el mock NO tiene y no se pueden perder: **nombre y WhatsApp** del cliente y
> la **hora de retiro opcional/programable** (con su gate operativo).
> Si hace falta re-medir el mock, la herramienta es `node scripts/audit-checkout-mock.mjs` (navegador
> real a 375 px y 1280 px; el JSON queda en `test-results/mock-audit/`).
> Trabajá en español, con commits propios, y validá con `npm run test`, `lint`, `typecheck`, `build`
> y `security:secrets` antes de cerrar cada fase. Si tocás `schema.prisma`, corré
> `npx prisma generate` (el build local no lo regenera).
> Lo visual se verifica en navegador real (Playwright) a 375 px y 1280 px, no en HTML estático.
> Al terminar cada fase: actualizá `ops/project-state.md`, hacé push a `main` y confirmá que el CI
> quedó verde. **No despliegues a producción sin pedir confirmación.**
