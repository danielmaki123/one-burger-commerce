# TASK: Mejora del checkout (v2)

**Estado:** aprobada para ejecutar · **Prioridad:** media-alta (es la pantalla donde se cierra la
venta) · **Origen:** `mockup/confirmar pedido.txt` (guía del owner, ver §3) + los pendientes que
quedaron abiertos tras `TASK-checkout-ux` y `TASK-checkout-mockup`.

> Cómo arrancar en un chat nuevo: pegar el prompt de §10.
> Antes de codificar leer `AGENTS.md`, `ops/project-state.md` y este archivo completo.

## 1. Objetivo

Que el cliente sepa **cuándo va a estar listo** su pedido con una promesa que la cocina pueda
cumplir, y cerrar la deuda que quedó en el área de checkout. No es un rediseño: el checkout ya
pasó por dos tareas (`TASK-checkout-ux` dejó de repetir textos y botones; el retiro ya es
opcional y programable). Esto es la capa de encima.

## 2. Lo que YA está hecho (no volver a hacerlo)

| Cosa | Estado |
|---|---|
| Un encabezado, un resumen, un CTA visible por viewport | Desplegado (`build-20260911-145656`) |
| Retiro **opcional** y programable, con los turnos calculados desde la configuración | Desplegado (`build-20260911-191047`) |
| El servidor valida el estado operativo: `isAcceptingOrders` corta pedidos de verdad y la hora de retiro se valida contra el horario del día | Desplegado |
| La hora de retiro se ve en el ticket de cocina, en la bandeja y el detalle del admin, y en la confirmación del cliente | Desplegado |
| Semáforo de atraso contra la hora prometida (verde / naranja a los 15 min / rojo) | Desplegado |

## 3. El mock: qué es y qué se toma

`mockup/confirmar pedido.txt` es un checkout de **delivery** de un restaurante mexicano
("Kinetic Appetite", CDMX, MXN). Está **sin versionar a propósito**: el `.gitignore` ya excluye
la carpeta de trabajo del owner. **El mock no es fuente de verdad del cálculo**: sus cuentas no
cierran con su propio estado resaltado (marca la propina de 15 % = $45 y muestra un total de
$332, que corresponde a una propina de $25; el autor lo dejó anotado en el código:
*"$300 + $7 + $19 + $25 = $351, wait: 300 + 7 + 25 = 332"*). Tampoco tiene backend: usa
`alert`/`prompt` y un `setTimeout` para simular el éxito, y `h-13` no existe en Tailwind.

**Se toma:** el rango de preparación ("25-35 min"), los presets de propina y —opcional— la
edición por ítem.
**No se toma:** entrega y dirección (el MVP es solo retiro), pasarela de pago / Apple Pay /
efectivo (se paga en el local al retirar), **Express +$19**, "tarifa de servicio", "impuestos
incluidos", `$`/MXN, y las fuentes por CDN (el build es hermético).

## 4. Decisiones que hay que tomar antes de las fases 4 y 5

Preguntarlas al principio, no a mitad de camino:

1. **¿Pedidos para días futuros?** Hoy el checkout solo ofrece turnos de hoy; un pedido para
   mañana se puede crear por API y el admin lo muestra, pero la UI no lo ofrece. Si el negocio
   los quiere, es la fase más grande del plan.
2. **¿Presets de propina o una sola tasa?** Hoy el servidor calcula el monto desde
   `settings.tipRate` y del cliente solo acepta `tipOptIn` (booleano). Dejar elegir el
   porcentaje **es un cambio de contrato**, no de UI. Opción recomendada: los presets se
   configuran en ajustes y el servidor acepta solo una tasa de esa lista (el monto se sigue
   calculando en el servidor). Opción **no** recomendada: monto libre del cliente.
3. **¿Se versiona `mockup/`?** Hoy está afuera del repo por la convención del `.gitignore`. Si
   se quiere citar como guía, moverlo a `ops/` con una nota.

## 5. Fases, en orden

El orden es por relación impacto/costo: primero lo barato y seguro, después lo que depende de
una decisión.

### 5.1 — Rango de preparación (mín–máx)

**Qué gana el negocio:** el cliente sabe entre qué horas esperar en vez de un instante exacto
que la cocina puede fallar.

- `pickupMaxMinutes` opcional en `BusinessSettings` (**migración**) + zod: entero, **mayor o
  igual** a `pickupLeadMinutes`, tope 240. Vacío = sin rango (comportamiento actual).
- Campo en `/admin/settings` → Operación, al lado de "Minutos de preparación".
- Copy del checkout: "Lo antes posible · listo entre 1:40 y 2:00 p. m.", y en la fila "Hora de
  retiro" de la confirmación del cliente.
- **La hora que se guarda sigue siendo el mínimo**, y el ticket de cocina sigue mostrando una
  hora concreta: el rango es copy para el cliente, no un dato operativo. El semáforo del admin
  no cambia.
- **TDD:** primero el formateo del rango y la validación del zod; después el campo y el copy.

### 5.2 — El campo de preparación se explica solo

Pedido explícito del owner: hoy la etiqueta dice "Minutos de preparación" y la ayuda "Entre 0 y
180", que es la validación y no para qué sirve.

- Reescribir la ayuda para que diga qué hace: es el mínimo antes del primer retiro **y** define
  hasta qué hora se puede pedir.
- **Vista previa en vivo** en el admin (mismo patrón que la vista previa de colores): con la
  configuración que se está editando, mostrar los turnos que vería el cliente y hasta qué hora
  se puede pedir. Es lo que hoy falta: escribís 25 y no ves que eso significa "última orden
  21:35".

### 5.3 — Pedidos para días futuros · **depende de la decisión 1**

Si el negocio los quiere: selector de día en el control de retiro, turnos calculados por día,
el servidor ya valida contra el horario del día elegido (no hace falta cambiarlo), y el admin
agrupa o filtra por día. Es la fase más grande; si la respuesta es no, se saltea.

### 5.4 — Presets de propina · **depende de la decisión 2**

- Los presets se configuran en ajustes; el servidor acepta **solo** una tasa de esa lista y
  sigue calculando el monto. Así se mantiene el invariante "el monto nunca viene del cliente".
- La propina sigue **opcional y desmarcada por defecto** (`AGENTS.md`). El mock la prende en
  15 %; no copiar eso.
- **TDD:** primero la validación de la tasa contra la lista; después el payload y la UI.

### 5.5 — Deuda menor del área

- **El prefijo de WhatsApp por defecto está fijo en `+505`**
  (`src/shared/lib/whatsapp-input-value.ts:20`). Para una plataforma whitelabel es un dato del
  negocio escrito en el código, igual que lo eran el teléfono y la moneda. Derivarlo del
  teléfono del negocio o hacerlo configurable.
- Decidir qué hacer con `mockup/` (decisión 3).

### 5.6 — Opcional, solo si se quiere

**Editar por ítem desde el resumen.** Vale únicamente si es **edición en línea** (paso de
cantidad y quitar dentro del resumen, reutilizando `updateQuantity`/`removeItem` del carrito).
Como link a `/cart` duplica el botón "Editar carrito" que ya existe. Contra: el resumen del
checkout se parecería al carrito.

## 6. Fuera de alcance (no hacer sin pedido explícito)

- **Entrega** (dirección, zonas, tarifa) y **propina para el repartidor**: el MVP es solo retiro.
- **Pasarela de pago**: se paga en el local al retirar. No hay cobro online.
- **Express / prioridad paga**: además de ser producto nuevo, promete algo que el sistema no
  puede cumplir — no hay cola con prioridades, y el turno de retiro es una *preferencia* sin
  capacidad. Es la misma clase de bug que el toggle "Aceptando pedidos" que no hacía nada.
- **Tarifa de servicio e impuestos**: no existen en el modelo (`order-totals.ts` tiene subtotal,
  descuento, empaque, envío y propina).
- **ETA duplicada en el header**: el checkout ya muestra la hora en el control de retiro; un
  segundo lugar es repetir, que es exactamente lo que arregló `TASK-checkout-ux`.
- **Límite de pedidos por turno**: decisión ya tomada en contra (no hay reservas, son órdenes).

## 7. Criterios de aceptación

1. En `/admin/settings` se puede poner el mínimo y el máximo de preparación, y **se ve el efecto
   antes de guardar** (los turnos resultantes y hasta qué hora se puede pedir).
2. El checkout y la confirmación muestran "listo entre X y Y" cuando hay máximo; con el máximo
   vacío se comportan como hoy.
3. La hora guardada y la que ve la cocina **siguen siendo el mínimo**: el semáforo del admin no
   cambia de comportamiento.
4. Un máximo menor que el mínimo se rechaza con mensaje por campo.
5. Si se aprueba 5.4: el servidor rechaza una tasa que no esté en la lista configurada, y el
   monto sigue calculándose en el servidor.

## 8. Riesgos

- **Configurarse el local sin poder tomar pedidos.** Ya pasó con `isAcceptingOrders`: un control
  que el owner cree que hace algo y no lo hace. La validación cruzada (máx ≥ mín) y la vista
  previa son la red que hace seguros estos campos.
- **El rango como excusa.** Prometer "entre 1:40 y 2:00" y entregar 2:20 sigue siendo incumplir.
  El rango no reemplaza al semáforo del admin, que es el que avisa.
- **Agregar lo que el MVP no tiene.** El mock empuja a sumar pago, envío y prioridad. Cada una
  es una promesa al cliente que hoy no se puede cumplir.

## 9. Cómo verificar

```bash
# Entorno local (Postgres + seed + server)
docker compose up -d
npx prisma generate        # ⚠️ `npm run build` NO lo hace: tras tocar el schema hay que correrlo
npx prisma migrate deploy
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/oneburger?schema=public" npx tsx prisma/seed.ts
DATABASE_URL="..." APP_ENV=production NODE_ENV=production ADMIN_LOGIN_RATE_LIMIT=200 npx next start -p 3210
BASE_URL=http://127.0.0.1:3210 E2E_ALLOW_MUTATIONS=true npm run test:e2e:prod:full
```

- **Ojo con el horario:** el seed local deja el local abierto 00:00–23:59 y preparación 0 para
  que los E2E no dependan de la hora. **Producción tiene 12:00–22:00 y 25 min**, así que fuera
  de esa franja el checkout se ve bloqueado (es correcto, no es un bug).
- Verificar a **375 px** además de escritorio: el CTA fijo y el panel de turnos solo se notan ahí.
- El navegador real es obligatorio para lo visual: un test de HTML estático no ve el CSS.

## 10. Prompt para el chat nuevo

> Trabajás en `one-burger-commerce` (Next.js 16 + Prisma + Postgres, deploy en Easypanel).
> Antes de escribir código leé, en este orden: `AGENTS.md`, `ops/project-state.md`,
> `ops/production-readiness.md` y `ops/tasks/TASK-checkout-v2.md`.
> La tarea es la **mejora del checkout**: ejecutá las fases aprobadas de ese brief, en orden,
> una por commit. El brief tiene las decisiones que hay que preguntar antes de las fases 4 y 5.
> **TDD siempre**: escribí primero el test que falla, corrélo y confirmá el rojo antes de
> implementar. Nada de código antes del test.
> Trabajá en español, con commits propios, y validá con `npm run test`, `lint`, `typecheck`,
> `build` y `security:secrets` antes de cerrar cada fase. Si tocás `schema.prisma`, corré
> `npx prisma generate` (el build local no lo regenera).
> Al terminar cada fase: actualizá `ops/project-state.md`, hacé push a `main` y confirmá que el
> CI quedó verde. **No despliegues a producción sin pedirme confirmación.**
