# Estado real de la Fase 2 (POS completo) — inventario

> **Actualización 2026-09-17 (ronda de implementación)**: este documento es el inventario medido del
> 2026-09-17 y **sigue siendo la línea de base**. Lo que se va cerrando queda acá abajo en
> «Requiere decisión» y en el registro de bloques; el estado detallado por tarea no se reescribe para
> no perder la foto original (la evidencia de cada archivo está en el commit que lo cerró).

## Ronda del roadmap del owner (2026-09-18) — cuatro puntos

| # | Punto | Estado | Evidencia |
|---|---|---|---|
| 1 | **Layout unificado de Órdenes** (opción (a): carriles conservados, chrome siempre visible, sin sub-filtro Hoy/Historial) | **cerrado** | commit `a83e3a1` · deploy `build-20260918-145218` · capturas `tarea-layout-ordenes-*-produccion-*.png` |
| 2 | **Sección Historial** (`/admin/history` con tabs `/cierres` y `/facturas`, anulación de facturas con motivo obligatorio y soft delete) | **cerrado** | commit `2b86bb9` · deploy `build-20260918-152408` · capturas `tarea-historial-*` (locales y de producción) |
| 3 | **Modo cocina opt-in** (botón en la toolbar de Órdenes, `localStorage` por dispositivo, oculta sidebar y header, «Salir», tabs de cocina con «Despachadas hace poco») | **cerrado** | commit `398f0c8` · deploy `build-20260918-163329` · capturas `tarea-punto3-modo-cocina-*-1280/375.png` · E2E `admin-comandas.spec.ts` («Punto 3») |
| 4 | **Checkbox fiscal en el POS** («Cliente pide factura con RUC» → RUC mínimo 8 + razón social, guarda en `Customer` y congela en la factura) | **cerrado** | commits del cierre · capturas `tarea-punto4-pos-factura-*-1280/375.png` · E2E `admin-pos.spec.ts` («Punto 4») |

> **Nota del Punto 4 (2026-09-18)**: el punto pide los **datos del cliente** (RUC y razón social), no el RUC
> del negocio: la factura sigue siendo **simple, no fiscal**, y quién la imprime con la hoja del sistema ya
> estaba decidido (A-20). Eso queda anotado como **A-34** en el backlog.
>
> **Nota del Punto 3**: el listado agrupado de Órdenes quedó **inalcanzable** con el layout unificado del
> Punto 1 y por eso el caso D1 del E2E ya no puede comprobar el grupo «Programados»; es la decisión abierta
> **A-33** del backlog (dónde se mira el listado completo).

> Lo que sigue de la Fase 2 del POS (los bloques 1.x a 13.x de este inventario) conserva el estado que
> tiene más abajo. El **Punto 3** toca la pantalla de Órdenes y el **Punto 4** el POS: ninguno de los dos
> reabre tareas cerradas.

## Requiere decisión (lo que NO se puede implementar sin respuesta del owner)

1. **9.1 «POS limpio sin tab de Caja»** — ¿el cajero abre y cierra la caja desde `/admin/cash` (hoy
   solo lectura, de dueño/manager) o se deja dentro del POS? Si se mueve, hay que decidir si el cajero
   gana `canManageCash` **para su propio turno**, que es justo lo que el 7.1 quiere evitar.
2. **2.5/2.6 límite de retiro sin aprobación y aprobación de movimientos grandes** — el modelo y la UI
   están (Bloque 2); falta el **monto** del límite y **quién** aprueba. Default conservador aplicado:
   **no hay límite configurado, así que todos los movimientos se registran y quedan con
   `approvedByUserId` en `null`** (nada se auto-aprueba).
3. **1.7 cierre obligatorio configurable** — ¿es un campo de Personalización (global) o por sucursal
   (como el POS)?
4. **1.8 alerta por turno abierto >24 h** — ¿sale por panel o necesita notificación externa (hoy en
   pausa, `NOTIFICATIONS_DRIVER=dummy`)?
5. **1.11 cierre ciego** — ¿lo habilita el owner por configuración o depende del rol que cierra?
6. **1.9 el operario no ve detalles al cerrar** — ¿qué exactamente no ve: el esperado, la diferencia o
   ambos?
7. **3.7 aviso al dueño si la devolución supera X** — falta el **monto** del umbral y el canal: hoy no
   hay notificación externa (`NOTIFICATIONS_DRIVER=dummy`), así que un aviso real necesita decidir si
   vuelve Telegram, correo u otra cosa.
8. **Bloque 3.2, doble control** — hoy **quien tiene `canManageCash` y pide la devolución la deja
   aprobada de una**; el cajero siempre queda pendiente. Si el owner quiere que **nadie** apruebe la
   suya (ni el manager), es un cambio de una línea y hay que decirlo: hoy el caso de uso prioriza que
   la devolución no quede trabada sin nadie que la firme.
9. **11.1/11.2 cuadre contra un lote externo** — ¿contra qué se concilia la tarjeta (el cierre de la
   terminal, el depósito del banco, la liquidación del proveedor de pagos) y la transferencia (el
   extracto)? Sin eso, la pantalla mostraría un número al lado de otro sin decir si está bien.
10. **11.4 email al dueño** — **NO APLICA** (decisión del owner, 2026-09-17): no se manda correo, todo sale
    por **Telegram** (un solo grupo del dueño para todas las sucursales). No hay proveedor de email ni se
    busca uno: era el último pendiente que pedía una dependencia nueva, y se descartó.
11. **12.1 modo offline del POS (IndexedDB + sync)** — cobrar sin conexión y sincronizar después necesita
   decidir la **idempotencia del cobro offline** y qué pasa si el mismo pedido se registra dos veces (hoy
   el anti doble submit es del servidor: `Order.idempotencyKey`). Sin esa definición, implementarlo es
   riesgo de cobrar dos veces. Lo que **sí** quedó hecho (12.3/12.4) es no perder la venta armada y
   bloquear el cobro sin red con el motivo escrito.

## Registro de bloques cerrados en la ronda de implementación

| Bloque | Qué se cerró | Commits | Captura |
|---|---|---|---|
| **8** | Grupos Operación/Control/Catálogo/Configuración, permiso `canManageCash`, «Caja»→«POS», rutas `/admin/cash`, `/admin/cash/history/[id]` y `/admin/approvals` | `b5f07dd`, `7ff20e0`, `fcc0691`, `50ac7f2`, `d0ea932` | `bloque-8-*.png` |
| **1** | `expectedByCurrency` y `cashSalesAmount` persistidos, historial y detalle del cierre, reapertura firmada | `7ff20e0`, `fcc0691` | `bloque-1-cierre-detalle-*.png` |
| **9.2** | Sin caja abierta no se cobra (409 en el servidor + botón bloqueado y motivo en pantalla) | `50ac7f2` | `bloque-9-cobro-bloqueado-*.png` |
| **2** | `CashMovement` (retiro/ingreso con categoría, motivo y responsable), afecta el esperado por moneda y el `cashMovementsAmount` del cierre, rutas y UI con historial | `eb2f7f6` | `bloque-2-movimientos-*.png` |
| **3** | Modelo `Refund` (total/parcial, estado, medio original, firma), resta al arqueo solo lo **aprobado en efectivo**, casos de uso `requestRefund`/`reviewRefund` (no se devuelve más de lo cobrado; nadie firma su propia devolución), **void del cobro** (devolución total), **cancelar un pedido cobrado deja la devolución pendiente y avisa** (A-15) y `/admin/approvals` con la cola real | `32a8eb1`, `7f60017`, `3a9fb82` | `bloque-3-aprobaciones-*.png` |
| **4** | Transferencia y **cobro partido** en el POS: el payload acepta efectivo, tarjeta, transferencia y otro (con referencia), la pantalla arma N cobros y el vuelto **solo** existe en un cobro único en efectivo | `ace1428` | (sin captura: la UI del POS ya está en `bloque-9-*.png`) |
| **7** | `canRefund` y `canViewCashHistory` como puertas propias (con `canManageCash`), cada ruta y cada página usando la suya | `e9d1fa7` | — |
| **10.1** | **Ticket de cocina**: `kitchen-ticket.ts` (puro, sin importes, con la hora prometida en la zona del negocio y los modificadores) y «Ticket de cocina» en el POS, impreso con la hoja del sistema | `917f434` | (sin captura: es una ventana del navegador) |
| **11.3** | **Export CSV de cierres**: `shift-csv.ts` (puro, separador `;`, números crudos, turno abierto con celdas vacías, escapado) y «Exportar CSV» en el historial | `57934ce` | — |
| **13.1** | **Log de acciones sensibles**, completo: el módulo `audit` (lista cerrada de 9 acciones, best-effort, `AuditError` en el mapeo) y el modelo `AdminAuditLog` (migración `20260918070000`), **cableado** a las 9 acciones: abrir/cerrar/reabrir turno, movimiento de caja, pedir/aprobar/rechazar devolución, cancelar un pedido cobrado y cambiar la personalización. El gate de la tabla de atajos falla si una acción de la lista queda sin forma de firmarse | `605870b`, `82349a1` | — |
| **13.3** | **Firma del cierre**: «Imprimir cierre» en el detalle del turno y la hoja en texto plano (`shift-close-sheet.ts`, pura) con el arqueo asentado, el **nombre** de quien cerró (antes se mostraba el `userId` crudo) y la línea de firma. Imprime con la hoja del sistema, sin dependencias | `d2a06f3` | `bloque-13-boton-imprimir-cierre-*.png`, `bloque-13-hoja-cierre-impresa-*.png` |

| **10.2 + 10.4** | **Ticket de cliente y reimpresión**: `customer-ticket.ts` (puro, 15 casos) con el comprobante —precios, total, medio de pago y cambio—, los dos papeles en la confirmación de la venta (`pos-ticket-buttons.tsx`) y «Reimprimir ticket» en el detalle del pedido (`order-ticket-button.tsx`). Imprimir un texto se unificó en `print-lines.ts`, con el escapado arreglado | `43b1a48` | `bloque-10-botones-ticket-*.png`, `bloque-10-ticket-cliente-*.png` |

| **11.5 + 11.6** | **Cierre del día consolidado y comparación entre sucursales**: `day-close.ts` en el dominio (totales del día y agrupación por sucursal, 8 casos) y el panel server-side en `/admin/cash`, con el día del **negocio** (`business-days.ts`, movido a `shared/lib` para que la bandeja de órdenes y la caja hablen del mismo día) | `3d06118` | `bloque-11-cierre-del-dia-*.png` |

| **12.3 + 12.4** | **La venta en curso no se pierde y sin red no se cobra**: `usePosDraft` + `pos-draft-storage.ts` (la venta se guarda en el dispositivo y se recupera al montar; de un solo local; vaciarla la borra) y `useOnlineStatus` con el cobro bloqueado y explicado cuando no hay red | `58f0b03` | `bloque-12-sin-conexion-*.png`, `bloque-12-venta-recuperada-*.png` |
| **6** | **Dólares — cerrado**: el saldo por moneda se **persiste** al cerrar (`Shift.expectedByCurrency` + `cashSalesAmount`, Bloque 1.1) y se muestra en el detalle; sin arrastre automático entre turnos, por diseño | `7ff20e0`, `fcc0691` | `bloque-1-cierre-detalle-*.png` |
| **1.6** | **Comprobante de cierre — cerrado por decisión del owner (2026-09-17)**: se queda como está (DIFERENTE): no hay PDF generado en el servidor; el cierre se imprime o se guarda como PDF desde la hoja del sistema (`shift-close-sheet.ts` + «Imprimir cierre», Bloque 13.3) | `d2a06f3` | `bloque-13-hoja-cierre-impresa-*.png` |
| **Alertas Telegram** (Parte 3 del brief del 2026-09-17) | **Sección nueva**: tabla `NotificationSettings` (chat, eventos, umbrales, último envío/error), gateway propio contra `api.telegram.org` (fetch nativo, sin dependencias, con el token **solo** por entorno y los motivos de fallo traducidos), casos de uso (leer, guardar, **probar conexión real**), rutas `GET/PATCH /api/admin/settings/notifications` + `POST …/test` (solo owner) y la pantalla `/admin/settings/notifications` | `516b2d5`, `733c87e`, `a018581` | `alertas-telegram-*.png` |
| **Tarea 1 del brief** (2026-09-17) | **POS limpio, caja aparte**: el arqueo salió del POS (`pos-client.tsx` 1029 → 870 líneas, con el estado de la caja y el enlace) y vive en `/admin/cash` (`cash-drawer-panel.tsx`), con dos mitades y dos permisos: **operar** (`canUsePOS`) y **auditar** (`canViewCashHistory`) | `5871131` | `bloque-8-caja-del-dia-*.png` |
| **Tarea 2 del brief** | **Límite de retiro configurable y sin aprobación**: `BusinessSettings.withdrawalLimit` + `CashMovement.withdrawalLimitAmount` (el vigente **congelado** al registrar), regla `isOverWithdrawalLimit` (estricta y solo para retiros) y el aviso «Sobre el límite de C$X» en el historial | `a1babfe` | `bloque-2-movimientos-*.png` |
| **Tarea 3 del brief** | **Cierre obligatorio por sucursal**: `Location.requireShiftClose` + `mustCloseShiftBeforeCharging`; con la caja de otro día abierta, el POS no cobra y explica por qué | `2431f02` | `bloque-9-cobro-bloqueado-*.png` |
| **Tareas 5 y 6 del brief** | **Qué ve quien cierra**: el operario ve «Cierre registrado», el id del turno y la diferencia; quien audita ve además contado, esperado y el detalle por moneda. Sin cierre ciego (decisión del owner: la diferencia se ve al cerrar) | `731aa4d` | `bloque-1-cierre-detalle-*.png` |
| **Tarea 9 del brief** | **Solo el dueño aprueba devoluciones**: `canApproveRefund` (owner) en las rutas y en la pantalla, y `requestRefund` nace **siempre** `pending`: nadie aprueba la propia (un owner que pide una devolución no puede aprobarla) | `dea1e38` | `bloque-3-aprobaciones-*.png` |
| **Tarea 7 del brief** | **Corte X y traspaso de caja (1.12/1.13)**: `previewShiftArqueo` (la **misma** cuenta que el cierre, sin cerrar el turno) + `GET /api/admin/pos/shift/x`, el papel `shift-x-sheet.ts` con dos firmas y la aclaración de que **no** cierra la caja, y el **traspaso guardado**: tabla `ShiftHandover` (migración `20260918110000`, esperado congelado), `registerShiftHandover`/`listShiftHandovers`, `GET/POST /api/admin/pos/shift/handover`, acción auditada `shift.handover` y el panel en Caja del día | `e6e36f7` | `tarea-7-*.png` |
| **Tarea 10 del brief** | **Conciliación de tarjeta y transferencia (11.1/11.2)**: dominio `payment-reconciliation.ts` (efectivo afuera; totales **por moneda**, sin convertir con la tasa de hoy; lo que no es tarjeta ni transferencia se informa aparte), `listReconciliationPayments` (día del negocio y local), `GET /api/admin/cash/reconciliation`, el CSV `payment-reconciliation-csv.ts` con la **referencia** del voucher al lado del monto, y el panel «Conciliación» en Caja del día con la descarga. Los primitivos del CSV se extrajeron a `shared/lib/csv.ts` (los comparten los dos exports) y bajar un archivo quedó en `shared/lib/download-file.ts` | este mismo commit | `tarea-10-conciliacion-*.png` |
| **Bug de producción encontrado y arreglado en la tarea 10** | **Cobrar con tarjeta en el POS devolvía 400**: `registerPosSale` mandaba siempre el «con cuánto paga» al alta del pedido y `createOrder` rechaza ese campo cuando la forma declarada no es efectivo («El vuelto solo se calcula cuando pagás en efectivo»). Los tests del caso de uso no lo veían porque doblan `createPosOrder`; apareció cobrando con tarjeta de verdad para la conciliación. Ahora el monto solo viaja si el pedido declara efectivo (la cobertura del cobro se sigue midiendo igual) y hay un test que lo fija | `bfacc35` | — |
| **Tarea 11 del brief** | **Idempotencia del cobro con UUID (12.1/12.2)**: la clave del intento vive con el borrador en el dispositivo (`pos-draft-storage` + `usePosDraft`), así que **sobrevive a la recarga** —antes se perdía justo cuando hacía falta—; `pos-sale-attempt.ts` genera y valida el UUID. El servidor, al reconocer el intento, **no registra los cobros otra vez** (registrarlos duplicaba la plata del arqueo), devuelve `reused` y la ruta responde 200; el POS avisa «ya estaba registrada: no se cobró de nuevo» | `df938ee` | (sin captura: el cambio visible es el aviso del reintento, cubierto por unit + E2E) |
| **Tarea 1.2 del roadmap** (2026-09-17) | **Desglose por medio de pago al cerrar**: `Shift` guarda tarjeta, transferencia, otras formas y propinas (migración `20260918130000`), congeladas con el resto del arqueo desde `summarizeShiftPayments` (los **mismos** cobros del arqueo, sin recalcular). El detalle del cierre lo muestra en «Cobros por medio» y un cierre anterior al cambio lo dice con palabras en vez de mostrar ceros | este mismo commit | `tarea-1-2-cobros-por-medio-*.png` |
| **Cierre de caja por evento** (decisiones del owner, 2026-09-17) | **Un mensaje por cada cierre, sin hora fija**: el evento `shift_closed` reemplaza al «resumen diario» (que nunca se disparó solo) y a la alerta suelta de diferencia; el toggle «Cierre de caja» nace **prendido** (migración `20260918120000`) y el grupo es **uno solo del dueño** para todas las sucursales. El mensaje sale con el formato que fijó el owner —sucursal, quién cerró, turno con duración, pedidos, efectivo/tarjeta/transferencia, total, propinas y diferencia («cuadra» o destacada con el motivo del cajero)— y el **desglose por método** sale de los mismos cobros del arqueo (`summarizeShiftPayments`: primera mitad de la tarea 1.2) | `8efe9fd` | **verificado en producción**: un cierre real a las 11:55 mandó el mensaje al grupo (`último envío` en la captura) |
| **Tarea 1.5 del roadmap** (2026-09-17) | **Reporte diario de caja** (`/admin/cash/report`): total cobrado, efectivo/tarjeta/transferencia/otras, propinas, movimientos y diferencia **por sucursal** y del alcance, con el día elegible por URL (formulario GET, sin JavaScript) y el **día del negocio**. Los totales salen de `summarizeDayClose` (dominio) sobre lo que cada turno congeló al cerrar: un turno abierto no aporta desglose y se dice | este mismo commit | `tarea-1-5-reporte-del-dia-*.png` |
| **Tarea 7.3 del roadmap** (2026-09-17) | **Helper E2E con `cashier`**: `loginAsCashier` crea la cuenta por la UI (el rol se elige en Usuarios), cierra la sesión del dueño y entra con la del cajero; `createAdminUserViaUi` acepta cualquier rol del enum y `loginWithCredentials` entra con credenciales sueltas. El spec nuevo (`tests/e2e/admin-cashier.spec.ts`) prueba en navegador real lo que separa al cajero: **cobra y administra su caja** y **no audita** (sin historial de cierres, sin cierre del día, sin enlace al reporte; `/admin/cash/report` y `/admin/approvals` lo mandan a sus órdenes) | este mismo commit | — |
| **Tareas 9.4 + 9.5 del roadmap** (2026-09-17) | **Guardar la venta en espera y retomarla**: el mostrador atiende de a uno y el cliente no siempre está listo. `pos-holds.ts` (dominio puro: serializar/leer defensivo, tope de 8, título/unidades, **la clave del intento viaja con la espera**), `usePosHolds` (en el dispositivo, por local y moneda, con el bug de la clave de guardado evitado: la lista y su clave van juntas), `pos-holds-panel.tsx` (guardar, retomar, descartar con confirmación del `Modal` del sistema) y el cableado en el POS. Una venta en curso bloquea el «Retomar» (se perdería la que está adelante) y el tope bloquea el «Guardar». La venta en espera **no** es un pedido: vive en la terminal, como el borrador (12.3) | `8bf1b08` | `tarea-9-4-venta-en-espera-*.png`, `tarea-9-5-descartar-confirmacion-*.png` (+ `*-produccion-*.png`, capturadas contra `admin.oneburgernic.com` con `scripts/capture-pos-produccion.mjs`) |
| **Bug encontrado y arreglado en 9.5** | **El `Modal` del sistema salía pegado a la esquina**: el modo modal del navegador centra con `margin: auto` (`inset: 0` + `margin: auto`) y el reset de Tailwind (`* { margin: 0 }`) lo borraba, así que el diálogo aparecía arriba a la izquierda, tapando la navegación. Se vio en la captura de la confirmación del descarte. Arreglado en el primitivo (`m-auto`) y con un test con dientes: el E2E mide que el diálogo quede centrado. Antes/después en `tarea-9-5-descartar-confirmacion-antes-*.png` | `fffc0aa` | `tarea-9-5-descartar-confirmacion-antes-1280.png`, `tarea-9-5-descartar-confirmacion-produccion-1280.png` |
| **Tarea 9.6 del roadmap** (2026-09-17) | **Cupones en el POS**: el cajero escribe el código que trajo el cliente, el **servidor** cotiza el descuento sobre **esta** venta (`POST /api/admin/pos/coupon` → `quotePosCoupon`) y el total baja **antes** de cobrar. La cuenta se **extrajo** del alta a `coupon-discount.ts` (porcentaje, monto fijo y 2×1 con su alcance): el POS cotiza con la misma fórmula con la que se cobra, sin consumir el cupón (los usos se reservan al crear el pedido). El código viaja en el cobro y lo aplica `createOrder`, que sigue siendo la única puerta. Cotizar exige sesión de POS, alcance por sucursal y POS prendido —igual que cobrar— y la cotización **vence** si la venta cambia (se guarda con la firma de las líneas). El texto del código aplicado se movió a `shared/lib/coupon-label.ts`, que ahora comparten el checkout y el POS | `e5c5533` | `tarea-9-6-promo-aplicada-*.png` |
| **Tarea 9.7 del roadmap** (2026-09-17) | **Descuentos manuales con permiso**: `canDiscountPosSale` (owner y manager; el cajero **no**) es una puerta propia, la ruta la comprueba **antes** de crear nada (403 con el motivo) y el descuento queda asentado en el log de acciones sensibles con la acción nueva `order.manual_discount` (forma, valor y **motivo**). La cuenta vive en `sale-discount.ts` (porcentaje de hasta 100 % o monto que nunca pasa de la venta; el motivo es obligatorio) y se compone con el cupón en el alta, que es la única que decide la plata. En pantalla el control solo existe para quien puede darlo, el monto se calcula con la misma regla y el valor viaja como **forma**, no como número | `9cf30f7` | `tarea-9-7-descuento-manual-*.png` |
| **Factura simple (ítem 4 de la ronda)** (2026-09-18) | **El documento que se lleva el cliente — NO fiscal**: modelo `Invoice` (migración `20260918140000`, una por pedido, número correlativo `F-000001`, datos del negocio y del cliente **congelados** al emitir, montos congelados) + `legalName`/`taxId` en `BusinessSettings` (razón social y RUC del negocio) y en `Customer`. `emitInvoice` (se factura lo que **se cobró**: sin cobros 409, cancelado 409; volver a pedirla devuelve la misma), `getOrderInvoice`, `GET/POST /api/admin/orders/[id]/invoice` (entrega el documento quien cobra: `canUsePOS`), la sección **Factura** en el detalle del pedido y el papel `invoice-sheet.ts` impreso con la hoja del sistema (el navegador lo guarda como PDF: misma decisión que 1.6, **sin dependencia nueva**) | `45c44d9` | `tarea-factura-simple-*.png`, `tarea-factura-emitida-*.png`, `tarea-factura-impresa-*.png` |
| **Datos fiscales cableados al admin** (2026-09-18) | **Cierre del ítem 4**: los campos existían en la base pero **no** en la UI, así que la factura salía siempre sin razón social ni RUC. Se agregó `taxAddress`/`taxPhone` al modelo (migración aditiva `20260918150000`) y la sección **«Datos fiscales»** en Personalización (entre «Contacto y ubicación» y «Horarios»), con los 4 campos opcionales, su ayuda contextual y `Restablecer` por campo; se guardan con el mismo «Guardar cambios» (`toSettingsPayload`) y viajan a la factura: **los fiscales mandan** sobre la dirección y el teléfono del negocio, y vacío = la línea no se imprime. **Desvío del ejemplo pedido**: el placeholder de razón social dice «Ej: Mi Restaurante S.A.» y no «Ej: One Burger S.A.» porque el contrato anti-hardcode prohíbe el nombre del negocio fuera del módulo de defaults | `4fb4897` | `tarea-datos-fiscales-*.png`, `tarea-factura-con-ruc-*.png` |
| **Rediseño de la factura: hoja de 80 mm** (2026-09-18) | La factura era texto monospace sin logo ni sucursal. Ahora es una **hoja de 80 mm** (la térmica del mostrador: decisión del owner, reemplaza el A4) en su propia página (`/admin/orders/[id]/invoice/print`, HTML con CSS embebido, sin popup ni iframe ni dependencia nueva): isotipo del negocio (o el nombre si no hay: la térmica imprime en 1 bit y un logo con color sale manchado), bloque de negocio con razón social + RUC + dirección y teléfono fiscales, **sucursal de retiro congelada al emitir** (migración aditiva `20260918160000`: `branchName/AddressLine/City/Phone/Whatsapp/MapsUrl`; las facturas viejas salen sin el bloque), cliente con sus datos fiscales, tabla de ítems, totales con el TOTAL destacado, **pago real** (efectivo con vuelto, tarjeta, transferencia, cobro partido y la propina aparte) y pie «Documento no fiscal» con el pedido y el local. `@page { size: 80mm auto }` y, al imprimir, el panel del admin sale del flujo (`display: none`, no `visibility`) | este mismo commit | `tarea-factura-80mm-1280.png`, `tarea-factura-80mm-375.png`, `tarea-factura-80mm.pdf` vs `tarea-factura-antes-texto-*.png` |

**Alertas Telegram — qué queda** (después de las decisiones del owner del 2026-09-17): **nada pendiente de
diseño**. El «resumen diario a las 22:00» **se eliminó** (nunca se disparó solo y el owner lo reemplazó por
el aviso en **cada cierre** de caja), la alerta suelta de diferencia también (viene dentro del mensaje de
cierre) y el **correo se descartó** (11.4: no aplica, todo por Telegram). Quedan tres eventos: cierre de
caja (prendido por defecto), caja abierta >24 h y devolución grande. El del barrido se registra **una sola
vez por turno** desde el proceso periódico del outbox; los otros dos, en el momento de la operación. El
grupo es uno solo del dueño para todas las sucursales. De la lista confirmada del owner **ya están las 8
tareas**: 1, 2, 3, 5, 6, 7, 9, 10 y 11.

**Tarea 10 — las decisiones que tomé** (el owner las confirma o las cambia):

1. **El export es de una sucursal y de un día del negocio**, no del alcance entero: un lote de terminal y
   un extracto bancario son de una cuenta y de un día, y mezclar sucursales en un archivo haría imposible
   la comparación. El día sale de la zona del negocio (el navegador tiene la suya).
2. **Cada moneda se cuenta en la suya**: un cobro en dólares convertido con la tasa de hoy sería un número
   que el lote nunca tuvo; el dólar se muestra como `US$20.00` / `USD 20.00` y se exporta en dólares.
3. **El efectivo no entra** (su cuadre es el arqueo del cajón) y lo que no es tarjeta ni transferencia
   (`mixto`, `otro`) se **informa aparte** en la pantalla, con la aclaración de que no va en el export: es
   plata del día que no se puede esconder, pero tampoco tiene lote contra el cual cuadrar.
4. La comparación sigue siendo **manual**: el sistema exporta lo que cobró; el número del lote lo pone el
   owner. Automatizar el cuadre necesita decidir el proveedor de pagos (dependencia nueva).

**Tarea 11 — las decisiones que tomé** (el owner las confirma o las cambia):

1. **La clave se renueva solo cuando la operación se resuelve**: se cobró (o el servidor reconoció el
   intento) o el cajero empieza otra venta (vacía la venta o cambia de local). **No** se renueva porque el
   cajero edite el carrito después de un intento que falló: si esa primera operación sí llegó al servidor,
   una clave nueva sería un segundo cobro. Entre mostrar un pedido viejo y cobrar dos veces, se elige lo
   segundo — y el aviso de la pantalla dice exactamente qué pasó.
2. **La clave no se inventa en el servidor**: es del dispositivo, para que dos terminales no choquen y para
   que sobreviva a la recarga. El servidor solo la respeta (`Order.idempotencyKey`, único).
3. **El modo offline completo (12.1, IndexedDB + sincronización) sigue sin implementarse**: lo que se hizo
   es la **idempotencia** que ese modo necesita —sin ella, sincronizar es cobrar dos veces—, tal como el
   owner lo pidió («idempotencia del cobro offline con UUID»).

**Tarea 7 — las dos decisiones que tomé** (el owner las confirma o las cambia):

1. **El traspaso se guarda**, no queda solo en el papel firmado: `ShiftHandover` con el esperado
   **congelado** (recalcularlo después diría un número que nadie firmó) y los dos nombres. Es lo que
   permite reconstruir quién tenía la plata en un turno largo, y lo que el detalle del cierre muestra
   después de cerrar. La alternativa —papel firmado y nada más— era más barata pero dejaba el traspaso
   fuera del sistema, que es justo lo que el inventario marcaba como ausente en 1.13.
2. **Recibe una persona con nombre escrito**, no un usuario del panel: en el mostrador el que sigue no
   siempre tiene cuenta, y trabarla en un usuario sería inventar producto. La regla
   `resolveHandoverReceiver` exige el nombre (no vacío, ≤80 caracteres) y rechaza el de quien entrega
   —nadie se entrega la caja a sí mismo—. Si el owner prefiere que reciba un usuario del panel, el campo
   ya convive con `handedByUserId` y el cambio es acotado.

**Bloque 13 — cerrado** (2026-09-18). **13.1**: el log se escribe desde las rutas reales (verificado
en la base durante la corrida de E2E: `shift.open`, `shift.close`, `cash_movement.create`); para que
ningún `route.ts` pasara su tope de 50 líneas, la composición con el adaptador y la firma se fue a
`*-composition.ts` al lado de cada ruta. **13.3**: el cierre se imprime y se firma con nombre. **13.2**
(historial de movimientos del turno) ya se ve en el detalle del cierre desde el Bloque 2.

**Hallazgo fuera del roadmap, arreglado en el mismo bloque**: verificando el E2E de la hoja de cierre
apareció que **entrar a `/checkout` con el carrito lleno mostraba «Tu carrito está vacío»** — el
`CartProvider` escribía `[]` encima del carrito guardado antes de leerlo, y con el doble montaje de
StrictMode el pedido se perdía. Corregido con test primero (`42c5d98`) y verificado con el E2E de
comandas (5/5, antes 3/5).

**Bloque 11 — lo que falta y su motivo**: **11.3 cerrado** (CSV de cierres), **11.5/11.6 cerrados**
(2026-09-18) y **11.1/11.2 cerrados** (2026-09-17: la conciliación de tarjeta y transferencia se exporta a
CSV y se compara a mano contra el lote y el extracto). **11.4** (email al dueño) **no aplica**: el owner
decidió que todo salga por **Telegram**.

**Bloque 10 — lo que falta y su motivo**: **10.2 y 10.4 cerrados** (2026-09-18): el cliente se lleva su
ticket impreso y se reimprime desde el detalle del pedido, con la impresión unificada en
`print-lines.ts`. Quedan **10.3** (impresión separada por estación) —necesita que el owner diga **qué
estaciones** existen: hoy no hay ese concepto en el modelo— y **10.5** (cola de reintentos), que solo
tiene sentido con una impresora de red, que se descartó a propósito.

**Bloque 12 — lo que falta y su motivo**: **12.2 cerrado** (anti doble submit), **12.3 y 12.4 cerrados**
(2026-09-18): la venta en curso se guarda en el dispositivo y sobrevive a la recarga, y sin red el cobro
se bloquea con el motivo escrito. Queda **12.1** (modo offline con IndexedDB y sincronización), que va a
«Requiere decisión»: cobrar sin conexión y sincronizar después necesita definir la **idempotencia del
cobro** y qué pasa si el mismo pedido se registra dos veces — es riesgo de plata, no una pantalla.

**Bloque 7.3 (`helper E2E acepta cashier`)**: pendiente. El helper de E2E solo crea sesión de owner
(`tryLoginAsOwner`); sumar `cashier` pide crear la cuenta y asignarle sucursal en la misma corrida, que
es trabajo de arnés, no de producto.

**Bloque 3 — lo que queda fuera a propósito:** **3.7** (aviso al dueño si la devolución supera X monto)
necesita el **monto** y el canal (hoy no hay notificación externa: `NOTIFICATIONS_DRIVER=dummy`). Va a
«Requiere decisión».

> **Qué es.** El inventario medido de los **13 bloques / 70 tareas** del roadmap
> [`ops/tasks/pos-roadmap.md`](../pos-roadmap.md), contra el código de este repo. **No propone cambios,
> no planifica y no evalúa calidad**: describe y clasifica.
>
> **Sobre qué se midió.** `main` en `63f286d` (el código desplegado es `2f35710`,
> `build-20260917-015211`; `main` solo tiene dos commits de documentación por delante). Tamaño del
> terreno: **35 modelos** Prisma (`prisma/schema.prisma`, 817 líneas), **30 páginas** de admin,
> **70 `route.ts`**, **24 specs** de E2E, **23 migraciones**.
>
> **Cómo se midió.** Lectura dirigida de `prisma/schema.prisma`, de cada `route.ts` con su caso de uso,
> de los componentes del panel y de los puertos/adaptadores de `src/modules/`; y conteos por grep sobre
> `src/` y `prisma/` para lo que se afirma como ausente. Cada fila trae `ruta:línea` cuando la cosa
> existe y se puede señalar.
>
> **Marcas de honestidad.** `HECHO` / `PARCIAL` / `NO EXISTE` / `DIFERENTE` según el brief.
> **NO EXISTE** = se buscó y no hay nada. Si algo existe con otra forma o alcance, `DIFERENTE` con qué
> cambia. Lo que el código no permite afirmar queda como **AMBIGUO**.
>
> **Lo que este documento NO es:** un plan, una priorización comprometida, ni una propuesta de diseño.
> El orden del "Top 10" es una lectura del inventario, no una decisión tomada.
>
> **Convivencia con el backlog de UI.** Esto es el **roadmap funcional del POS (Fase 2)**. Los ítems
> `A-15`, `A-16`, `A-17`, `A-18`, `A-19` y `A-20` de [`ops/audit-backlog.md`](../../audit-backlog.md)
> **no son tareas de este roadmap**: son hallazgos y decisiones de producto registrados antes, y algunos
> se solapan (A-15 con 3.x, A-16 con 1.3, A-17 con 4.1, A-18 con 1.1/6.1, A-19 con 2.x, A-20 con 5.x).
> Se citan donde corresponden, pero **no se mezclan los dos proyectos ni su priorización**.

---

## Bloque 1 — Caja (núcleo)

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 1.1 | Persistir `expectedByCurrency` en `Shift` | **NO EXISTE** | `Shift` no tiene columnas por moneda: `prisma/schema.prisma:762-788` (solo `openingAmount`, `closingAmount`, `expectedAmount`, `difference`, `notes`). El valor se **calcula y se devuelve en `meta`**, no se guarda: `src/modules/orders/features/shift/close-shift.ts:113` (`return { data: closed, meta: { expectedByCurrency: arqueo.expectedByCurrency } }`) y el adaptador escribe solo los escalares: `src/modules/orders/adapters/prisma-shift-repository.ts:132-148`. Recomputar un cierre viejo usaría la tasa de hoy |
| 1.2 | Calcular y persistir ventas por método al cerrar | **DIFERENTE** | El esperado del cajón **solo suma efectivo** y se congela al cerrar: `close-shift.ts:138-146` (filtra `method === "cash"`, suma propina y resta `changeAmount`), persistido en `expectedAmount` (`prisma-shift-repository.ts:143`). La plata en tarjeta **sí se registra por cobro** (`Payment`, `prisma/schema.prisma:732-753`) pero **no se agrega por método al cerrar ni se persiste** un resumen: no hay columna ni tabla de "ventas por método" |
| 1.3 | `/admin/cash` con historial de cierres | **NO EXISTE** | La ruta no existe (`src/app/(admin)/admin/cash` no está). El cierre vive dentro del POS (`/admin/pos`, sección «Caja»): `src/app/(admin)/admin/pos/pos-client.tsx:447-560`. No hay API de historial: la única lectura de turno es la **caja abierta** (`src/app/api/admin/pos/shift/route.ts:12-31` → `src/modules/orders/features/shift/get-current-shift.ts:21`) y `listShifts` **no la usa nadie** (`src/modules/orders/ports/shift-repository.ts:49`) |
| 1.4 | Detalle de un cierre (`/admin/cash/history/[id]`) | **PARCIAL** | La ruta no existe. Los datos **están guardados** y se muestran una sola vez, en el estado del cliente, al cerrar: `pos-client.tsx:336-356` guarda `closedShift` con `expectedByCurrency` del `meta`; al recargar, el arqueo desaparece. Falta superficie de lectura (persistencia → 1.1; historial → 1.3) |
| 1.5 | Reporte diario consolidado | **DIFERENTE** | Existe un resumen del día, pero **no es de caja**: `/admin` (Resumen) son métricas de órdenes (valor completado, cantidad, ticket promedio) y alertas operativas — `src/app/(admin)/admin/_components/admin-overview-client.tsx:69-91`, API `src/app/api/admin/overview/performance/route.ts` y `src/app/api/admin/dashboard/summary/route.ts`. El reporte diario por API agrega **`Order` y `Reservation`**, sin pagos, sin turnos y **sin filtrar por local**: `src/modules/dashboard/features/get-daily-report/get-daily-report.ts:12-56` (solo `dateFrom`/`dateTo`), servido por `src/app/api/admin/reports/daily/route.ts:19-24` y **sin página** (no existe `/admin/reports`) |
| 1.6 | PDF del cierre bajo demanda | **NO EXISTE** | No hay librería de PDF en dependencias (búsqueda `jspdf`/`pdfkit`/`pdf-lib` en `package.json` y `src/`: 0 coincidencias) ni generación de documento. Lo único generado es el **recibo JPG** de una venta: `src/shared/lib/receipt-image.ts:108-139` |
| 1.7 | Cierre obligatorio configurable | **NO EXISTE** | Ningún campo de configuración lo expresa: `BusinessSettings` (`prisma/schema.prisma:674-727`) no tiene nada de caja, y `Location` (`:175-215`) tampoco. Una caja abierta puede quedar abierta indefinidamente: `ShiftStatus` es `open | closed` (`:356`) y nadie la cierra por tiempo (`src/modules/orders/adapters/prisma-shift-repository.ts` no tiene barrido ni vencimiento) |
| 1.8 | Alerta al dueño si un turno lleva >24 h sin cerrar | **NO EXISTE** | No hay alerta ni job: la home del panel alerta sobre **órdenes** (nuevas sin confirmar, demoradas), no sobre cajas — `admin-overview-client.tsx:290-305`. No hay acceso a turnos abiertos por API más allá de `getCurrentShift` de un local puntual |
| 1.9 | El operario NO ve detalles al cerrar | **NO EXISTE** | No hay distinción por rol en el arqueo: cualquier rol con `canUsePOS` (`src/modules/auth/domain/admin-permissions.ts:54-60`) ve el mismo bloque y la misma respuesta. El cierre calcula el esperado y lo devuelve — con la diferencia — a quien cierra: `close-shift.ts:106-113`, `pos-client.tsx:355` |
| 1.10 | Reabrir un turno cerrado (`canManageCash` + motivo) | **PARCIAL** | El motivo existe como **nota de cierre** (`notes`, `prisma/schema.prisma:778`; se envía desde `close-pos-shift`, `src/modules/pos/features/close-pos-shift/close-pos-shift.ts:35-38`) y el cierre **no se puede pisar** (`prisma-shift-repository.ts:135-138`: `where: { id, status: "open" }`). Lo que falta: no hay reapertura, ni `canManageCash`, ni transición `closed → open` |
| 1.11 | Cierre ciego (no mostrar el esperado antes de contar) | **NO EXISTE** | El concepto existe en el puerto para `closingAmount: null` (`src/modules/orders/ports/shift-repository.ts:18-27`), pero la única boca de cierre **siempre** manda un conteo (`src/modules/pos/features/close-pos-shift/close-pos-shift.ts:16`, `pos-client.tsx:336-345`) y no hay configuración ni rol que oculte el esperado |
| 1.12 | Cierre X (lectura parcial sin cerrar) | **NO EXISTE** | `GET /api/admin/pos/shift` devuelve **solo el turno abierto** (sin arqueo parcial): `src/app/api/admin/pos/shift/route.ts:23` → `get-current-shift.ts:21` |
| 1.13 | Handover entre cajeros | **NO EXISTE** | `Shift.userId` registra **quién abrió** (`prisma/schema.prisma:765`, `prisma-shift-repository.ts:79`) y no hay cambio de responsable, conteo intermedio ni dos turnos encadenados en el mismo local (el índice único parcial impide dos abiertos: `schema.prisma:757-761`) |

## Bloque 2 — Movimientos de caja

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 2.1 | Modelo `CashMovement` | **NO EXISTE** | 0 coincidencias de `CashMovement` en `prisma/` y `src/`. Los 35 modelos del schema no incluyen ninguno de movimiento de caja |
| 2.2 | Los movimientos afectan el `expected` | **NO EXISTE** | El esperado es `fondo + efectivo del turno − vueltos` y nada más: `close-shift.ts:156-186`. No hay entrada/salida de dinero fuera de un cobro |
| 2.3 | UI de movimientos en `/admin/cash` | **NO EXISTE** | Ni la ruta ni la UI. (No confundir con `src/app/api/admin/inventory/movements/route.ts`, que es inventario, fuera del MVP) |
| 2.4 | Categoría de movimiento | **NO EXISTE** | Sin modelo, no hay categoría |
| 2.5 | Límite de retiro sin aprobación | **NO EXISTE** | Sin retiros, no hay límite ni configuración |
| 2.6 | Aprobación de movimiento grande | **NO EXISTE** | No hay flujo de aprobación en ninguna parte (búsqueda `aprobaci`/`Aprobaci` en `src/`: 0 coincidencias) |

## Bloque 3 — Devoluciones

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 3.1 | Modelo `Refund` | **NO EXISTE** | 0 coincidencias de `Refund`/`refund`/`devoluci*` en `prisma/` y `src/` |
| 3.2 | Refund con aprobación owner/manager | **NO EXISTE** | Sin modelo ni caso de uso |
| 3.3 | Refund parcial (1 ítem) | **NO EXISTE** | Sin modelo ni caso de uso |
| 3.4 | Void antes del cierre (anular cobro) | **NO EXISTE** | El cobro no se puede anular ni borrar: el puerto de pagos solo **crea** y **lee** — `src/modules/orders/ports/payment-repository.ts` (`createPayment`, `listPaymentsByOrder`, `listPaymentsInRange`); consumidores en `register-pos-sale.ts:121-131`. Búsqueda de `anular` en `src/`: 1 coincidencia y es un comentario de test (`src/app/(public)/checkout/checkout-scale-helpers.test.ts:21`) |
| 3.5 | Notificación al admin al cancelar un pedido cobrado | **NO EXISTE** | `updateOrderStatus` **no toca pagos** y solo publica `OrderStatusChanged`: `src/modules/orders/features/update-order-status/update-order-status.ts:32-39` (0 coincidencias de `Payment` en ese archivo). Además las notificaciones están en pausa (`NOTIFICATIONS_DRIVER=dummy`) |
| 3.6 | `/admin/approvals` con refunds pendientes | **NO EXISTE** | La ruta no existe (`src/app/(admin)/admin/approvals` no está) |
| 3.7 | Notificación al dueño si el refund supera X monto | **NO EXISTE** | Sin refunds, sin umbral y sin notificación |

## Bloque 4 — Métodos de pago

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 4.1 | Transferencia en la UI (`sale-payload.ts`) | **DIFERENTE** | El **enum ya la tiene** (`PaymentMethodType = cash · card · transfer · mixed · other`, `prisma/schema.prisma:347-353`) pero el payload del POS acepta **solo `cash`/`card`**: `src/app/api/admin/pos/sale/sale-payload.ts:30` (`z.enum(["cash","card"])`), y la pantalla ofrece dos chips: `pos-client.tsx:101` y `:789`. El tipo de la UI también está cerrado a dos: `pos-client.tsx:402` |
| 4.2 | Split payment (1 pedido, N pagos) | **PARCIAL** | El **contrato ya es N pagos**: `payments: z.array(paymentSchema).min(1)` (`sale-payload.ts:43`), el caso de uso itera y crea un `Payment` por cada uno (`register-pos-sale.ts:115-131`) y el dominio suma por moneda (`paymentsTotalInBusinessCurrency`, `:61-65`). Lo que falta: la **pantalla solo manda un cobro** (un monto, un método) y el vuelto se registra únicamente si hay **un solo cobro en efectivo** (`register-pos-sale.ts:119`) |
| 4.3 | Mixto con múltiples tarjetas | **PARCIAL** | Mismo estado que 4.2: el backend lo soporta (N pagos de cualquier método del enum) y la UI no lo expone. Además el payload restringe cada cobro a `cash|card`, así que "múltiples tarjetas" hoy sería posible con dos cobros `card`, pero **no hay pantalla** que los arme |

## Bloque 5 — Factura editable

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 5.1 | `BusinessSettings`: `taxId`, `legalName`, `taxAddress`, `taxPhone` | **NO EXISTE** | 0 coincidencias de `taxId`/`legalName`/`fiscal`/`RUC`/`NIT` en `prisma/` y `src/`. `BusinessSettings` tiene identidad visual y contacto (`prisma/schema.prisma:674-727`), nada fiscal |
| 5.2 | `Customer`: `taxId`, `legalName` | **NO EXISTE** | `Customer` tiene `fullName` + `whatsappNormalized` y nada más (`prisma/schema.prisma:59-69`) |
| 5.3 | Generador PDF de factura | **DIFERENTE** | No hay PDF (0 librerías). Existe el **recibo JPG** por venta, sin logo y sin datos fiscales: `src/shared/lib/receipt-image.ts` (`buildReceiptTextLines:56-102`, `renderReceiptJpeg:108-139`, `shareOrDownloadReceipt:146-167`), emitido desde el POS: `pos-client.tsx:415`, `:863` |
| 5.4 | Modelo `Invoice` (draft + emitted) | **DIFERENTE** | No existe `Invoice`. Lo que existe es `Payment` con `reference` (número de voucher/transferencia, nullable) para la referencia externa del cobro: `prisma/schema.prisma:746-747`. No hay borrador, emisión, numeración ni estado de factura |
| 5.5 | Flujo editable (POS + detalle) | **NO EXISTE** | No hay edición de documento ni emisión desde el detalle del pedido. Del detalle se puede cobrar/editar el envío, no facturar: `src/app/api/admin/orders/[id]/delivery-fee/route.ts` |

## Bloque 6 — Dólares

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 6.1 | Saldo por moneda en el cierre | **PARCIAL** | Se **calcula y se envía** al cerrar: `expectedCashByCurrency` (`src/modules/orders/domain/shift-cash.ts`) devuelto en el `meta` (`close-shift.ts:188-192`) y consumido por la pantalla (`pos-client.tsx:355`). No se **persiste** (ver 1.1): `Shift` no tiene columnas por moneda y `ShiftCashCount` guarda el conteo por billete y moneda (`prisma/schema.prisma:800-815`), no el esperado |
| 6.2 | Sin arrastre automático | **HECHO** | No hay arrastre por diseño: el fondo de un turno sale de su propio conteo de apertura o de `openingAmount` (`close-shift.ts:148-154`) y no hay ninguna operación que copie el cierre anterior al siguiente. Confirmado por ausencia: no hay campo ni job que transporte saldo entre turnos |

## Bloque 7 — Permisos

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 7.1 | `canManageCash`, `canRefund`, `canViewCashHistory` | **PARCIAL** | Existe un solo permiso de caja, `canUsePOS` (owner · manager · cashier; cocina no entra): `src/modules/auth/domain/admin-permissions.ts:54-60`. Los tres del brief **no existen** (0 coincidencias de `canManageCash`/`canRefund`/`canViewCashHistory` en `src/`) |
| 7.2 | Aplicar permisos en rutas nuevas | **PARCIAL** | Lo que existe está bien aplicado: las cinco rutas del POS comparten `requirePosLocation` → rol + alcance por sucursal + POS prendido en el local (`src/app/api/admin/pos/pos-route-helpers.ts`, `assertCanUsePos`). Lo que falta: las rutas nuevas del roadmap (`/admin/cash`, `/admin/approvals`, historial, refunds) no existen, así que no hay permiso que aplicar |
| 7.3 | Helper E2E acepta `cashier` | **NO EXISTE** | El helper solo tiene owner: `tryLoginAsOwner` (`tests/e2e/helpers.ts:185`), `loginAsOwner` (`:204`), `createAdminUserViaUi` (`:227`). No hay helper de `cashier` (0 coincidencias de `cashier` en `tests/e2e/`) |

## Bloque 8 — Sidebar

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 8.1 | Grupos: OPERACIÓN, CONTROL, CATÁLOGO, CONFIGURACIÓN | **DIFERENTE** | Hay **dos** grupos, con otras agrupaciones: «Operación» (Resumen, Órdenes) y «Configuración» (Menú, Locales, Usuarios, Personalización), `src/app/(admin)/admin/admin-layout-helpers.ts:26-43`. La Caja **no está en los grupos** porque depende del local y se inyecta en Operación si algún local del staff la tiene prendida: `:51-72` |
| 8.2 | Renombrar «Caja» → «POS» | **DIFERENTE** | La entrada se llama **«Caja»** (no «POS») y apunta a `/admin/pos`: `admin-layout-helpers.ts:59-64` y la barra móvil `src/app/(admin)/admin/_components/admin-mobile-nav.tsx:55`. Es decir: el nombre pedido y la ruta pedida están cruzados respecto del brief |
| 8.3 | Rutas `/admin/cash`, `/admin/cash/history`, `/admin/approvals` | **NO EXISTE** | Ninguna de las tres existe en el disco (verificado por ruta). La caja vive en `/admin/pos` |
| 8.4 | Visibilidad por rol | **PARCIAL** | Está resuelta para lo que existe: owner ve todo; manager solo Órdenes y Menú; cocina solo Órdenes; cajero Órdenes y Caja (`admin-layout-helpers.ts:74-113`), y la caja se oculta si ningún local del staff tiene el POS prendido (`:66-72`). Falta: los ítems de historial/aprobaciones no existen, y la barra móvil **declara una pestaña «Mesas»** que el filtro descarta hoy porque no está en los grupos (`admin-mobile-nav.tsx:51-58` + `:75-77`) |

## Bloque 9 — POS (venta)

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 9.1 | POS limpio (sin tab de Caja) | **NO EXISTE** | La caja **está dentro** de la pantalla del POS como sección desplegable: `pos-client.tsx:447-560` (botón «Caja» + `<section aria-label="Caja">` + grilla de conteo). No hay pestañas ni separación |
| 9.2 | Banner si no hay caja abierta + bloqueo del cobro | **PARCIAL** | Dice el estado sin bloquear: «Sin caja abierta en este local.» (`pos-client.tsx:490`) y el botón «Cobrar» **no depende de la caja** (`:836-839`, `disabled={charging}` únicamente). La decisión está documentada como deliberada en `ops/project-state.md` §2 (TASK-305b-2: no se cambia el comportamiento sin la pantalla que lo explique) |
| 9.3 | Venta rápida (producto sin carrito) | **NO EXISTE** | No hay acción de cobrar un producto de un toque: la tarjeta del producto agrega al borrador (`pos-client.tsx:613`) y **el producto con opciones obligatorias no se puede agregar**: `:625-626` (`requiresOptions`), con el puerto exponiéndolo (`src/modules/pos/ports/pos-catalog.ts:22`) |
| 9.4 | Guardar pedido en espera (hold) | **NO EXISTE** | El borrador vive **solo en memoria del cliente**: `createPosDraft`/`addPosLine`/`setPosLineQuantity`/`removePosLine` (`src/modules/pos/domain/pos-draft.ts:33-115`). No hay persistencia, ni en el servidor ni local |
| 9.5 | Retomar pedido en espera | **NO EXISTE** | Sin holds guardados no hay nada que retomar |
| 9.6 | Aplicar promociones/cupones | **DIFERENTE** | El motor de promos existe y se usa en el **checkout público** y en `/admin/promotions` (motor en `src/modules/orders/`, casos de uso `validate-coupon`/`create-promotion`/`list-promotions`, validación pública `src/app/api/coupons/validate/route.ts`). En el POS **no hay descuentos**: `posDraftTotals` fija `discount: 0` con el comentario explícito «sin propina ni descuentos: el POS no los usa» (`src/modules/pos/domain/pos-draft.ts:123-148`) y el payload del cobro no acepta cupón (`sale-payload.ts:35-45`) |
| 9.7 | Descuentos manuales con permiso | **NO EXISTE** | Sin descuento en el borrador (ver 9.6) ni permiso que lo autorice (ver 7.1) |
| 9.8 | Producto agotado bloqueado en POS | **DIFERENTE** | No hay bloqueo **en el POS**: el catálogo que recibe ya viene **filtrado por el menú público** (adaptador: `src/modules/pos/adapters/menu-pos-catalog.ts:20`, `product.availability.isActive && product.availability.isAvailable`; composición sobre `getPublicMenu`: `src/modules/pos/adapters/production-pos-catalog.ts:17-27`). O sea: el agotado **desaparece de la lista** en vez de verse bloqueado, y no hay marca de "agotado" en la pantalla (AMBIGUO si eso cuenta como "bloqueado": el efecto operativo es el mismo, la información al cajero no) |
| 9.9 | Cliente recurrente (vincular a historial) | **DIFERENTE** | El **vínculo ya ocurre** en todas las ventas, también las del POS: `createOrder` llama a `findOrCreateCustomer` por WhatsApp (`src/modules/orders/features/create-order/create-order.ts:102` y `:449-459`) y el caso de uso busca por teléfono, crea si no existe y completa el nombre (`src/modules/customers/features/find-or-create-customer/find-or-create-customer.ts:44-116`); el POS pasa por ahí (`register-pos-sale.ts:77-99`). Lo que **no existe** es la parte de POS del brief: la pantalla no busca por teléfono ni muestra el historial del cliente, solo tres campos de texto (`pos-client.tsx`, sección de cliente). O sea: el dato está vinculado, la consulta no |

## Bloque 10 — Impresión

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 10.1 | Impresión de ticket de cocina | **NO EXISTE** | No hay impresión: 0 coincidencias de `window.print`, `escpos`, `ESC/POS`, `thermal` en `src/`. La única mención de impresora es un comentario de ancho de canvas en el recibo (`src/shared/lib/receipt-image.ts:48`) |
| 10.2 | Impresión de ticket de cliente | **DIFERENTE** | Existe el **recibo como JPG** para enviar (hoja de compartir del sistema) o descargar, no para imprimir por impresora: `receipt-image.ts:146-167`, ofrecido en `pos-client.tsx:863` (TASK-307, sin API de WhatsApp por decisión del owner) |
| 10.3 | Impresión separada por estación | **NO EXISTE** | No hay concepto de estación ni de impresora |
| 10.4 | Reimpresión | **NO EXISTE** | El recibo se arma con el último cobro y **se pierde al limpiar el borrador**: `pos-client.tsx:415` («El recibo se arma con lo que se acaba de cobrar: el borrador se limpia enseguida»). No hay historial de recibos ni reimpresión desde el detalle |
| 10.5 | Cola de reintentos si falla la impresora | **NO EXISTE** | Sin impresión, no hay cola. La cola que existe es de **eventos** (`OutboxEvent`, `prisma/schema.prisma:650-672`) para notificaciones, no de impresión |

## Bloque 11 — Cuadre y conciliación

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 11.1 | Cuadre de tarjeta (contra lote de terminal) | **NO EXISTE** | No hay lote, terminal ni total de tarjeta del día. El cierre ignora la tarjeta **a propósito** para el cajón (`close-shift.ts:138-146`) y no hay ningún otro reporte que la sume: `get-daily-report.ts` solo agrega `Order.total` y estados |
| 11.2 | Cuadre de transferencia | **NO EXISTE** | Ni el cobro por transferencia (4.1) ni su cuadre |
| 11.3 | Export CSV de cierres | **NO EXISTE** | 0 coincidencias de `text/csv`/`toCsv`/`downloadCsv` en `src/` |
| 11.4 | Envío por email al dueño | **NO EXISTE** | 0 coincidencias de `sendEmail`/`sendMail`/`SMTP` en `src/`. El canal de notificaciones está en pausa (`NOTIFICATIONS_DRIVER=dummy`) y no hay email configurado |
| 11.5 | Cierre del día consolidado | **NO EXISTE** | No hay cierre de día: hay turnos por local (`Shift`) y un resumen de órdenes sin local ni medios de pago (`get-daily-report.ts:12-56`) |
| 11.6 | Comparativa entre sucursales | **NO EXISTE** | El resumen y el reporte diario **no filtran ni desglosan por local** (`get-daily-report.ts` no recibe `locationId`; `admin-overview-client.tsx:103-113` ofrece período y canal `all|pickup`, no local) |

## Bloque 12 — Offline y resiliencia

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 12.1 | Modo offline del POS (IndexedDB + sync) | **NO EXISTE** | 0 coincidencias de `IndexedDB`/`indexedDB`/`idb` en `src/`. El service worker es de assets: `src/shared/pwa/sw-policy.ts` deja `passthrough` todo lo que no sea `GET` (`:29-31`), `network-only` para `/api/` (`:36-38`), `network-first` para navegación (`:40-42`) y `stale-while-revalidate` para estáticos (`:44-46`); implementación en `public/sw.js` |
| 12.2 | Rate limiting en cobros (anti doble submit) | **HECHO** | Doble guarda: la clave de idempotencia se genera por intento y **se renueva solo cuando la venta sale bien** (`pos-client.tsx:110`, `:396`, `:436`) y el botón se deshabilita mientras cobra (`:836`, `disabled={charging}`). Del lado del servidor el alta es idempotente por `Order.idempotencyKey` (`prisma/schema.prisma`, `register-pos-sale.ts:98`), verificado por el E2E del POS (`tests/e2e/admin-pos.spec.ts`) |
| 12.3 | Reconexión sin perder el pedido en curso | **PARCIAL** | El borrador sobrevive a un refresco fallido de fondo: el polling cada 3 s **no toca el borrador, la búsqueda ni el conteo** y descarta el error de un refresco silencioso (`pos-client.tsx:221-233`, `:153-160`; caso de test «se refresca solo cada 3 s sin pisar lo que el cajero está armando»). Lo que falta: no hay persistencia ni recuperación si se **recarga la pestaña** o se corta la conexión (ver 9.4), y no hay reenvío automático de un cobro pendiente |
| 12.4 | Indicador de estado de conexión | **NO EXISTE** | 0 coincidencias de `navigator.onLine`/`useOnlineStatus`/`connectionStatus` en `src/`. Los errores de red se muestran como mensaje de error del momento, no como estado (`pos-client.tsx:438`) |

## Bloque 13 — Auditoría y log

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 13.1 | Log de acciones sensibles | **NO EXISTE** | 0 coincidencias de `AuditLog`/`auditLog`/`AuditEvent`/`actionLog` en `src/` y `prisma/`. Lo más cercano y **más angosto**: `OrderStatusHistory` firma cada cambio de estado (`changedByUserId`, `prisma/schema.prisma:532-554`, usado en `update-order-status.ts:32-37`) y **el actor no se muestra en ninguna pantalla** (es `A-09` del backlog de UI, no de este roadmap). No hay log de cobros, aperturas, cierres ni cambios de configuración |
| 13.2 | Historial de movimientos del turno | **PARCIAL** | El turno guarda su conteo por billete y tipo (apertura/cierre) y su arqueo: `ShiftCashCount` (`prisma/schema.prisma:800-815`), `openingAmount`/`closingAmount`/`expectedAmount`/`difference` (`:769-777`). Lo que falta: **no hay historial visible** (ver 1.3/1.4) y no hay movimientos (Bloque 2) que historiar |
| 13.3 | Firma digital (nombre impreso en el cierre) | **NO EXISTE** | El cierre guarda `userId` (`prisma/schema.prisma:765`) y notas (`:778`), pero **no hay ningún lugar donde se imprima o se muestre el nombre de quien cierra**: no hay recibo de cierre ni pantalla de detalle (1.4). El recibo JPG del POS imprime el nombre del **cliente**, no el del cajero (`receipt-image.ts:56-102`) |

---

## Resumen ejecutivo

### Lo que está HECHO

> Criterio: la tarea del brief está cumplida **en su función**, aunque su forma no sea la que el roadmap
> imaginó (esos casos se listan además en "EXISTE DIFERENTE"). Una tarea marcada `PARCIAL` en la tabla
> de su bloque **no** se repite acá.

- **5.3** — el recibo como imagen JPG, generado en el dispositivo, con texto puro probado y oferta de enviar/descargar (es *DIFERENTE* respecto de "PDF de factura", pero **está hecho y funcionando**).
- **5.4** — el **cobro** está registrado como `Payment` con monto, moneda, propina, vuelto y referencia externa (es *DIFERENTE* respecto de "modelo `Invoice`": cubre el registro del cobro, no la factura).
- **6.2** — sin arrastre automático, por diseño y verificado por ausencia.
- **12.2** — anti doble submit: idempotencia de punta a punta + botón deshabilitado durante el cobro.

**4 hechas** de 70 (**5,7 %**).

### Lo que está PARCIAL

- **1.4** — el arqueo se muestra una sola vez al cerrar y desaparece al recargar; falta historial y detalle.
- **1.10** — hay motivo de cierre y el cierre no se puede pisar; falta la reapertura y el permiso.
- **4.2** — el contrato acepta N pagos y el caso de uso los registra; falta la pantalla que arme el split.
- **4.3** — igual que 4.2: backend sí, UI no.
- **6.1** — el saldo por moneda se calcula y se devuelve en la respuesta; falta persistirlo al cerrar.
- **7.1** — existe `canUsePOS`; faltan los tres permisos del brief (`canManageCash`, `canRefund`, `canViewCashHistory`).
- **7.2** — los permisos existentes están bien aplicados en las rutas del POS; faltan las rutas nuevas del roadmap.
- **8.4** — la visibilidad por rol está resuelta para la navegación actual; faltan las entradas nuevas.
- **9.2** — avisa que no hay caja abierta, pero **no bloquea** el cobro (decisión deliberada y documentada).
- **12.3** — el refresco de fondo no pisa el borrador; falta persistencia/reconexión real.
- **13.2** — los datos del turno y sus conteos se guardan; falta la superficie que los muestre.

**11 parciales** de 70 (**15,7 %**).

### Lo que EXISTE DIFERENTE
- **1.2** — **cerrado** (2026-09-17): el turno congela el desglose por medio (tarjeta, transferencia, otras formas y propinas) y el detalle del cierre lo muestra.
- **1.5** — **cerrado** (2026-09-17): `/admin/cash/report` es el reporte del día **de caja** (por medio, propinas, arqueo y comparación por sucursal). El resumen de órdenes de `/admin` sigue siendo otra cosa a propósito.
- **4.1** — el enum tiene `transfer`/`mixed`/`other`; el POS y su payload aceptan solo `cash|card`.
- **5.3** — recibo JPG sin logo ni datos fiscales, no PDF de factura.
- **5.4** — existe `Payment` (con `reference`), no un `Invoice` con borrador y emisión.
- **8.1** — dos grupos («Operación», «Configuración») con otros criterios; la Caja se inyecta por local.
- **8.2** — la entrada se llama «Caja» y vive en `/admin/pos` (el brief pedía «POS» en `/admin/cash`).
- **9.6** — el motor de promos existe y se usa en el checkout y en el admin; el POS lo ignora a propósito (`discount: 0`).
- **9.8** — el agotado no se bloquea en el POS: el menú público ya lo filtra y el producto no aparece.
- **9.9** — el cliente **sí** queda vinculado al historial por WhatsApp (auto-link en `createOrder`), pero el POS no busca por teléfono ni muestra historial: el brief pedía la consulta en el mostrador.
- **10.2** — hay recibo JPG para compartir/descargar, no impresión de ticket.

**11 diferentes** de 70 (**15,7 %**).

### Lo que NO EXISTE (priorizado)

**🔴 Crítico para operar una caja de verdad**

1. **2.1/2.2/2.3** — movimientos de caja: sin retiro/ingreso con motivo, el cajón y el esperado no se pueden explicar.
2. **3.1/3.2/3.3** — devoluciones: no hay `Refund`, ni parcial, ni con aprobación.
3. **1.1** — `expectedByCurrency` no se persiste: un cierre viejo no se puede reconstruir con la tasa del día.
4. **1.3** — `/admin/cash` no existe: no hay historial de cierres (los datos están, la pantalla no).
5. **1.7/1.9/1.11** — reglas de cierre: cierre obligatorio, ciego y qué ve el operario.
6. **3.4/3.5** — anular un cobro y avisar al admin cuando se cancela un pedido ya cobrado (es el `A-15` del backlog de UI, **la decisión de plata más importante**, y sigue sin respuesta del owner).
7. **9.2** — exigir caja abierta para cobrar (hoy se cobra con la caja cerrada y ese cobro no entra a ningún arqueo).
8. **7.1/7.2** — permisos de caja: hoy `canUsePOS` es el único; un cajero puede ver la diferencia del turno.
9. **1.4/1.12/1.13** — detalle del cierre, cierre X y handover entre cajeros.
10. **11.1** — cuadre de tarjeta contra el lote de la terminal: hoy la tarjeta **no se reporta en ningún lado** (el cierre filtra efectivo a propósito y el reporte diario no suma pagos).

**🟡 Importante (operación diaria y cuadre)**

11. **11.2/11.5/11.6** — cuadre de transferencia, cierre del día consolidado y comparativa por sucursal.
11. **11.2/11.5/11.6** — cuadre de transferencia, cierre del día consolidado y comparativa por sucursal (**cerrados** el 2026-09-17).
12. **1.5/1.6** — **cerrados** (2026-09-17): reporte diario **de caja** en `/admin/cash/report` y el PDF del cierre se queda en el navegador (decisión del owner: no se migra a server).
14. **9.6/9.7** — promos y descuentos manuales en el POS.
15. **2.4/2.5/2.6** — categoría, límite y aprobación de movimientos.
16. **3.6/3.7** — `/admin/approvals` y aviso al dueño por devolución grande.
17. **9.4/9.5** — holds: guardar y retomar un pedido en espera.
18. **1.8** — alerta por turno sin cerrar >24 h.
19. **12.3/12.4** — reconexión sin perder el cobro en curso e indicador de conexión.
20. **13.1/13.3** — log de acciones sensibles y firma (nombre) en el cierre.

**🟢 Nice to have**

21. **9.3** — venta rápida de un producto sin carrito.
22. **11.3/11.4** — export CSV (**hecho**) y envío por email (**no aplica**: todo por Telegram, decisión del owner 2026-09-17).
23. **10.1/10.2/10.3/10.4/10.5** — impresión de tickets (cocina, cliente, por estación, reimpresión, cola de reintentos).
24. **12.1** — modo offline del POS con IndexedDB y sincronización.

**44 no existen** de 70 (**62,9 %**).

### Estadística

| Estado | Tareas | Porcentaje |
|---|---|---|
| **Total auditadas** | **70** | 100 % |
| HECHAS | 4 | 5,7 % |
| PARCIALES | 11 | 15,7 % |
| NO EXISTEN | 44 | 62,9 % |
| DIFERENTES | 11 | 15,7 % |

**Lectura en una línea:** el POS de Fase 1 (venta, cobro con idempotencia, caja por local con conteo por denominación, recibo y el mostrador por local) **está hecho y desplegado**; lo que falta de la Fase 2 es **casi todo el gobierno del dinero** (movimientos, devoluciones, historial de cierres, cuadre por método, fiscal) y **toda la resiliencia del mostrador** (offline, holds, impresión).

### Top 10 crítico que falta (los 10 primeros de la lista 🔴, en el orden del roadmap)

| # | Bloque | Qué falta | Por qué primero |
|---|---|---|---|
| 1 | 2.1-2.3 | Modelo y UI de movimientos de caja | Sin esto el esperado no admite explicaciones y toda diferencia es un misterio |
| 2 | 3.1-3.3 | Modelo `Refund`, parcial y con aprobación | Es la contraparte de "se cobró y se devolvió": sin ella el cierre miente (A-15) |
| 3 | 1.1 | Persistir `expectedByCurrency` (y `Payment.shiftId`) | Un arqueo viejo se reconstruye con la tasa de hoy y los cobros se atribuyen por ventana de tiempo (A-18) |
| 4 | 1.3/1.4 | `/admin/cash` con historial y detalle de cierre | Los datos ya están guardados; hoy desaparecen al recargar (A-16) |
| 5 | 1.7/1.9/1.11 | Cierre obligatorio, ciego y qué ve el operario | Es la regla del control interno: hoy cualquiera ve el esperado antes de contar |
| 6 | 3.4/3.5 | Anular un cobro y avisar al admin al cancelar un pedido cobrado | El cobro de un pedido cancelado sigue contando en el arqueo y no hay forma de registrarlo |
| 7 | 9.2 | Exigir caja abierta para cobrar | Hoy se cobra con la caja cerrada y esos cobros no entran a ningún arqueo |
| 8 | 7.1/7.2 | `canManageCash`/`canRefund`/`canViewCashHistory` en las rutas | El rol `cashier` es el único permiso de caja y no separa ver de administrar |
| 9 | 1.12/1.13 | Cierre X y handover entre cajeros | Operación de más de un turno por día: hoy solo hay abrir/cerrar |
| 10 | 9.9 | Cliente recurrente vinculado al historial | El POS crea un `Customer` nuevo por venta: no hay historial de cliente en el mostrador |

---

## Resumen de la ronda de implementación (2026-09-18)

> **Qué es**: el cierre de la ronda que ejecutó el roadmap de corrido (Pasos 1→2→3 del brief), bloque por
> bloque, con un commit por tema, gates entre tareas y capturas a 375/1280 px. Los números salen de la
> tabla de bloques de arriba, que es la parte viva de este documento; el inventario medido del inicio
> queda como línea de base.

**Bloques cerrados enteros**: **6** (dólares), **8** (sidebar), **13** (auditoría), y **4** (métodos de
pago). **Bloques cerrados hasta donde no requiere decisión**: **2** (4/6), **3** (6/7), **7** (2/3),
**10** (3/5), **11** (3/6), **12** (3/4). **Bloque 1**: 4 hechas y 3 a medias de 13.

**Estado de las 70 tareas**

| Estado | Tareas | Qué significa |
|---|---|---|
| **HECHO** | **38** | Funciona en producción y tiene su verificación (tests, E2E y/o captura) |
| **DIFERENTE / PARCIAL** | **2** | 1.6 (el cierre se imprime o se guarda como PDF desde el navegador: decisión del owner, no se migra a server) y 10.3/10.5 (impresión por estación y cola de reintentos: sin impresora de red) |
| **Requiere decisión** | **20** | Están listadas abajo; sin la respuesta no se puede implementar sin inventar producto |
| **Pendiente de trabajo** | **9** | 7.3 (helper E2E con `cashier`) y 9.1/9.3-9.9 (POS: 9.1 depende de decisión; el resto es 🟢 «no hacer ahora» según la prioridad del propio brief) |

**Lo que la ronda agregó al producto** (34 tareas que en el inventario figuraban como NO EXISTE):
grupos y permisos del panel (8), núcleo de caja con historial, detalle y reapertura firmada (1),
bloqueo de cobro sin caja (9.2), movimientos de caja (2), devoluciones con aprobación y void (3), cobro
partido y transferencia (4), permisos `canRefund`/`canViewCashHistory` (7), ticket de cocina y de cliente
con reimpresión (10), CSV de cierres, día consolidado y comparación por sucursal (11), venta en curso que
sobrevive a la recarga y cobro bloqueado sin red (12) y el log de acciones sensibles con la hoja de cierre
firmada (13). Además se arregló un **bug de producción latente del carrito** (`42c5d98`), hallado
verificando el camino real del checkout.

**Requiere decisión — estado al 2026-09-17**: las 12 preguntas de la lista inicial están **respondidas** por
el owner. Quedaron **hechas** 15 de las 20 tareas (9.1, 2.5, 2.6, 1.7, 1.8, 1.9, 1.11, 1.12, 1.13, 3.7,
3.2, 11.1, 11.2, 12.1) y **11.4 no aplica** (todo por Telegram). Las 5 restantes —el Bloque 5 completo
(factura) — el owner las reencuadró como **factura simple, NO fiscal**, y se implementan en esta ronda.
El detalle de cada decisión está en «Requiere decisión» al principio de este documento.

**Próxima ronda sugerida** (sin decisiones nuevas): 1.2 (desglose por medio de pago al cerrar), 1.5
(reporte diario de caja consolidado), 7.3 (helper de E2E con `cashier`) y, si el owner prioriza el
mostrador, 9.4/9.5 (holds) y 9.6/9.7 (promos y descuentos con permiso). Las 20 tareas que esperan
decisión se destraban respondiendo los 12 puntos de arriba.
