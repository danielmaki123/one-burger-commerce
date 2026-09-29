import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";
import { OrderError } from "@/modules/orders/domain/order-errors";

/**
 * Hallazgo N3 de la auditoría post-deploy (2026-09-23) — `POST /api/admin/orders/[id]/payment`.
 *
 * Cobrar un pedido que ya existe es plata que entra al cajón: mismo permiso que la venta de mostrador
 * (`canUsePOS`) y **alcance por sucursal** (un cajero no cobra el pedido de otra sucursal ni con la URL
 * directa).
 */

const requireAdminSessionMock = vi.fn();
const findOrderByIdMock = vi.fn();
const requirePosLocationMock = vi.fn();
const registerOrderPaymentMock = vi.fn();
const loadBusinessSettingsMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: () => requireAdminSessionMock(),
}));

vi.mock("@/modules/orders/adapters/prisma-order-repository", () => ({
  PrismaOrderRepository: class {
    findOrderById(id: string) {
      return findOrderByIdMock(id);
    }
  },
}));

vi.mock("@/modules/orders/adapters/prisma-payment-repository", () => ({
  PrismaPaymentRepository: class {},
}));

vi.mock("@/modules/orders/adapters/prisma-shift-repository", () => ({
  PrismaShiftRepository: class {},
}));

vi.mock("@/modules/business-settings/adapters/prisma-business-settings-repository", () => ({
  PrismaBusinessSettingsRepository: class {},
}));

vi.mock("@/modules/business-settings/features/get-public-business-settings/get-public-business-settings", () => ({
  loadBusinessSettings: () => loadBusinessSettingsMock(),
}));

vi.mock("@/app/api/admin/pos/pos-route-helpers", () => ({
  requirePosLocation: (input: unknown) => requirePosLocationMock(input),
}));

/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-83`) — la composición lee la moneda base y las tasas de
 * **`money`**. El doble existe porque el job `verify` del CI corre los unitarios **sin** `DATABASE_URL`: un
 * adaptador real que instancia Prisma haría fallar la ruta con 500 en vez de ejercitar la regla.
 */
vi.mock("@/modules/money/adapters/production-money-context", () => ({
  readProductionMoney: async () => ({
    context: {
      baseCurrencyCode: "NIO",
      locale: "es-NI",
      rates: { USD: 36.5 },
      knownCurrencyCodes: ["NIO", "USD"],
    },
    currencies: [
      { code: "NIO", name: "Córdoba", symbol: "C$", decimals: 2, isBase: true },
      { code: "USD", name: "Dólar", symbol: "US$", decimals: 2, isBase: false },
    ],
  }),
}));

vi.mock("@/modules/orders/features/register-order-payment/register-order-payment", () => ({
  registerOrderPayment: (input: unknown, deps: unknown) => registerOrderPaymentMock(input, deps),
}));

const order = {
  id: "ord_01",
  orderNumber: "P-MUDF8E1K",
  locationId: "loc_principal",
  status: "new",
  total: 280,
};

function post(body: unknown) {
  return new Request("http://localhost/api/admin/orders/ord_01/payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const context = { params: Promise.resolve({ id: "ord_01" }) };

describe("POST /api/admin/orders/[id]/payment", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_cashier", role: "cashier", locationIds: ["loc_principal"] },
    });
    findOrderByIdMock.mockResolvedValue(order);
    requirePosLocationMock.mockResolvedValue("loc_principal");
    loadBusinessSettingsMock.mockResolvedValue({ currencyCode: "NIO", usdExchangeRate: 36.5 });
    registerOrderPaymentMock.mockResolvedValue({
      data: { id: "pay_01", orderId: "ord_01", method: "cash", amount: 280, currency: "NIO" },
      order,
    });
  });

  it("registra el cobro del pedido y lo atribuye al turno", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      post({ method: "cash", amount: 280, currency: "nio", idempotencyKey: "key_route_1" }),
      context,
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data).toMatchObject({ method: "cash", amount: 280, currency: "NIO" });
    expect(registerOrderPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "ord_01", method: "cash", amount: 280 }),
      expect.anything(),
    );
    // El alcance se resuelve con el **local del pedido**: no lo elige el cliente del payload.
    expect(requirePosLocationMock).toHaveBeenCalledWith(
      expect.objectContaining({ requested: "loc_principal" }),
    );
  });

  it("cocina no cobra: 403 sin tocar el caso de uso", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_kitchen", role: "kitchen", locationIds: ["loc_principal"] },
    });

    const { POST } = await import("./route");
    const response = await POST(post({ method: "cash", amount: 280, currency: "NIO", idempotencyKey: "key_route_1" }), context);

    expect(response.status).toBe(403);
    expect(registerOrderPaymentMock).not.toHaveBeenCalled();
  });

  it("un pedido de otra sucursal responde 403 (lo corta el guardián del POS)", async () => {
    requirePosLocationMock.mockRejectedValue(
      new AuthError(403, "FORBIDDEN", "Insufficient permissions"),
    );

    const { POST } = await import("./route");
    const response = await POST(post({ method: "cash", amount: 280, currency: "NIO", idempotencyKey: "key_route_1" }), context);

    expect(response.status).toBe(403);
    expect(registerOrderPaymentMock).not.toHaveBeenCalled();
  });

  it("un monto que no es positivo se rechaza con el campo señalado (422)", async () => {
    const { POST } = await import("./route");
    const response = await POST(post({ method: "cash", amount: 0, currency: "NIO", idempotencyKey: "key_route_1" }), context);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.fields.amount).toBe("Tiene que ser mayor que cero.");
    expect(registerOrderPaymentMock).not.toHaveBeenCalled();
  });

  it("un medio que no existe (o «mixed») se rechaza: es un resultado, no algo que se elija", async () => {
    const { POST } = await import("./route");
    const response = await POST(post({ method: "mixed", amount: 280, currency: "NIO", idempotencyKey: "key_route_1" }), context);

    expect(response.status).toBe(422);
  });

  it("un pedido que no existe responde 404 del caso de uso", async () => {
    findOrderByIdMock.mockResolvedValue(null);

    const { POST } = await import("./route");
    const response = await POST(post({ method: "cash", amount: 280, currency: "NIO", idempotencyKey: "key_route_1" }), context);

    expect(response.status).toBe(404);
  });

  it("un pedido ya cobrado sale como 409 con el motivo del caso de uso", async () => {
    registerOrderPaymentMock.mockRejectedValue(
      new OrderError(409, "CONFLICT", "Ese pedido ya está cobrado.", {
        order: "Ese pedido ya está cobrado.",
      }),
    );

    const { POST } = await import("./route");
    const response = await POST(post({ method: "cash", amount: 280, currency: "NIO", idempotencyKey: "key_route_1" }), context);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.message).toBe("Ese pedido ya está cobrado.");
  });
});
