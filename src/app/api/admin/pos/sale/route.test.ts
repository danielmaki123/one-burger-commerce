import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";
import {
  createInMemoryLocation,
  InMemoryLocationRepository,
} from "@/modules/locations/adapters/in-memory-location-repository";
import type { OrderRecord } from "@/modules/orders/domain/order.types";
import { InMemoryPaymentRepository } from "@/modules/orders/adapters/in-memory-payment-repository";

/**
 * TASK-303b — la ruta del cobro.
 *
 * Lo que se prueba acá es la composición: cocina no cobra, un local fuera del alcance del staff no
 * se cobra, el payload se valida con el campo señalado y una venta válida devuelve el número, lo
 * cobrado y el cambio. El alta y los cobros corren de verdad (`registerPosSale`), con el alta
 * simulada: lo que se está probando es la ruta, no `createOrder` (que tiene sus propios tests).
 */

const requireAdminSessionMock = vi.fn();
const canUsePOSMock = vi.fn();
const canDiscountPosSaleMock = vi.fn();
const manualDiscountAuditMock = vi.fn();
const createPosOrderMock = vi.fn();
const quoteCouponMock = vi.fn();
const paymentRepository = new InMemoryPaymentRepository();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canUsePOS: canUsePOSMock,
  canDiscountPosSale: canDiscountPosSaleMock,
}));

vi.mock("@/app/api/admin/audit-action-helpers", () => ({
  manualDiscountAudit: (input: unknown) => manualDiscountAuditMock(input),
}));

vi.mock("@/modules/pos/adapters/production-pos-sale", () => ({
  createProductionPosSaleDependencies: async () => ({
    // TASK-AUD-004: el doble de la unidad de trabajo corre el trabajo con los mismos dobles (la
    // transacción real se prueba contra PostgreSQL, en `register-pos-sale.postgres.test.ts`).
    runInSaleTransaction: (work: (scope: unknown) => Promise<unknown>) =>
      work({
        createPosOrder: createPosOrderMock,
        paymentRepository,
        // TASK-AUD-005: el turno sigue abierto (la carrera con el cierre va contra PostgreSQL).
        lockShift: async (shiftId: string) => ({ id: shiftId, status: "open" }),
      }),
    businessCurrencyCode: "NIO",
    usdExchangeRate: 36.5,
    quoteCoupon: quoteCouponMock,
  }),
}));

// TASK-308: el cobro también pregunta si el POS está prendido en ese local.
const locationRepository = new InMemoryLocationRepository([
  createInMemoryLocation({ id: "loc_norte", name: "Norte" }),
  createInMemoryLocation({ id: "loc_apagado", name: "Apagado", posEnabled: false }),
]);

vi.mock("@/modules/pos/adapters/production-pos-location", () => ({
  createProductionPosLocationDependencies: () => ({ repository: locationRepository }),
}));

const venta = {
  locationId: "loc_norte",
  customer: { name: "Cliente Mostrador", whatsapp: "88887777", email: "cliente@ejemplo.com" },
  lines: [
    {
      productId: "prod_taco",
      name: "Taco de birria",
      unitPrice: 35,
      packagingUnitAmount: 5,
      quantity: 2,
    },
  ],
  payments: [{ method: "cash" as const, currency: "NIO", amount: 80 }],
};

async function callRoute(body: unknown) {
  const { POST } = await import("./route");

  return POST(
    new Request("http://localhost/api/admin/pos/sale", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

describe("admin pos sale route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    paymentRepository.payments.length = 0;
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "admin_1", role: "cashier", locationIds: [] },
    });
    canUsePOSMock.mockReturnValue(true);
    canDiscountPosSaleMock.mockReturnValue(true);
    createPosOrderMock.mockResolvedValue({
      order: { id: "ord_01", orderNumber: "P-ABC123", total: 80 } as OrderRecord,
      reused: false,
    });
  });

  it("sin sesión responde 401", async () => {
    requireAdminSessionMock.mockRejectedValue(new AuthError(401, "UNAUTHORIZED", "No session"));

    const response = await callRoute(venta);

    expect(response.status).toBe(401);
    expect(createPosOrderMock).not.toHaveBeenCalled();
  });

  it("cocina no cobra: 403", async () => {
    canUsePOSMock.mockReturnValue(false);

    const response = await callRoute(venta);

    expect(response.status).toBe(403);
    expect(createPosOrderMock).not.toHaveBeenCalled();
  });

  it("un local fuera del alcance del staff responde 403", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "admin_2", role: "cashier", locationIds: ["loc_sur"] },
    });

    const response = await callRoute(venta);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.fields.locationId).toContain("acceso");
    expect(createPosOrderMock).not.toHaveBeenCalled();
  });

  // TASK-308: cobrar en un local con el POS apagado es 403, aunque el payload sea válido.
  it("un local con el punto de venta apagado responde 403", async () => {
    const response = await callRoute({ ...venta, locationId: "loc_apagado" });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(createPosOrderMock).not.toHaveBeenCalled();
    expect(paymentRepository.payments).toHaveLength(0);
  });

  it("un payload sin cobros responde 422 con el campo señalado", async () => {
    const response = await callRoute({ ...venta, payments: [] });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.fields.payments).toContain("cobro");
    expect(createPosOrderMock).not.toHaveBeenCalled();
  });

  it("una venta válida devuelve número, total, cobrado y cambio", async () => {
    const response = await callRoute({
      ...venta,
      payments: [{ method: "cash", currency: "NIO", amount: 100 }],
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data).toMatchObject({
      orderId: "ord_01",
      orderNumber: "P-ABC123",
      total: 80,
      paid: 100,
      change: 20,
    });
    expect(body.data.payments).toHaveLength(1);
    expect(body.data.payments[0]).toMatchObject({ method: "cash", amount: 100, currency: "NIO" });
    expect(createPosOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "pickup",
        customerEmail: "cliente@ejemplo.com",
        items: [{ productId: "prod_taco", quantity: 2, modifierOptionIds: [], notes: null }],
      }),
    );
  });

  it("un cobro en dólares se registra con su moneda", async () => {
    const response = await callRoute({
      ...venta,
      payments: [{ method: "cash", currency: "usd", amount: 3 }],
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.payments[0].currency).toBe("USD");
    // 3 × 36.5 = 109.50 contra un total de 80.
    expect(body.data.change).toBe(29.5);
  });

  /**
   * Tarea 9.6 del roadmap del POS (Fase 2) — una venta con cupón cobra el total **con descuento**.
   *
   * El cliente ya vio el número (el POS lo cotizó al aplicar el código): con el cupón, esta venta se paga
   * con 73 y el código viaja al alta, que es la que valida y consume el uso de la promo.
   */
  it("una venta con cupón cotiza el descuento antes de cobrar y lo manda al alta", async () => {
    quoteCouponMock.mockResolvedValue({
      coupon: {
        code: "BIENVENIDA10",
        type: "percentage",
        value: 10,
        buyQuantity: null,
        freeQuantity: null,
        scopeType: null,
        scopeId: null,
      },
      subtotal: 70,
      discount: 7,
    });
    // El alta crea el pedido con el descuento aplicado: 70 + 10 de empaque − 7 de cupón.
    createPosOrderMock.mockResolvedValue({
      order: { id: "ord_01", orderNumber: "P-ABC123", total: 73 } as OrderRecord,
      reused: false,
    });

    const response = await callRoute({
      ...venta,
      couponCode: "bienvenida10",
      payments: [{ method: "cash", currency: "NIO", amount: 73 }],
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(quoteCouponMock).toHaveBeenCalledWith({
      couponCode: "BIENVENIDA10",
      lines: [{ productId: "prod_taco", quantity: 2 }],
    });
    expect(createPosOrderMock.mock.calls[0][0]).toMatchObject({ couponCode: "BIENVENIDA10" });
    expect(body.data.payments[0].amount).toBe(73);
  });

  /**
   * Tarea 9.7 del roadmap del POS (Fase 2) — el **descuento manual**: permiso propio y asiento en el log.
   *
   * Un cupón lo escribe el cajero (tarea 9.6); un descuento manual es plata que el cliente deja de pagar
   * porque alguien lo decidió: lo autoriza quien administra la caja y tiene que quedar firmado con su motivo.
   */
  it("sin permiso para descontar a mano, la venta con descuento responde 403 y no crea nada", async () => {
    canDiscountPosSaleMock.mockReturnValue(false);

    const response = await callRoute({
      ...venta,
      manualDiscount: { kind: "percentage", value: 10, reason: "Cliente de siempre" },
      payments: [{ method: "cash", currency: "NIO", amount: 73 }],
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.fields.discount).toContain("descuento manual");
    expect(createPosOrderMock).not.toHaveBeenCalled();
    expect(manualDiscountAuditMock).not.toHaveBeenCalled();
  });

  it("con permiso, el descuento manual baja el cobro y queda asentado con su motivo", async () => {
    canDiscountPosSaleMock.mockReturnValue(true);
    createPosOrderMock.mockResolvedValue({
      order: { id: "ord_01", orderNumber: "P-ABC123", total: 73 } as OrderRecord,
      reused: false,
    });

    const response = await callRoute({
      ...venta,
      manualDiscount: { kind: "percentage", value: 10, reason: "Cliente de siempre" },
      payments: [{ method: "cash", currency: "NIO", amount: 73 }],
    });

    expect(response.status).toBe(201);
    expect(createPosOrderMock.mock.calls[0][0]).toMatchObject({
      manualDiscount: { kind: "percentage", value: 10, reason: "Cliente de siempre" },
    });
    expect(manualDiscountAuditMock).toHaveBeenCalledWith({
      actorUserId: "admin_1",
      orderId: "ord_01",
      kind: "percentage",
      value: 10,
      reason: "Cliente de siempre",
    });
  });

  /**
   * Tarea 11 del brief (2026-09-17) — el reintento del mismo cobro responde **200** y no cobra de nuevo.
   *
   * Es lo que la pantalla necesita para decir «esa venta ya estaba registrada»: el alta reconoció el
   * UUID, el pedido es el del primer intento y no hay un segundo cobro en el arqueo.
   */
  it("un reintento con la misma clave responde 200 y no registra otro cobro", async () => {
    createPosOrderMock.mockResolvedValue({
      order: { id: "ord_01", orderNumber: "P-ABC123", total: 80 } as OrderRecord,
      reused: true,
    });
    await paymentRepository.createPayment({
      orderId: "ord_01",
      method: "cash",
      amount: 80,
      currency: "NIO",
      changeAmount: 0,
    });

    const response = await callRoute(venta);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.reused).toBe(true);
    expect(body.data.paid).toBe(80);
    expect(paymentRepository.payments).toHaveLength(1);
  });
});
