import { describe, expect, it } from "vitest";

import {
  canDeliverOrder,
  canDiscountPosSale,
  canManageBusinessSettings,
  canManageCash,
  canManageCashConfig,
  canPrintCashDocuments,
  canManageCriticalConfig,
  canManageInventoryOperations,
  canManageMenu,
  canManageOrderOperations,
  canManagePromotions,
  canManageUsers,
  canApproveRefund,
  canOperateKitchen,
  canRefund,
  canUsePOS,
  canViewCashHistory,
  canViewDashboardSummary,
  canViewHistory,
  canViewOrderFinancials,
  canViewOrders,
  canViewOutboxEvents,
  canVoidPayment,
} from "@/modules/auth/domain/admin-permissions";
import { ADMIN_ROLES, type AdminRole } from "@/modules/auth/domain/admin-role";

const ALL_ADMIN_ROLES: AdminRole[] = [
  ADMIN_ROLES.owner,
  ADMIN_ROLES.manager,
  ADMIN_ROLES.cashier,
  ADMIN_ROLES.kitchen,
];

describe("admin permissions", () => {
  /**
   * Tarea 9.7 del roadmap del POS (Fase 2) — **descontar plata a mano** en el mostrador.
   *
   * Un cupón es una promo cargada con su lista de códigos y sus usos: el cajero solo escribe el código. Un
   * descuento manual, en cambio, es plata que el cliente deja de pagar porque alguien lo decidió en el
   * momento: lo autoriza quien administra la caja (owner o manager), no el cajero.
   */
  it("solo owner y manager descuentan a mano en el POS (9.7)", () => {
    expect(canDiscountPosSale(ADMIN_ROLES.owner)).toBe(true);
    expect(canDiscountPosSale(ADMIN_ROLES.manager)).toBe(true);
    expect(canDiscountPosSale(ADMIN_ROLES.cashier)).toBe(false);
    expect(canDiscountPosSale(ADMIN_ROLES.kitchen)).toBe(false);
  });

  /**
   * TASK-105 — el permiso del punto de venta.
   *
   * La caja no es un permiso más de los que ya existían: `kitchen` opera órdenes pero no cobra, y
   * `cashier` cobra pero no toca el menú ni la configuración. Por eso es una función propia y no una
   * reutilización de `canManageOrderOperations`.
   */
  it("lets owner, manager and cashier use the POS", () => {
    expect(canUsePOS(ADMIN_ROLES.owner)).toBe(true);
    expect(canUsePOS(ADMIN_ROLES.manager)).toBe(true);
    expect(canUsePOS(ADMIN_ROLES.cashier)).toBe(true);
    expect(canUsePOS(ADMIN_ROLES.kitchen)).toBe(false);
  });

  it("el cajero no hereda los permisos de manager (TASK-105)", () => {
    // La caja cobra, no administra: si heredara permisos de manager, el rol nuevo abriría la puerta
    // a editar el menú y las promociones.
    expect(canManageMenu(ADMIN_ROLES.cashier)).toBe(false);
    expect(canManagePromotions(ADMIN_ROLES.cashier)).toBe(false);
    expect(canManageUsers(ADMIN_ROLES.cashier)).toBe(false);
    expect(canManageBusinessSettings(ADMIN_ROLES.cashier)).toBe(false);
    expect(canManageCriticalConfig(ADMIN_ROLES.cashier)).toBe(false);
    expect(canManageInventoryOperations(ADMIN_ROLES.cashier)).toBe(false);
    expect(canViewOutboxEvents(ADMIN_ROLES.cashier)).toBe(false);
  });
  it("lets owner and manager manage the menu", () => {
    expect(canManageMenu(ADMIN_ROLES.owner)).toBe(true);
    expect(canManageMenu(ADMIN_ROLES.manager)).toBe(true);
    expect(canManageMenu(ADMIN_ROLES.kitchen)).toBe(false);
  });

  it("lets all admin roles operate orders", () => {
    expect(canManageOrderOperations(ADMIN_ROLES.owner)).toBe(true);
    expect(canManageOrderOperations(ADMIN_ROLES.manager)).toBe(true);
    expect(canManageOrderOperations(ADMIN_ROLES.kitchen)).toBe(true);
  });

  /**
   * `TASK-ORDERS-KITCHEN-RUNTIME-002` — **operar Cocina** es una capacidad propia.
   *
   * `canManageOrderOperations` es una puerta **gruesa** (owner, manager y kitchen) que dice «puede
   * trabajar con pedidos». Avanzar la comanda es otra cosa y tiene su propia puerta, por dos motivos
   * medidos:
   *
   * - **El cajero no cocina** (`D-014`): localiza y cobra el pedido que tiene que cobrar, pero no
   *   acepta, ni inicia preparación, ni marca listo. Su superficie es el POS y `/admin/orders` para
   *   localizar; Cocina no es suya.
   * - **El rol llega por cliente, la autorización por servidor**: la entrada de navegación filtra lo que
   *   se ofrece, y esta puerta es la que **rechaza** en el servidor cuando alguien entra por URL.
   */
  it("opera Cocina el owner, el manager y el rol de cocina — no el cajero", () => {
    expect(canOperateKitchen(ADMIN_ROLES.owner)).toBe(true);
    expect(canOperateKitchen(ADMIN_ROLES.manager)).toBe(true);
    expect(canOperateKitchen(ADMIN_ROLES.kitchen)).toBe(true);
    expect(canOperateKitchen(ADMIN_ROLES.cashier)).toBe(false);
  });

  it("la puerta de Cocina no es la gruesa: el cajero no está adentro", () => {
    // La puerta gruesa de pedidos no tiene al cajero (hoy), pero Cocina **sí** podría haberlo heredado
    // si se hubiera reutilizado una sola función para las dos cosas: es exactamente lo que se prueba.
    const allRoles: AdminRole[] = [
      ADMIN_ROLES.owner,
      ADMIN_ROLES.manager,
      ADMIN_ROLES.kitchen,
      ADMIN_ROLES.cashier,
    ];

    expect(allRoles.filter(canOperateKitchen)).toEqual([
      ADMIN_ROLES.owner,
      ADMIN_ROLES.manager,
      ADMIN_ROLES.kitchen,
    ]);
    expect(canOperateKitchen(ADMIN_ROLES.cashier)).toBe(false);
    // Y el cajero sigue pudiendo lo suyo: cobrar. Cocina y caja son capacidades distintas.
    expect(canUsePOS(ADMIN_ROLES.cashier)).toBe(true);
  });

  it("lets only owner manage users and critical config", () => {
    expect(canManageUsers(ADMIN_ROLES.owner)).toBe(true);
    expect(canManageCriticalConfig(ADMIN_ROLES.owner)).toBe(true);
    expect(canManageUsers(ADMIN_ROLES.manager)).toBe(false);
    expect(canManageCriticalConfig(ADMIN_ROLES.manager)).toBe(false);
    expect(canManageUsers(ADMIN_ROLES.kitchen)).toBe(false);
    expect(canManageCriticalConfig(ADMIN_ROLES.kitchen)).toBe(false);
  });

  it("lets only owner view dashboard summary", () => {
    expect(canViewDashboardSummary(ADMIN_ROLES.owner)).toBe(true);
    expect(canViewDashboardSummary(ADMIN_ROLES.manager)).toBe(false);
    expect(canViewDashboardSummary(ADMIN_ROLES.kitchen)).toBe(false);
  });

  it("lets only owner read outbox events because they carry customer PII", () => {
    expect(canViewOutboxEvents(ADMIN_ROLES.owner)).toBe(true);
    expect(canViewOutboxEvents(ADMIN_ROLES.manager)).toBe(false);
    expect(canViewOutboxEvents(ADMIN_ROLES.kitchen)).toBe(false);
  });

  it("lets owner and manager run inventory operations", () => {
    expect(canManageInventoryOperations(ADMIN_ROLES.owner)).toBe(true);
    expect(canManageInventoryOperations(ADMIN_ROLES.manager)).toBe(true);
    expect(canManageInventoryOperations(ADMIN_ROLES.kitchen)).toBe(false);
  });

  it("lets only owner change the business settings", () => {
    expect(canManageBusinessSettings(ADMIN_ROLES.owner)).toBe(true);
    expect(canManageBusinessSettings(ADMIN_ROLES.manager)).toBe(false);
    expect(canManageBusinessSettings(ADMIN_ROLES.kitchen)).toBe(false);
  });

  it("lets owner and manager manage promotions", () => {
    // Una promo toca precios del menú: es trabajo de manager, no de cocina.
    expect(canManagePromotions(ADMIN_ROLES.owner)).toBe(true);
    expect(canManagePromotions(ADMIN_ROLES.manager)).toBe(true);
    expect(canManagePromotions(ADMIN_ROLES.kitchen)).toBe(false);
  });

  /**
   * Bloque 7 del roadmap del POS (Fase 2) — administrar la caja es otra cosa que cobrar.
   *
   * `canUsePOS` habilita el mostrador (abrir, cobrar, cerrar). Ver el historial de cierres, reabrir un
   * turno, aprobar una devolución o hacer un movimiento de caja es **control del dinero**: si el
   * cajero pudiera, se estaría auditando a sí mismo, que es exactamente lo que el arqueo evita.
   */
  it("solo owner y manager administran la caja (Bloque 7)", () => {
    expect(canManageCash(ADMIN_ROLES.owner)).toBe(true);
    expect(canManageCash(ADMIN_ROLES.manager)).toBe(true);
    expect(canManageCash(ADMIN_ROLES.cashier)).toBe(false);
    expect(canManageCash(ADMIN_ROLES.kitchen)).toBe(false);
  });

  /**
   * Bloque 7.1 del roadmap del POS (Fase 2) — devolver plata y auditar la caja son **dos permisos
   * distintos** de administrarla.
   *
   * `canManageCash` habilita abrir, cerrar, mover plata y reabrir un turno. Devolver un cobro
   * (`canRefund`) y ver el historial de cierres (`canViewCashHistory`) son puertas propias: hoy las
   * tres responden lo mismo (owner y manager), pero separarlas permite, por ejemplo, que un encargado
   * vea el historial sin poder devolver. El cajero no tiene ninguna de las tres: no se audita ni se
   * devuelve a sí mismo.
   */
  it("devolver y ver el historial son permisos propios (Bloque 7.1)", () => {
    expect(canRefund(ADMIN_ROLES.owner)).toBe(true);
    expect(canRefund(ADMIN_ROLES.manager)).toBe(true);
    expect(canRefund(ADMIN_ROLES.cashier)).toBe(false);
    expect(canRefund(ADMIN_ROLES.kitchen)).toBe(false);
  });

  /**
   * Tarea 9 del brief (2026-09-17) — «solo el owner aprueba devoluciones (nadie la propia)».
   *
   * Firmar una devolución mueve plata del cajón y es lo que el dueño se reservó: el manager puede pedirla
   * (como quien administra la caja) pero no firmarla, y el cajero tampoco.
   */
  it("canApproveRefund: solo el dueño firma una devolución", () => {
    expect(canApproveRefund(ADMIN_ROLES.owner)).toBe(true);
    expect(canApproveRefund(ADMIN_ROLES.manager)).toBe(false);
    expect(canApproveRefund(ADMIN_ROLES.cashier)).toBe(false);
    expect(canApproveRefund(ADMIN_ROLES.kitchen)).toBe(false);

    expect(canViewCashHistory(ADMIN_ROLES.owner)).toBe(true);
    expect(canViewCashHistory(ADMIN_ROLES.manager)).toBe(true);
    expect(canViewCashHistory(ADMIN_ROLES.cashier)).toBe(false);
    expect(canViewCashHistory(ADMIN_ROLES.kitchen)).toBe(false);
  });

  /**
   * Punto 2 del roadmap (2026-09-18) — la sección **Historial** (`/admin/history`: cierres y facturas).
   *
   * Es una sección propia y por eso tiene su permiso: adentro lista dos cosas distintas (arqueos de
   * caja y facturas emitidas). El cajero no la ve —se estaría auditando—, cocina tampoco, y el manager
   * entra pero acotado a sus sucursales (eso lo resuelve el alcance, no este permiso).
   */
  it("canViewHistory: el Historial es de owner y manager", () => {
    expect(canViewHistory(ADMIN_ROLES.owner)).toBe(true);
    expect(canViewHistory(ADMIN_ROLES.manager)).toBe(true);
    expect(canViewHistory(ADMIN_ROLES.cashier)).toBe(false);
    expect(canViewHistory(ADMIN_ROLES.kitchen)).toBe(false);
  });

  /**
   * Fase 1a del rediseño de Caja (2026-09-19) — **configurar la caja**.
   *
   * Es una puerta propia y no una reutilización: `canManageCash` habilita operar y auditar el turno
   * (owner y manager), y `canManageBusinessSettings` es la marca del negocio. Configurar la caja cambia
   * qué monedas se cuentan, con qué billetes y si el cajero ve el esperado —las reglas con las que se
   * firma un arqueo—, así que queda en el dueño y su función dice eso y no otra cosa.
   */
  it("canManageCashConfig: la configuración de la caja es del dueño", () => {
    expect(canManageCashConfig(ADMIN_ROLES.owner)).toBe(true);
    expect(canManageCashConfig(ADMIN_ROLES.manager)).toBe(false);
    expect(canManageCashConfig(ADMIN_ROLES.cashier)).toBe(false);
    expect(canManageCashConfig(ADMIN_ROLES.kitchen)).toBe(false);
  });

  /**
   * Fase 4 del rediseño de Caja (2026-09-22) — **imprimir el papel del arqueo** (§8.e del brief).
   *
   * «Cajero y Manager: no imprimen desde la app. Owner: sí.» El papel del cierre es el documento que queda
   * firmado, así que la puerta es del dueño y es propia: auditar la caja no tiene por qué venir con la
   * imprenta.
   */
  it("canPrintCashDocuments: el papel del arqueo lo imprime el dueño", () => {
    expect(canPrintCashDocuments(ADMIN_ROLES.owner)).toBe(true);
    expect(canPrintCashDocuments(ADMIN_ROLES.manager)).toBe(false);
    expect(canPrintCashDocuments(ADMIN_ROLES.cashier)).toBe(false);
    expect(canPrintCashDocuments(ADMIN_ROLES.kitchen)).toBe(false);
  });

  /**
   * TASK-AUD-059 — **anular un cobro** (alcance remanente de A-15).
   *
   * Devolver plata (`canRefund`) y aprobarlo (`canApproveRefund`) son actos sobre plata que **sale** del
   * cajón. Anular un cobro es distinto: decide que ese cobro **nunca contó** —sale del arqueo, del saldo
   * del pedido y de la conciliación— y es lo que corrige un cobro mal cargado. Por eso es una puerta
   * propia y del **dueño**: no es una devolución (no hay plata que devolver, no hay cupo que respetar) ni
   * un movimiento de caja.
   */
  it("canVoidPayment: anular un cobro es del dueño", () => {
    expect(canVoidPayment(ADMIN_ROLES.owner)).toBe(true);
    expect(canVoidPayment(ADMIN_ROLES.manager)).toBe(false);
    expect(canVoidPayment(ADMIN_ROLES.cashier)).toBe(false);
    expect(canVoidPayment(ADMIN_ROLES.kitchen)).toBe(false);
  });

  /**
   * `TASK-ORDERS-RUNTIME-5B` (`D-014`) — **entrar a Pedidos**: localizar un pedido y revisarlo.
   *
   * La contradicción que cierra: la entrada de navegación se le ofrecía a los cuatro roles
   * (`admin-layout-helpers.ts`, `canSee: everyRole`) y la API le respondía **403** al `cashier`, que es
   * justamente quien tiene que localizar el pedido que va a cobrar. La puerta gruesa
   * (`canManageOrderOperations`) no servía: metía a `kitchen`, que por `D-014` y por la regla del repo
   * («cocina no maneja plata») **no** entra a Pedidos, y dejaba afuera al `cashier`.
   *
   * Es una capacidad **nominal** propia: Pedidos localiza y revisa, Cocina opera la comanda, el POS
   * cobra. Hoy los tres conjuntos coinciden en parte por casualidad del producto, no por diseño.
   */
  it("canViewOrders: owner, manager y cashier entran a Pedidos — cocina no", () => {
    expect(canViewOrders(ADMIN_ROLES.owner)).toBe(true);
    expect(canViewOrders(ADMIN_ROLES.manager)).toBe(true);
    expect(canViewOrders(ADMIN_ROLES.cashier)).toBe(true);
    expect(canViewOrders(ADMIN_ROLES.kitchen)).toBe(false);
  });

  it("la puerta de Pedidos no es ninguna de las que ya existían", () => {
    // `canManageOrderOperations` incluye a cocina y deja afuera al cajero; `canOperateKitchen` es lo
    // contrario. Si `canViewOrders` hubiera reutilizado una de las dos, alguno de los dos roles quedaría
    // donde no va: por eso el conjunto se fija entero y contra las otras dos puertas.
    expect(ALL_ADMIN_ROLES.filter(canViewOrders)).toEqual([
      ADMIN_ROLES.owner,
      ADMIN_ROLES.manager,
      ADMIN_ROLES.cashier,
    ]);

    expect(ALL_ADMIN_ROLES.filter(canViewOrders)).not.toEqual(
      ALL_ADMIN_ROLES.filter(canManageOrderOperations),
    );
    expect(ALL_ADMIN_ROLES.filter(canViewOrders)).not.toEqual(
      ALL_ADMIN_ROLES.filter(canOperateKitchen),
    );
  });

  /**
   * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-016`) + `TASK-ORDERS-RUNTIME-5B` — **ver los datos financieros**
   * del pedido. La capacidad existía desde Money/Payments y **no tenía un solo consumidor en producción**;
   * esta TASK es la que la aplica (el recorte del detalle y la puerta de la factura de `A-70`).
   */
  it("canViewOrderFinancials: la plata del pedido no la ve cocina", () => {
    expect(canViewOrderFinancials(ADMIN_ROLES.owner)).toBe(true);
    expect(canViewOrderFinancials(ADMIN_ROLES.manager)).toBe(true);
    expect(canViewOrderFinancials(ADMIN_ROLES.cashier)).toBe(true);
    expect(canViewOrderFinancials(ADMIN_ROLES.kitchen)).toBe(false);
  });

  it("entrar a Pedidos y ver su plata son dos puertas distintas", () => {
    // Hoy coinciden, y el test lo dice a propósito: el día que un rol localice pedidos sin ver montos
    // (por ejemplo, un rol de salón), la puerta financiera ya está separada y no hay que inventarla.
    expect(canViewOrders(ADMIN_ROLES.cashier)).toBe(true);
    expect(canViewOrderFinancials(ADMIN_ROLES.cashier)).toBe(true);
    expect(canViewOrderFinancials(ADMIN_ROLES.kitchen)).toBe(false);
  });

  /**
   * `TASK-ORDER-POS-OPERATIONAL-006` (brief §18, §19) — **entregar el pedido** (`ready_for_pickup` →
   * `picked_up`) es una capacidad **nominal** propia.
   *
   * El problema que cierra: hasta acá la única puerta que autorizaba la transición de estado era
   * `canManageOrderOperations`, que **incluye a cocina y excluye al cajero**. El cajero es exactamente quien
   * entrega el pedido en el mostrador, así que sin una puerta propia había que elegir entre dejarlo afuera
   * —el defecto— o darle la capacidad **gruesa** y, por efecto secundario, autorizarlo a preparar, cancelar
   * y cerrar, que el brief §19 prohíbe.
   *
   * La puerta autoriza **sólo** la entrega; que el rol no pueda hacer el resto del flujo es una aserción
   * aparte y explícita (los dos tests de abajo), porque el riesgo real de una capacidad nueva no es que
   * falte, es que venga con más de lo que dice.
   */
  it("canDeliverOrder: owner, manager y cashier entregan — cocina no", () => {
    expect(canDeliverOrder(ADMIN_ROLES.owner)).toBe(true);
    expect(canDeliverOrder(ADMIN_ROLES.manager)).toBe(true);
    expect(canDeliverOrder(ADMIN_ROLES.cashier)).toBe(true);
    expect(canDeliverOrder(ADMIN_ROLES.kitchen)).toBe(false);
  });

  it("entregar no es la puerta gruesa de pedidos ni la de Cocina", () => {
    // Los dos conjuntos son distintos a propósito: si `canDeliverOrder` hubiera reutilizado cualquiera de
    // las dos, el cajero seguiría afuera (la gruesa no lo tiene) o cocina entraría (Cocina sí lo tiene).
    expect(ALL_ADMIN_ROLES.filter(canDeliverOrder)).not.toEqual(
      ALL_ADMIN_ROLES.filter(canManageOrderOperations),
    );
    expect(ALL_ADMIN_ROLES.filter(canDeliverOrder)).not.toEqual(
      ALL_ADMIN_ROLES.filter(canOperateKitchen),
    );
  });

  it("el cajero que entrega no gana preparar, cancelar ni cerrar", () => {
    // Brief §19: la capacidad autoriza **únicamente** la transición de entrega. El cajero sigue sin poder
    // avanzar la comanda (`canOperateKitchen`) ni operar el flujo de pedidos en bloque
    // (`canManageOrderOperations`), que es de donde salen preparar, cancelar y cerrar.
    expect(canDeliverOrder(ADMIN_ROLES.cashier)).toBe(true);
    expect(canOperateKitchen(ADMIN_ROLES.cashier)).toBe(false);
    expect(canManageOrderOperations(ADMIN_ROLES.cashier)).toBe(false);
  });
});
