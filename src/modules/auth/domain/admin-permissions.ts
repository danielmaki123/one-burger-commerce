import { ADMIN_ROLES, type AdminRole } from "@/modules/auth/domain/admin-role";

export function canManageCriticalConfig(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}

export function canManageUsers(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}

/**
 * La personalización del negocio cambia el sitio público completo (nombre,
 * colores, moneda, propina): queda reservada al owner.
 */
export function canManageBusinessSettings(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}

export function canManageMenu(role: AdminRole) {
  return role === ADMIN_ROLES.owner || role === ADMIN_ROLES.manager;
}

/**
 * Las promos cambian lo que el cliente paga y eligen productos del menú, así que
 * van con el mismo permiso que el menú. Cocina no las toca.
 */
export function canManagePromotions(role: AdminRole) {
  return role === ADMIN_ROLES.owner || role === ADMIN_ROLES.manager;
}

export function canApproveReservations(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}

export function canManageInventoryOperations(role: AdminRole) {
  return role === ADMIN_ROLES.owner || role === ADMIN_ROLES.manager;
}

export function canManageOrderOperations(role: AdminRole) {
  return (
    role === ADMIN_ROLES.owner ||
    role === ADMIN_ROLES.manager ||
    role === ADMIN_ROLES.kitchen
  );
}

/**
 * `TASK-ORDERS-RUNTIME-5B` (`D-014`) — **entrar a Pedidos**: localizar un pedido y revisarlo.
 *
 * La contradicción que cierra: la entrada de navegación se le ofrecía a los cuatro roles y la API le
 * respondía **403** al `cashier`, que es justamente quien tiene que localizar el pedido que va a cobrar
 * (`A-66`). La puerta gruesa no servía para esto: `canManageOrderOperations` mete a `kitchen` —que por
 * `D-014` y por la regla del repo («cocina no maneja plata») no entra a Pedidos— y deja afuera al
 * `cashier`.
 *
 * Es una capacidad **nominal** propia, como `canOperateKitchen`: Pedidos localiza y revisa, Cocina opera
 * la comanda, el POS cobra. Hoy los tres conjuntos coinciden en parte por casualidad del producto, no por
 * diseño, y tenerlas separadas permite que el día que dejen de coincidir cada una ya exista.
 *
 * `kitchen` opera exclusivamente `/admin/kitchen`.
 */
export function canViewOrders(role: AdminRole) {
  return (
    role === ADMIN_ROLES.owner ||
    role === ADMIN_ROLES.manager ||
    role === ADMIN_ROLES.cashier
  );
}

/**
 * `TASK-ORDERS-KITCHEN-RUNTIME-002` — **operar Cocina**: aceptar la comanda, iniciar la preparación y
 * marcarla lista.
 *
 * `canManageOrderOperations` es una puerta **gruesa** que dice «puede trabajar con pedidos». Avanzar la
 * comanda es una capacidad **nominal** y tiene su puerta propia, aunque hoy coincida en tres de los
 * cuatro roles, por lo que el contrato de autorización de Pedidos/Cocina dejó escrito:
 *
 * - **El cajero no cocina** (`D-014`): localiza el pedido que tiene que cobrar y lo cobra, pero no
 *   acepta, ni inicia preparación, ni marca listo.
 * - **La entrada de navegación no es la puerta**: el rol llega por cliente y esta función es la que
 *   **rechaza en el servidor** (una UI nunca es frontera de autorización).
 *
 * Es también la puerta de la superficie `/admin/kitchen` y de su API (que además no proyecta un solo
 * campo de dinero: el recorte no depende de esconder nada en React).
 */
export function canOperateKitchen(role: AdminRole) {
  return (
    role === ADMIN_ROLES.owner ||
    role === ADMIN_ROLES.manager ||
    role === ADMIN_ROLES.kitchen
  );
}

/**
 * TASK-105 — usar el punto de venta (abrir la caja, cobrar, cerrar el turno).
 *
 * `kitchen` **no** entra: cocina opera órdenes, no maneja plata. Y `cashier` entra solo acá: no es
 * un manager con menos botones, es un rol de mostrador, así que no hereda menú, promociones,
 * inventario ni configuración (hay un test que lo fija).
 */
export function canUsePOS(role: AdminRole) {
  return (
    role === ADMIN_ROLES.owner ||
    role === ADMIN_ROLES.manager ||
    role === ADMIN_ROLES.cashier
  );
}

/**
 * Bloque 7 del roadmap del POS (Fase 2) — **administrar** la caja, no cobrar en ella.
 *
 * `canUsePOS` abre el mostrador: abrir el turno, cobrar y cerrarlo. Ver el historial de cierres,
 * reabrir un turno, aprobar una devolución o registrar un movimiento de caja es control del dinero, y
 * el cajero no lo tiene: si pudiera, se auditaría a sí mismo. Mismo criterio que el menú y las promos
 * (owner + manager), y cocina queda afuera porque no maneja plata.
 */
export function canManageCash(role: AdminRole) {
  return role === ADMIN_ROLES.owner || role === ADMIN_ROLES.manager;
}

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-014`) — **registrar un cobro sobre un pedido que ya existe**.
 *
 * Es una capacidad **nominal** propia y no una reutilización de `canUsePOS`: operar el mostrador y cobrar la
 * deuda de un pedido son dos decisiones distintas, y hoy coinciden en los tres roles por casualidad del
 * producto, no por diseño. Tenerla separada permite que un rol opere el POS sin cobrar deuda ajena —que es
 * el escenario que `D-014` dejó declarado— y es el sitio donde vive la idempotencia del cobro (`A-71`).
 *
 * `kitchen` no entra: cocina no maneja plata.
 */
export function canCollectPayment(role: AdminRole) {
  return (
    role === ADMIN_ROLES.owner ||
    role === ADMIN_ROLES.manager ||
    role === ADMIN_ROLES.cashier
  );
}

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §18, §19) — **entregar el pedido**: `ready_for_pickup` →
 * `picked_up`.
 *
 * Es una capacidad **nominal** propia, y la razón es un defecto medido: la única puerta que autorizaba una
 * transición de estado era `canManageOrderOperations`, que **incluye a `kitchen`** —cocina no maneja
 * plata y no entrega— y **excluye a `cashier`**, que es exactamente quien entrega en el mostrador. Sin una
 * puerta propia había que elegir entre dejar afuera al cajero o darle la capacidad gruesa y, por efecto
 * secundario, autorizarlo a preparar, cancelar y cerrar.
 *
 * `canDeliverOrder` autoriza **únicamente** esa transición. No habilita ninguna otra: la ruta de estado
 * sigue exigiendo el flujo completo para todo lo demás, y el test de permisos fija que el cajero que
 * entrega sigue sin `canOperateKitchen` ni `canManageOrderOperations`.
 *
 * Es también la puerta del extremo nuevo del POS (entregar desde el mostrador), que es donde el cajero
 * cierra su día.
 */
export function canDeliverOrder(role: AdminRole) {
  return (
    role === ADMIN_ROLES.owner ||
    role === ADMIN_ROLES.manager ||
    role === ADMIN_ROLES.cashier
  );
}

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-014`, `D-016`) — **ver los datos financieros de un pedido**:
 * `status`, `paidAmount`, `outstandingAmount` y `unresolvedAmount`.
 *
 * Es capacidad nominal de `D-014` («ver los datos financieros del pedido»), y hoy no existía: el detalle
 * mostraba dinero con la puerta gruesa de Pedidos, así que `kitchen` podía leer el saldo. La proyección la
 * produce `payments`; esta puerta decide quién puede recibirla.
 *
 * El `cashier` entra —cobra y necesita ver el saldo para saber cuánto falta— y `kitchen` no.
 */
export function canViewOrderFinancials(role: AdminRole) {
  return (
    role === ADMIN_ROLES.owner ||
    role === ADMIN_ROLES.manager ||
    role === ADMIN_ROLES.cashier
  );
}

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-016`) — **administrar la configuración financiera**: monedas, tasas,
 * moneda base, medios de pago y entidades de cobro.
 *
 * Es del **dueño** por la misma razón que `canManageCashConfig`: cambiar la moneda base, una tasa o qué
 * medios se aceptan cambia el número que el sistema espera. No es una reutilización de
 * `canManageBusinessSettings` (marca y contacto) ni de `canManageCashConfig` (reglas del arqueo): son tres
 * decisiones distintas y el día que se separen, cada una ya tiene su puerta.
 */
export function canManageFinanceConfig(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}

/**
 * Bloque 7.1 del roadmap del POS (Fase 2) — **devolver plata**.
 *
 * Es la puerta de las devoluciones y de la bandeja de aprobaciones: firmar una devolución es decidir
 * que la plata sale del cajón. Hoy coincide con `canManageCash` (owner y manager), pero es una función
 * propia a propósito: separarlas permite que un encargado administre la caja sin poder devolver, y el
 * cajero no devuelve ni se aprueba a sí mismo.
 */
export function canRefund(role: AdminRole) {
  return role === ADMIN_ROLES.owner || role === ADMIN_ROLES.manager;
}

/**
 * Tarea 9 del brief (2026-09-17) — **aprobar o rechazar** una devolución: solo el dueño.
 *
 * Decisión del owner: «Solo el owner aprueba devoluciones (nadie la propia)». Pedir una devolución
 * (`canRefund`) es de quien administra la caja; **firmarla** es del dueño, y quien la pidió no la firma
 * ni siendo el dueño: la devolución nace siempre **pendiente** y la resuelve otro par de ojos. Esa es la
 * diferencia con lo que había antes, donde un manager la dejaba aprobada de una.
 */
export function canApproveRefund(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}

/**
 * TASK-AUD-059 — **anular un cobro** (alcance remanente de A-15): decidir que un cobro registrado **nunca
 * contó**.
 *
 * Es una puerta propia y del **dueño**, y no una reutilización de `canRefund` ni de `canApproveRefund`,
 * porque la operación es de otra naturaleza: no hay plata que devolver ni cupo que respetar —el cobro
 * estaba mal cargado— y lo que cambia es el arqueo, el saldo del pedido y la conciliación. El manager
 * puede pedir y el cajero cobrar; corregir el registro que ya entró a la caja lo firma el dueño, que es
 * quien responde por el arqueo.
 */
export function canVoidPayment(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}

/**
 * Bloque 7.1 del roadmap del POS (Fase 2) — **ver el historial de cierres**.
 *
 * Auditar el arqueo de los turnos cerrados. También coincide hoy con `canManageCash`, y también es
 * propia: mirar el historial no tiene por qué venir con el poder de mover plata.
 */
export function canViewCashHistory(role: AdminRole) {
  return role === ADMIN_ROLES.owner || role === ADMIN_ROLES.manager;
}

/**
 * Punto 2 del roadmap (2026-09-18) — **ver el Historial**: los cierres de caja y las facturas emitidas.
 *
 * Es la puerta de la sección `/admin/history`, que junta las dos consultas en un solo lugar. Hoy
 * responde lo mismo que `canViewCashHistory` (dueño y manager) y es propia por el mismo motivo: el
 * Historial es una **sección**, no una pantalla de la caja, y las facturas que lista no son arqueos. El
 * cajero no entra —no audita su propio turno— y cocina tampoco, porque no maneja plata.
 */
export function canViewHistory(role: AdminRole) {
  return role === ADMIN_ROLES.owner || role === ADMIN_ROLES.manager;
}

/**
 * Fase 1a del rediseño de Caja (2026-09-19) — **configurar la caja**, que no es operarla ni auditarla.
 *
 * `canManageCash` habilita el turno (abrir, cerrar, mover plata) y `canViewCashHistory` su lectura. Esta
 * puerta es la de las **reglas con las que se firma un arqueo**: qué monedas se cuentan, con qué
 * denominaciones y si el cajero ve el esperado. Cambiarlas cambia el número que el sistema espera, así
 * que queda en el dueño —misma razón por la que su función es propia y no una reutilización de
 * `canManageBusinessSettings` (marca) ni de `canManageCriticalConfig` (hoy la usan módulos fuera del MVP).
 *
 * La pantalla que la consume vive en `/admin/cash/config`.
 */
export function canManageCashConfig(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}

/**
 * Fase 4 del rediseño de Caja (2026-09-22) — **imprimir documentos de caja** (§8.e del brief).
 *
 * El brief es explícito: «Cajero y Manager: no imprimen desde la app. Owner: puede imprimir cierres,
 * estados y reportes». No existía ninguna puerta de impresión —la hoja la imprimía cualquiera que viera la
 * pantalla—, así que es propia y del dueño: el papel del arqueo es el documento que queda firmado.
 *
 * La hoja de cierre que se abre desde el **detalle en el Historial** se mantiene como estaba: es lectura de
 * auditoría, no la operación del mostrador.
 */
export function canPrintCashDocuments(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}

/**
 * Tarea 9.7 del roadmap del POS (Fase 2) — **descontar plata a mano** en una venta de mostrador.
 *
 * Un **cupón** es una promo cargada, con su lista de códigos y sus usos: el cajero solo escribe el código
 * (tarea 9.6). Un **descuento manual** es distinto: es plata que el cliente deja de pagar porque alguien lo
 * decidió en el momento, sin promo que lo respalde. Lo autoriza quien administra la caja —owner o manager—,
 * no el cajero, y queda asentado en el log de acciones sensibles con su motivo.
 */
export function canDiscountPosSale(role: AdminRole) {
  return role === ADMIN_ROLES.owner || role === ADMIN_ROLES.manager;
}

export function canViewDashboardSummary(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}

export function canViewAdminOverview(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}

export function canViewActivityFeed(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}

export function canViewDailyReports(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}

export function canViewInventoryReports(role: AdminRole) {
  return role === ADMIN_ROLES.owner || role === ADMIN_ROLES.manager;
}

/**
 * Outbox events carry customer PII (name, phone, address) in their payload,
 * so they stay restricted to the owner role.
 */
export function canViewOutboxEvents(role: AdminRole) {
  return role === ADMIN_ROLES.owner;
}
