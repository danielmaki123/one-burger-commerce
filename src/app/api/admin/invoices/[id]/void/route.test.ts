import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InvoiceRecord } from "@/modules/invoices/domain/invoice";

/**
 * Punto 2 del roadmap (2026-09-18) — `POST /api/admin/invoices/[id]/void`.
 *
 * Anular es del **dueño** y el motivo es obligatorio. La factura no se borra: se marca, y la anulación
 * deja asiento (`invoice.void`). El asiento no puede tumbar la anulación: si el log falla, la factura ya
 * está anulada.
 */

const requireAdminSessionMock = vi.fn();
const findByIdMock = vi.fn();
const voidMock = vi.fn();
const auditMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: () => requireAdminSessionMock(),
}));

vi.mock("@/modules/invoices/adapters/prisma-invoice-repository", () => ({
  PrismaInvoiceRepository: class {
    findById(id: string) {
      return findByIdMock(id);
    }
    void(id: string, input: unknown) {
      return voidMock(id, input);
    }
  },
}));

vi.mock("@/app/api/admin/audit-action-helpers", () => ({
  invoiceVoidAudit: (input: unknown) => auditMock(input),
}));

function invoice(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: "inv_01",
    number: "F-000001",
    orderId: "ord_01",
    status: "emitted",
    customerName: "Ana",
    customerLegalName: null,
    customerTaxId: null,
    businessName: "One Burger",
    businessLegalName: null,
    businessTaxId: null,
    businessAddress: null,
    businessPhone: null,
    branchName: "Camino de Oriente",
    branchAddressLine: null,
    branchCity: null,
    branchPhone: null,
    branchWhatsapp: null,
    branchMapsUrl: null,
    currencyCode: "NIO",
    subtotal: 380,
    discount: 0,
    packagingAmount: 0,
    deliveryFeeAmount: 0,
    tipAmount: 0,
    total: 380,
    issuedAt: "2026-09-18T14:00:00.000Z",
    issuedByUserId: "user_cashier",
    voidedAt: null,
    voidedByUserId: null,
    voidReason: null,
    ...overrides,
  };
}

function call(body: unknown) {
  return {
    request: new Request("http://localhost/api/admin/invoices/inv_01/void", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    context: { params: Promise.resolve({ id: "inv_01" }) },
  };
}

describe("POST /api/admin/invoices/[id]/void", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_owner", role: "owner", locationIds: [] },
    });
    findByIdMock.mockResolvedValue(invoice());
    voidMock.mockImplementation(async (id: string, input: { reason: string; actorUserId: string; voidedAt: Date }) =>
      invoice({
        id,
        status: "voided",
        voidReason: input.reason,
        voidedByUserId: input.actorUserId,
        voidedAt: input.voidedAt.toISOString(),
      }),
    );
    auditMock.mockResolvedValue({ id: "log_01" });
  });

  it("el dueño anula con un motivo de la lista y queda el asiento", async () => {
    const { POST } = await import("./route");
    const { request, context } = call({ reason: "correccion_datos" });

    const response = await POST(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("voided");
    expect(body.data.voidReason).toBe("correccion_datos");
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceId: "inv_01", reason: "correccion_datos" }),
    );
  });

  it("«Otro» viaja con su texto al asiento", async () => {
    const { POST } = await import("./route");
    const { request, context } = call({ reason: "otro", note: "Se emitió con el RUC viejo" });

    const response = await POST(request, context);

    expect(response.status).toBe(200);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "otro", note: "Se emitió con el RUC viejo" }),
    );
  });

  it("un manager no anula: es del dueño (403)", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_manager", role: "manager", locationIds: [] },
    });
    const { POST } = await import("./route");
    const { request, context } = call({ reason: "correccion_datos" });

    const response = await POST(request, context);

    expect(response.status).toBe(403);
    expect(voidMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("sin motivo no se anula nada (422)", async () => {
    const { POST } = await import("./route");
    const { request, context } = call({});

    const response = await POST(request, context);

    expect(response.status).toBe(422);
    expect(voidMock).not.toHaveBeenCalled();
  });

  it("un motivo inventado se rechaza (400)", async () => {
    const { POST } = await import("./route");
    const { request, context } = call({ reason: "porque-si" });

    const response = await POST(request, context);

    expect(response.status).toBe(400);
    expect(voidMock).not.toHaveBeenCalled();
  });

  it("«Otro» sin texto se rechaza (400)", async () => {
    const { POST } = await import("./route");
    const { request, context } = call({ reason: "otro" });

    const response = await POST(request, context);

    expect(response.status).toBe(400);
    expect(voidMock).not.toHaveBeenCalled();
  });

  it("una factura que no existe es 404", async () => {
    findByIdMock.mockResolvedValue(null);
    const { POST } = await import("./route");
    const { request, context } = call({ reason: "correccion_datos" });

    const response = await POST(request, context);

    expect(response.status).toBe(404);
  });

  it("no se anula dos veces (409)", async () => {
    findByIdMock.mockResolvedValue(invoice({ status: "voided", voidReason: "otro" }));
    const { POST } = await import("./route");
    const { request, context } = call({ reason: "correccion_datos" });

    const response = await POST(request, context);

    expect(response.status).toBe(409);
    expect(voidMock).not.toHaveBeenCalled();
  });

  it("si el log de acciones falla, la factura igual queda anulada", async () => {
    auditMock.mockRejectedValue(new Error("log caído"));
    const { POST } = await import("./route");
    const { request, context } = call({ reason: "devolucion_cliente" });

    const response = await POST(request, context);

    expect(response.status).toBe(200);
    expect(voidMock).toHaveBeenCalledTimes(1);
  });
});
