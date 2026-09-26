# Spec de pantalla — Órdenes (`/admin/orders`)

> **Plantilla**: [`TEMPLATE.md`](TEMPLATE.md). **Estado**: discovery + arquitectura + IA definidos en
> `TASK-ORDERS-001` (2026-09-26). La **composición nueva** (toolbar, carriles y detalle) queda especificada y
> prototipada en [`orders-prototype.html`](orders-prototype.html); su implementación se hace por partes, con la
> revisión del owner, sin romper las reglas del dominio.
>
> **Prohibiciones que esta spec respeta**: no inventa estados ni métricas, no toca dinero, no mueve reglas del
> dominio a React, no hardcodea sucursales y **no mezcla Caja, Analytics ni configuración** dentro de Órdenes.

---

## Ruta

`/admin/orders` (pantalla) y `/admin/orders/[id]` (detalle), más `/admin/orders/[id]/invoice/print` (hoja de
80 mm, fuera de pantalla).

## Módulo

**`orders`** es el dueño: estados, transiciones, SLA de etapas, totales y acciones sobre el pedido
([`../../product/MODULE_ARCHITECTURE.md`](../../product/MODULE_ARCHITECTURE.md) §5). Órdenes **consume**
`locations` (umbrales por local y punto de retiro), `business-settings` (zona horaria, moneda) e `invoices`
(factura). **No es dueña** de cobros ni de arqueos: cobrar vive en el POS y devolver en Caja/Aprobaciones.

## Usuario / roles

| Rol | Qué hace acá | Hoy |
|---|---|---|
| `owner` | todo | ✓ |
| `manager` | opera y audita el turno | ✓ |
| `kitchen` | acepta y avanza comandas; **no** maneja plata | ✓ (pero el detalle le muestra montos, PIN y factura) |
| `cashier` | **no opera órdenes** (`canManageOrderOperations` no lo incluye) | ⚠️ la entrada le aparece y la API le responde 403 (§ *Fuera de scope*, decisión del owner) |

## Propósito

Una frase: **mover los pedidos del turno de hoy de "entró" a "entregado", sin perder ninguno y viendo primero
lo que está por vencerse.** Todo lo demás (buscar un pedido viejo, revisar la factura, el historial de cierres)
es secundario y vive en su propia pantalla.

## Preguntas

1. **¿Qué tengo que hacer ahora?** ( nuevos sin confirmar, atrasados, listos para entregar)
2. **¿Cuánto falta para que algo se venza?** (tiempo en la etapa actual vs umbral del local)
3. **¿Este pedido es el que busco?** (número, cliente, WhatsApp, PIN, local, tipo, forma de pago)
4. **¿Qué le pasó a este pedido?** (detalle: recorrido, ítems, totales, cobros, factura)

## Decisiones

- Se decide **aceptar o rechazar** un pedido nuevo, **avanzar de etapa** y **cerrar**.
- Se decide **emitir la factura** (si el rol puede cobrar) e **imprimir** el ticket del cliente.
- **No** se decide acá: cobrar (POS), devolver (Caja), anular un cobro (Aprobaciones), editar el menú, ni tocar
  la configuración del local.

## Datos disponibles

Todo lo que la spec necesita **ya existe** (`GET /api/admin/orders` y `GET /api/admin/orders/:id`): estado,
`stageChangedAt`, `readyAt`, `pickupTime`, `pickupScheduled`, ítems con modificadores y notas, totales, medio de
pago, PIN, `locationName`, `payments[]` (detalle) y `averagePrepMinutes` (meta). **No se pide ningún dato
nuevo** y **no hay `FALTA`** para esta sección.

**No se muestra** (no existe o no corresponde): tiempo por etapa de cada pedido (solo el último cambio y el
primer `ready`), quién cambió el estado, e historial crudo de estados.

## Jerarquía

```text
1. QUÉ HACER AHORA      → carriles por etapa + contadores + señales de atraso
2. EL PEDIDO             → número, cliente, hora prometida, urgencia, ítems
3. LA ACCIÓN             → una sola acción primaria por pedido
4. ENCONTRARLO           → búsqueda, local, tipo, pago, atrasados
5. CONTEXTO DEL TURNO    → preparación promedio, frescura de los datos, aviso sonoro
```

Lo que **se elimina** de la pantalla actual (clasificación del discovery):

| Elemento actual | Clase | Por qué |
|---|---|---|
| Carriles por etapa + contadores + acción primaria por tarjeta | **MANTENER** | Es el corazón de la sección y ya está bien resuelto |
| Búsqueda con debounce + filtros en URL + «Limpiar filtros» | **MANTENER** | Resuelve "encontrarlo" sin ruido |
| Umbrales **por local** (`acceptAlertMinutes`/`prepAlertMinutes`) | **MANTENER** | Es la única fuente correcta del semáforo |
| Modo cocina (una columna, tipografía grande) | **MANTENER** | Es el uso real en cocina |
| Cabecera `AdminPageHeader` con descripción larga | **SIMPLIFICAR** | En modo cocina no se dibuja y en móvil come alto: la pantalla es una bandeja, no una landing |
| Dos contadores del mismo dato (`comandaCounters` en la página **y** en el tablero) | **SIMPLIFICAR** | Un solo cálculo, una sola fuente |
| Cinco mapas estado→etapa (`comandaLane`, `orderBucket`, `getAdminOrderSolidStatus`, `ORDER_JOURNEY`, `DISPATCHED_STATUSES`) | **SIMPLIFICAR** | Un mapa canónico por intención (carril, grupo, chip, recorrido) |
| Cuatro formateadores de tiempo | **SIMPLIFICAR** | Un formateador de "hace cuánto" y el semáforo de retiro |
| Tarjeta resumen «Órdenes en vista» (solo tab Cerradas) | **ELIMINAR** | Repite los contadores de los tabs |
| Chip «Esperando solicitudes» con `animate-pulse` | **CORREGIR** | El pulso está reservado a SLA vencido/desincronización (`MOTION.md`) |
| Punto de «Nuevas» con `animate-pulse` en la toolbar | **CORREGIR** | Ídem: el número ya comunica |
| Copy «hoja A4» | **CORREGIR** | La hoja es de **80 mm** (`invoice-print-sheet.tsx`) |
| `text-st-*` (alias histórico) en 9 archivos | **CORREGIR (por sección)** | DS v4 pide `text-panel-*`; se migra acá, no en bloque |
| `rounded-md` en bloques de estado/error | **CORREGIR** | El radio del panel es `rounded-stitch-md` |
| Alias viejos de color (`bg-danger`, `bg-warning`, `border-border`, `--accent` en sombra) | **CORREGIR** | DS v4: intención semántica (`status-sla-*`, `line-control`, `elevation`) |
| Anuncio accesible de atraso con umbrales **por defecto** | **CORREGIR** | El tablero usa los del local: el anuncio tiene que usar los mismos |
| Detalle que reimplementa la acción primaria y el rechazo | **SIMPLIFICAR** | Tiene que usar la misma pieza que la tarjeta |
| Detalle que muestra montos, PIN, cobros y factura a `kitchen` | **CORREGIR** | Cocina no maneja plata |
| Precios/PIN ausentes en la tarjeta de comanda | **MANTENER** | Es una decisión explícita del KDS (no filtrar dinero al salón) |
| Fechas del detalle con `toLocaleString()` del navegador | **CORREGIR** | La lista usa la zona del negocio |
| `/api/admin/orders/[id]/delivery-fee` sin llamador | **MOVER (al backlog)** | Fuera del MVP: no se toca |
| `cashier` viendo la entrada Órdenes y recibiendo 403 | **CORREGIR (decisión del owner)** | Va en *Fuera de scope* |

## Acciones

| Acción | Label | Dónde |
|---|---|---|
| Primaria del pedido | **Aceptar · Preparando · Terminado · Entregada · Servida · Cerrar** (según la etapa) | Tarjeta (KDS) y detalle |
| Rechazar | **Rechazar** → **Confirmar rechazo** (motivo obligatorio) | Detalle (y tarjeta de pedido nuevo) |
| Factura | **Emitir factura** · **Imprimir o guardar PDF** | Detalle (solo quien puede cobrar) |
| Ticket del cliente | **Reimprimir ticket** | Detalle |
| Navegación | **Volver a órdenes** | Detalle |

**Una sola acción primaria por contexto visual** (ya es la ley del `OrderActions` actual y se conserva).

## Estados

Cargando · con datos · sin pedidos en el rango · sin coincidencias (con el término buscado) · error sin datos ·
error con datos (bandeja vieja) · sin permiso · carril vacío (copy propio por carril).

## Empty / error / loading

- **Vacío**: "Sin órdenes en este rango" + "No hay órdenes para los filtros seleccionados."
- **Sin coincidencias**: "Sin coincidencias" + «Ninguna comanda coincide con «{término}».» (hoy existe **solo**
  en el tablero: la spec lo lleva también a la vista de lista).
- **Error con datos**: "No se pudo actualizar la bandeja. Última actualización hace N min." + Reintentar.
- **Sin permiso**: mensaje propio de permiso (hoy dice "Sesión de administrador requerida", que **miente**
  cuando hay sesión y falta el permiso).

## Desktop

A 1280: tres carriles en columnas con scroll propio, toolbar pegada arriba, cabecera en una fila; el 80 % del
alto es bandeja.

## Tablet

A 768: **un carril por vez** con el conmutador (el corte de tres columnas es `lg` = 1024) y la toolbar envuelta
en dos filas.

## Mobile

A 375: un carril por vez, conmutador visible, toolbar en tres filas que envuelven sin scroll horizontal,
buscador a todo el ancho y barra inferior de navegación respetada (`pb-24`).

## Qué se elimina

La tarjeta resumen «Órdenes en vista», el pulso de "Esperando solicitudes" y del punto de "Nuevas", la
descripción larga de la cabecera en modo bandeja, los contadores duplicados y los mapas/formateadores
repetidos. **Nada de eso cambia lo que el usuario puede hacer**: son ruido o duplicación.

## Estado de implementación (`TASK-ORDERS-001`)

Entregado en la rama de la TASK, con test y capturas ([`orders-after-1280.png`](orders-after-1280.png),
[`orders-after-375.png`](orders-after-375.png), detalle incluido):

| Cambio | Evidencia |
|---|---|
| Pulso fuera de reposo: chip «Esperando solicitudes» y punto de «Nuevas» (queda solo el SLA vencido) | Test de la toolbar y del carril + QA de navegador |
| Copy de la factura: hoja de **80 mm** (impresora térmica), no A4 | `order-invoice-panel.test.tsx` |
| Radio del panel (`rounded-stitch-md`) en bloques de estado y error | Contrato de UI |
| Anuncio accesible de atraso con el **umbral del local** (antes, el de por defecto) | Test que discrimina por umbral del local |
| Barra compacta en celular: contadores solo en escritorio, «Atrasados» y los controles del turno como íconos, tipo de pedido sin ancho fijo | QA 375/768/1280, sin scroll horizontal |

**Queda como deuda documentada** (hallazgos del discovery de la TASK, registrados en
[`ops/audit-backlog.md`](../../audit-backlog.md), no corregidos de paso):

- El detalle muestra montos, PIN, cobros y factura al rol `kitchen` (cocina no maneja plata).
- `GET /api/admin/orders` devuelve `orderLookupTokenHash` y campos de GPS que la pantalla no usa, ignora
  `lateOnly`/`limit` y no pagina.
- El filtro de **estado** no vive en la URL como los demás filtros.
- Fechas del detalle con `toLocaleString()` del navegador, no con la zona del negocio.
- Cinco mapas estado→etapa y cuatro formateadores de tiempo duplicados; `scheduledForAnotherDay` con
  `includes` dentro de un bucle.
- Alias históricos (`text-st-*`) y colores semánticos viejos en la sección, con techo de deuda propio.

## Fuera de scope

- **Cobrar** (POS), **devolver** (Caja) y **anular un cobro** (Aprobaciones): siguen en su sección dueña.
- **Decisión del owner (bloqueante para una parte)**: qué pasa con `cashier`. Hoy la entrada Órdenes le
  aparece, la API le responde **403** y la pantalla le dice "Sesión de administrador requerida". Las dos
  salidas posibles —(a) sacarle la entrada y hacer que su pantalla de inicio sea el POS, (b) darle un modo
  acotado de Órdenes— son **producto**, no inferibles: la spec no las decide.
- **Precios y PIN en la tarjeta del KDS**: se mantiene la decisión (no se filtra dinero al salón).
- **Historial (Cierres y Facturas)**: otra sección.
- **Delivery y mesas**: fuera del MVP.
- Reescribir el módulo `orders`: la spec **no** cambia dominio, puertos ni endpoints.
