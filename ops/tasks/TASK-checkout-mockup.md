# PLAN: qué tomar del mock de "Confirmar Pedido"

**Estado:** propuesta, esperando que Daniel elija las fases · **Origen:** `mockup/confirmar pedido.txt`
(guía del owner, **no versionada** a propósito: `.gitignore` ya excluye su carpeta de trabajo).

> Este documento audita el mock, decide qué conviene y qué no, y ordena lo que se
> implementa. Cada fase se ejecuta con TDD, validación completa y su propio commit.

## 1. Qué es el mock (verificado, no supuesto)

Un checkout de **delivery** para un restaurante mexicano: "Kinetic Appetite", dirección en
CDMX, precios en MXN. Secciones: header con ETA, barra de dirección de entrega, selector
Estándar/Express, resumen con 2 ítems editables, propina al repartidor con 4 pastillas,
desglose de costes, tarjeta Mastercard + Apple Pay + efectivo, y CTA fijo.

## 2. Veredicto

| Del mock | ¿Conviene? | Por qué |
|---|---|---|
| **Rango de preparación ("25-35 min")** | **Sí, primero** | Es exactamente lo que pidió el owner ("hoy 30, mañana 20"). Un rango es más honesto que un instante exacto y baja la fricción de "¿dónde está mi comida?". No toca contratos: es configuración + copy |
| **Presets de propina (10/15/20 + otro)** | **Sí, pero es contrato** | El servidor calcula el monto desde `settings.tipRate` y el cliente solo manda `tipOptIn`. Dejar elegir el porcentaje exige aceptarlo validado contra una lista. Ver §5.3 |
| **Editar cada ítem desde el resumen** | **Opcional, al final** | Útil de verdad: hoy "Editar carrito" te saca de la pantalla y se pierde lo que escribiste. Pero si es un link, duplica al botón que ya existe; solo vale si es edición en línea |
| **"Agregar más" desde el resumen** | **Opcional** | Mismo caso. Barato, pero no urgente |
| **Desglose con jerarquía y total destacado** | Ya lo tenemos | El mock confirma el patrón, no aporta nada nuevo |
| **ETA visible en el header** | No por ahora | Nuestro checkout ya muestra la hora en el control de retiro, que es donde importa. Un segundo lugar es repetir (ver `TASK-checkout-ux.md`) |

## 3. Lo que NO se hace, y por qué

| Del mock | Motivo |
|---|---|
| Dirección de entrega, "Tarifa de entrega", zona | El MVP es **solo retiro en el local** (`AGENTS.md`). La tarea de whitelabel ya sacó la promesa de envío del carrito |
| "Propina para el repartidor" | No hay repartidor: se retira en el local. La propina es para el negocio |
| Mastercard, Apple Pay, Efectivo, "autorizas el cargo" | No hay pasarela: **se paga en el local al retirar**. Es el punto más delicado del mock porque empuja a cobrar online |
| **Express +$19 "prioritario"** | Producto nuevo, y además **una promesa que el sistema no puede cumplir**: no hay cola con prioridades. Choca con lo que se acaba de construir, donde el turno de retiro es explícitamente una *preferencia* sin capacidad |
| "Tarifa de servicio" e "Impuestos incluidos" | No existen en el modelo: `order-totals.ts` solo tiene subtotal, descuento, empaque, envío y propina |
| `$` / "MXN" | La moneda y el locale son configurables (`C$`, es-NI) |
| Plus Jakarta Sans, Material Symbols y Tailwind por CDN | El build es hermético (`next/font/local`, Fraunces + Inter). Como guía visual sirve; el modo de carga no |

## 4. Bugs del mock que no hay que arrastrar

- **Las cuentas no cierran con su propio estado resaltado.** El HTML marca la propina de
  **15 % ($45)** como seleccionada, pero el estado aplica `tip: 25` y desmarca Express. Con
  el 15 % marcado el total debería ser **$352**, no los **$332** que muestra. El autor lo
  dejó anotado en el código: *"$300 + $7 + $19 + $25 = $351, wait: 300 + 7 + 25 = 332"*.
  Los números están acomodados a mano: **no sirve como fuente de verdad del cálculo**.
  La nuestra sigue siendo `calculateOrderTotals`, que ya está probado.
- `onclick="alert(...)"` y `prompt(...)` como placeholders de interacción.
- El CTA simula el éxito con un `setTimeout`, sin backend.
- `h-13` no existe en Tailwind (clase inválida).
- "Fijar $25" con subtítulo "Otro / No": mezcla monto fijo con "ninguna".

## 5. Fases, en orden

El orden es por **relación impacto/costo y por dependencias**, no por lo que aparece primero
en el mock.

### 5.1 — Rango de preparación (mín–máx) · sin dependencias

**Qué gana el negocio:** el cliente sabe entre qué horas esperar, en vez de un instante que
la cocina puede fallar. Es la versión concreta de "hoy 30, mañana 20".

- `pickupMaxMinutes` opcional en `BusinessSettings` (**migración**) + zod: entero, mayor o
  igual a `pickupLeadMinutes`, tope 240. Vacío = sin rango (comportamiento actual).
- Campo en `/admin/settings` → Operación, al lado de "Minutos de preparación".
- **Vista previa en vivo** en el admin (mismo patrón que la de colores): con la
  configuración que se está editando, muestra los turnos que vería el cliente y hasta qué
  hora se puede pedir. Es lo que hoy falta: escribís 25 y no ves que eso significa
  "última orden 21:35".
- Copy del checkout: "Lo antes posible · listo entre 1:40 y 2:00 p. m.", y la fila
  "Hora de retiro" de la confirmación.
- **La hora que se guarda sigue siendo el mínimo** y el ticket de cocina sigue mostrando
  una hora concreta: el rango es copy para el cliente, no un dato operativo. El semáforo
  del admin no cambia.

**TDD:** el formateo del rango y la validación del zod primero; después el campo y el copy.

### 5.2 — El campo de preparación se explica solo · depende de 5.1

Ya lo pidió el owner por separado: la etiqueta dice "Minutos de preparación" y la ayuda
"Entre 0 y 180", que es la validación y no para qué sirve. Se reescribe la ayuda para que
diga qué hace (mínimo antes del primer retiro, y define hasta qué hora se puede pedir) y se
muestra el valor derivado al lado. Va junto con 5.1 porque es el mismo campo.

### 5.3 — Presets de propina · **requiere una decisión del owner**

Hoy el servidor es la fuente de verdad: `create-order.ts` calcula el monto con
`tipPolicy.rate` (la configuración) y del cliente solo acepta `tipOptIn` (booleano). **Dejar
elegir el porcentaje es cambiar el contrato**, no la UI.

- Opción A (recomendada): los presets **se configuran** en ajustes (por ejemplo 0/10/15/20) y
  el servidor acepta únicamente una tasa de esa lista; el monto se sigue calculando en el
  servidor. Mantiene el invariante "el monto nunca viene del cliente" y le da control al
  negocio.
- Opción B: un monto libre. **No la recomiendo**: rompe el invariante que sostiene el
  diseño de la propina y agrega superficie de abuso.
- En los dos casos la propina sigue **opcional y desmarcada por defecto** (`AGENTS.md`); el
  mock la prende en 15 %.

**TDD:** la validación de la tasa contra la lista, primero; después el payload y la UI.

### 5.4 — Editar por ítem desde el resumen · opcional, última

Solo vale si es **edición en línea** (paso de cantidad y quitar dentro del resumen,
reutilizando `updateQuantity`/`removeItem` del carrito). Como link a `/cart` duplica el
"Editar carrito" que ya existe. Contra: el resumen del checkout se parecería al carrito.
Decidir si se quiere.

## 6. Criterios de aceptación (lo que cierra el plan)

1. En `/admin/settings` se puede poner el mínimo y el máximo de preparación, y **se ve el
   efecto antes de guardar** (turnos resultantes y última orden del día).
2. El checkout y la confirmación muestran "listo entre X y Y" cuando hay máximo; con el
   máximo vacío se comportan como hoy.
3. La hora guardada y la que ve la cocina **siguen siendo el mínimo**: el semáforo del
   admin no cambia de comportamiento.
4. Un máximo menor que el mínimo se rechaza con mensaje por campo.
5. Si se aprueba 5.3: el servidor rechaza una tasa de propina que no esté en la lista
   configurada, y el monto sigue calculándose en el servidor.

## 7. Riesgos

- **Configurarse el local sin poder tomar pedidos.** Ya pasó con `isAcceptingOrders`: un
  control que el owner cree que hace algo y no lo hace. Por eso la validación cruzada
  (máx ≥ mín) y la vista previa: son la red que hace seguros estos campos.
- **El rango como excusa.** Prometer "entre 1:40 y 2:00" y entregar a las 2:20 sigue siendo
  incumplir. El rango no reemplaza al semáforo del admin, que es el que avisa.
- **Duplicar lo que ya está.** El mock empuja a agregar secciones que el MVP no tiene
  (pago, envío, prioridad). Cada una de esas es una promesa al cliente que hoy no se puede
  cumplir.

## 8. Deuda menor encontrada al auditar (fuera del mock)

- **El prefijo de WhatsApp por defecto está fijo en `+505`** (`whatsapp-input-value.ts:20`).
  Para una plataforma whitelabel es un dato del negocio escrito en el código, igual que lo
  eran el teléfono y la moneda. Debería salir de la configuración o derivarse del teléfono
  del negocio.
- **Decidir qué hacer con `mockup/`**: hoy está sin versionar y correctamente ignorado por
  la convención del `.gitignore`. Si se quiere citar como guía, mover a `ops/` con una nota;
  si es material de paso, dejarlo afuera.

## 9. Prompt para un chat nuevo

> Trabajás en `one-burger-commerce` (Next.js 16 + Prisma + Postgres, deploy en Easypanel).
> Antes de escribir código leé, en este orden: `AGENTS.md`, `ops/project-state.md`,
> `ops/production-readiness.md` y `ops/tasks/TASK-checkout-mockup.md`.
> Ejecutá las fases aprobadas de ese plan, en orden, una por commit.
> **TDD siempre**: el test que falla va primero, se corre y se confirma el rojo antes de
> implementar. Trabajá en español y validá con `npm run test`, `lint`, `typecheck`, `build`
> y `security:secrets` antes de cerrar cada fase.
> Si tocás `schema.prisma`, corré `npx prisma generate` (el build local **no** lo regenera).
> Al terminar cada fase: actualizá `ops/project-state.md`, push a `main` y confirmá el CI
> verde. **No despliegues a producción sin pedirme confirmación.**
