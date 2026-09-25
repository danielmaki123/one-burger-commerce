import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";
import { OrderError } from "@/modules/orders/domain/order-errors";

/**
 * TASK-AUD-059 — `POST /api/admin/payments/[id]/void`: **anular un cobro** (alcance remanente de A-15).
 *
 * La puerta es del **dueño** (`canVoidPayment`) y el motivo es obligatorio: la fila del cobro no se borra,
 * se marca con cuándo, quién y por qué, y deja de contar para el arqueo, para el saldo del pedido y para la
 * conciliación. La composición (transacción + adaptadores reales) se prueba contra PostgreSQL real en
 * `void-payment.postgres.test.ts`; acá se prueba la puerta, el payload y la respuesta.
 */

const requireAdminSessionMock = vi.fn();
const voidPaymentForRouteMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: () => requireAdminSessionMock(),
}));

vi.mock("@/app/api/admin/payments/void-payment-composition", () => ({
  voidPaymentForRoute: (input: unknown) => voidPaymentForRouteMock(input),
}));

function post(body: unknown, id = "pay_01") {
  return {
    request: new Request(`http://localhost/api/admin/payments/${id}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    context: { params: Promise.resolve({ id }) },
  };
}

const voidedPayment = {
  id: "pay_01",
  orderId: "ord_01",
  method: "cash",
  amount: 500,
  currency: "NIO",
  changeAmount: 0,
  tip: 0,
  reference: null,
  createdAt: "2026-09-25T14:00:00.000Z",
  voidedAt: "2026-09-25T15:00:00.000Z",
  voidedByUserId: "user_owner",
  voidReason: "cobro duplicado del pedido P-000123",
};

describe("POST /api/admin/payments/[id]/void", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_owner", role: "owner", locationIds: [] },
    });
    voidPaymentForRouteMock.mockResolvedValue({ data: voidedPayment });
  });

  it("el dueño anula el cobro con su motivo", async () => {
    const { POST } = await import("./route");
    const { request, context } = post({ reason: "cobro duplicado del pedido P-000123" });

    const response = await POST(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.voidedAt).toBe("2026-09-25T15:00:00.000Z");
    expect(voidPaymentForRouteMock).toHaveBeenCalledWith({
      paymentId: "pay_01",
      role: "owner",
      actorUserId: "user_owner",
      reason: "cobro duplicado del pedido P-000123",
    });
  });

  it("ni el manager, ni el cajero, ni cocina anulan un cobro (403 sin tocar el caso de uso)", async () => {
    for (const role of ["manager", "cashier", "kitchen"]) {
      requireAdminSessionMock.mockResolvedValue({
        user: { id: `user_${role}`, role, locationIds: [] },
      });

      const { POST } = await import("./route");
      const { request, context } = post({ reason: "cobro duplicado" });
      const response = await POST(request, context);

      expect(response.status).toBe(403);
    }

    expect(voidPaymentForRouteMock).not.toHaveBeenCalled();
  });

  it("sin motivo no se anula nada (422) y no se abre la transacción", async () => {
    const { POST } = await import("./route");
    const { request, context } = post({});

    const response = await POST(request, context);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.fields.reason).toBe("Escribí por qué anulás el cobro.");
    expect(voidPaymentForRouteMock).not.toHaveBeenCalled();
  });

  it("un motivo que solo tiene espacios tampoco pasa (422)", async () => {
    const { POST } = await import("./route");
    const { request, context } = post({ reason: "   " });

    const response = await POST(request, context);

    expect(response.status).toBe(422);
    expect(voidPaymentForRouteMock).not.toHaveBeenCalled();
  });

  it("un cobro que no existe sale 404 del caso de uso", async () => {
    voidPaymentForRouteMock.mockRejectedValue(
      new OrderError(404, "NOT_FOUND", "No encontramos ese cobro."),
    );

    const { POST } = await import("./route");
    const { request, context } = post({ reason: "cobro duplicado" });

    const response = await POST(request, context);

    expect(response.status).toBe(404);
  });

  it("un cobro ya anulado (o con una devolución viva) sale 409 con el motivo del caso de uso", async () => {
    voidPaymentForRouteMock.mockRejectedValue(
      new OrderError(409, "CONFLICT", "Ese cobro ya está anulado.", {
        payment: "Ese cobro ya está anulado.",
      }),
    );

    const { POST } = await import("./route");
    const { request, context } = post({ reason: "cobro duplicado" });

    const response = await POST(request, context);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.message).toBe("Ese cobro ya está anulado.");
  });

  it("sin sesión no se anula nada: el error de la puerta viaja como está", async () => {
    requireAdminSessionMock.mockRejectedValue(
      new AuthError(401, "UNAUTHORIZED", "No hay sesión."),
    );

    const { POST } = await import("./route");
    const { request, context } = post({ reason: "cobro duplicado" });

    const response = await POST(request, context);

    expect(response.status).toBe(401);
    expect(voidPaymentForRouteMock).not.toHaveBeenCalled();
  });
});
