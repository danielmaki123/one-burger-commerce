import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";
import { OrderError } from "@/modules/orders/domain/order-errors";

/**
 * Hallazgo N3 de la auditoría post-deploy (2026-09-23) — `POST /api/admin/orders/[id]/payment`, adaptado por
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §26–§28, §37–§39) a un **checkout completo**.
 *
 * Cobrar un pedido que ya existe es plata que entra al cajón: mismo permiso que la venta de mostrador
 * (`canCollectPayment`) y **alcance por sucursal** (un cajero no cobra el pedido de otra sucursal ni con la
 * URL directa). Además, el payload ahora trae la **lista de medios** y el `paymentMethodId` de cada uno: el
 * servidor resuelve el tipo canónico, la entidad y si pide referencia contra el catálogo configurado, y un
 * `kind` mandado por el cliente **no se usa** (el schema ni lo acepta).
 *
 * La ruta sigue siendo **la única** del cobro de deuda: un endpoint paralelo (`/api/admin/pos/pay-order` y
 * equivalentes) está prohibido por el brief §26.
 */

const requireAdminSessionMock = vi.fn();
const findOrderByIdMock = vi.fn();
const requirePosLocationMock = vi.fn();
const registerOrderPaymentMock = vi.fn();

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

/**
 * El catálogo configurado del local (`A-85`, brief §37). Es el mismo que ve el POS: «Efectivo», «Tarjeta
 * BAC» (apagada para probar el rechazo) y «Transferencia Banpro», que **pide referencia**.
 */
const configuredPaymentMethodsMock = vi.fn();

vi.mock("@/modules/pos/adapters/production-configured-payment-methods", () => ({
  createProductionConfiguredPaymentMethods: () => ({
    listPaymentMethods: () => configuredPaymentMethodsMock(),
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

/** Un body de liquidación con un medio. El `paymentMethodId` es lo que el servidor resuelve. */
function payload(payments: unknown[]) {
  return { payments, idempotencyKey: "key_route_1" };
}

function line(overrides: Record<string, unknown> = {}) {
  return { paymentMethodId: "pm_cash", method: "cash", amount: 280, currency: "NIO", ...overrides };
}

describe("POST /api/admin/orders/[id]/payment", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_cashier", role: "cashier", locationIds: ["loc_principal"] },
    });
    findOrderByIdMock.mockResolvedValue(order);
    requirePosLocationMock.mockResolvedValue("loc_principal");
    configuredPaymentMethodsMock.mockResolvedValue([
      {
        id: "pm_cash",
        name: "Efectivo",
        kind: "cash",
        entityId: null,
        currencyCodes: [],
        requiresReference: false,
        isActive: true,
        locations: [],
      },
      {
        id: "pm_banpro",
        name: "Transferencia Banpro",
        kind: "bank_transfer",
        entityId: "bank_banpro",
        currencyCodes: [],
        requiresReference: true,
        isActive: true,
        locations: [],
      },
      {
        id: "pm_apagado",
        name: "Tarjeta vieja",
        kind: "card",
        entityId: null,
        currencyCodes: [],
        requiresReference: false,
        isActive: false,
        locations: [],
      },
    ]);
    registerOrderPaymentMock.mockResolvedValue({
      data: [
        {
          id: "pay_01",
          orderId: "ord_01",
          method: "cash",
          amount: 280,
          currency: "NIO",
          reference: null,
          paymentMethodId: "pm_cash",
        },
      ],
      order,
      appliedAmount: 280,
    });
  });

  it("registra la liquidación, con el medio resuelto por el servidor", async () => {
    const { POST } = await import("./route");

    const response = await POST(post(payload([line({ currency: "nio" })])), context);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data).toMatchObject({ orderId: "ord_01", appliedAmount: 280 });
    expect(body.data.payments).toHaveLength(1);
    // El **tipo canónico** y la **entidad** los resolvió el servidor contra el catálogo, no el cliente.
    expect(registerOrderPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "ord_01",
        idempotencyKey: "key_route_1",
        payments: [
          expect.objectContaining({
            paymentMethodId: "pm_cash",
            configuredMethod: { id: "pm_cash", entityId: null, methodKind: "cash" },
          }),
        ],
      }),
      expect.anything(),
    );
    // El alcance se resuelve con el **local del pedido**: no lo elige el cliente del payload.
    expect(requirePosLocationMock).toHaveBeenCalledWith(
      expect.objectContaining({ requested: "loc_principal" }),
    );
  });

  it("ignora el `kind` que mande el cliente: sólo acepta el `paymentMethodId`", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      post(payload([line({ methodKind: "wallet", entityId: "bank_falso" })])),
      context,
    );

    expect(response.status).toBe(201);
    const calls = registerOrderPaymentMock.mock.calls[0][0] as {
      payments: Array<{ configuredMethod: { methodKind: string; entityId: string | null } }>;
    };

    // La semántica contable sale del catálogo, no del payload: `cash` y `null`, nunca `wallet`/`bank_falso`.
    expect(calls.payments[0].configuredMethod.methodKind).toBe("cash");
    expect(calls.payments[0].configuredMethod.entityId).toBeNull();
  });

  it("un medio que pide referencia sin referencia se rechaza antes de cobrar", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      post(payload([line({ paymentMethodId: "pm_banpro", method: "transfer" })])),
      context,
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.fields.reference).toContain("Banpro");
    expect(registerOrderPaymentMock).not.toHaveBeenCalled();
  });

  it("un medio apagado en Finanzas se rechaza y el mensaje dice qué arreglar", async () => {
    const { POST } = await import("./route");

    const response = await POST(post(payload([line({ paymentMethodId: "pm_apagado" })])), context);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.fields.paymentMethodId).toContain("apagado");
    expect(registerOrderPaymentMock).not.toHaveBeenCalled();
  });

  it("un `paymentMethodId` inexistente se rechaza", async () => {
    const { POST } = await import("./route");

    const response = await POST(post(payload([line({ paymentMethodId: "pm_fantasma" })])), context);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.fields.paymentMethodId).toContain("no existe");
  });

  it("cocina no cobra: 403 sin tocar el caso de uso", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_kitchen", role: "kitchen", locationIds: ["loc_principal"] },
    });

    const { POST } = await import("./route");
    const response = await POST(post(payload([line()])), context);

    expect(response.status).toBe(403);
    expect(registerOrderPaymentMock).not.toHaveBeenCalled();
  });

  it("un pedido de otra sucursal responde 403 (lo corta el guardián del POS)", async () => {
    requirePosLocationMock.mockRejectedValue(
      new AuthError(403, "FORBIDDEN", "Insufficient permissions"),
    );

    const { POST } = await import("./route");
    const response = await POST(post(payload([line()])), context);

    expect(response.status).toBe(403);
    expect(registerOrderPaymentMock).not.toHaveBeenCalled();
  });

  it("una liquidación sin medios se rechaza (422)", async () => {
    const { POST } = await import("./route");
    const response = await POST(post(payload([])), context);

    expect(response.status).toBe(422);
    expect(registerOrderPaymentMock).not.toHaveBeenCalled();
  });

  it("un monto que no es positivo se rechaza con el campo señalado (422)", async () => {
    const { POST } = await import("./route");
    const response = await POST(post(payload([line({ amount: 0 })])), context);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.fields["payments.0.amount"]).toBe("Tiene que ser mayor que cero.");
    expect(registerOrderPaymentMock).not.toHaveBeenCalled();
  });

  it("un medio histórico que no se puede elegir (o `mixed`) se rechaza", async () => {
    const { POST } = await import("./route");
    const response = await POST(post(payload([line({ method: "mixed" })])), context);

    expect(response.status).toBe(422);
  });

  it("un pedido que no existe responde 404 del caso de uso", async () => {
    findOrderByIdMock.mockResolvedValue(null);

    const { POST } = await import("./route");
    const response = await POST(post(payload([line()])), context);

    expect(response.status).toBe(404);
  });

  it("un pedido ya cobrado sale como 409 con el motivo del caso de uso", async () => {
    registerOrderPaymentMock.mockRejectedValue(
      new OrderError(409, "CONFLICT", "Ese pedido ya está cobrado.", {
        order: "Ese pedido ya está cobrado.",
      }),
    );

    const { POST } = await import("./route");
    const response = await POST(post(payload([line()])), context);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.message).toBe("Ese pedido ya está cobrado.");
  });
});
