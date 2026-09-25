import { describe, expect, it, vi } from "vitest";

import { InvoiceError } from "../../domain/invoice-errors";
import type { InvoiceRecord } from "../../domain/invoice";
import type { CreateInvoiceInput, InvoiceRepository } from "../../ports/invoice-repository";
import { voidInvoice } from "./void-invoice";

/**
 * Punto 2 del roadmap (2026-09-18) — **anular una factura**.
 *
 * Reglas que fija: solo el dueño, motivo obligatorio de la lista cerrada («Otro» con su texto), la
 * factura **no se borra** (queda marcada) y la anulación deja asiento en el log de acciones sensibles.
 */

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

/** El doble implementa el puerto completo: lo que no se usa, se declara. */
function repository(record: InvoiceRecord | null): InvoiceRepository & {
  voidMock: ReturnType<typeof vi.fn>;
} {
  const voidMock = vi.fn(async (id: string, input: { reason: string; actorUserId: string; voidedAt: Date }) =>
    invoice({
      id,
      status: "voided",
      voidReason: input.reason,
      voidedByUserId: input.actorUserId,
      voidedAt: input.voidedAt.toISOString(),
    }),
  );

  return {
    voidMock,
    findByOrderId: vi.fn(async () => record),
    findLatestNumber: vi.fn(async () => record?.number ?? null),
    // TASK-AUD-006: el puerto asigna el correlativo y crea en una sola operación; anular no emite.
    createNextForOrder: vi.fn(async () => {
      throw new Error("anular no emite");
    }),
    create: vi.fn(async (input: CreateInvoiceInput) => invoice({ ...input, orderId: input.orderId })),
    findById: vi.fn(async () => record),
    list: vi.fn(async () => (record ? [record] : [])),
    void: voidMock,
  };
}

function deps(record: InvoiceRecord | null) {
  const invoiceRepository = repository(record);
  const recordVoidAudit = vi.fn(async () => ({ id: "log_01" }));

  return { invoiceRepository, recordVoidAudit };
}

const OWNER = { actorRole: "owner" as const, actorUserId: "user_owner" };

describe("voidInvoice", () => {
  it("marca la factura como anulada con quién, cuándo y por qué (no la borra)", async () => {
    const { invoiceRepository, recordVoidAudit } = deps(invoice());

    const result = await voidInvoice(
      { invoiceId: "inv_01", ...OWNER, reason: "correccion_datos" },
      { invoiceRepository, recordVoidAudit, now: () => new Date("2026-09-18T15:30:00.000Z") },
    );

    expect(result.status).toBe("voided");
    expect(result.voidReason).toBe("correccion_datos");
    expect(result.voidedByUserId).toBe("user_owner");
    expect(result.voidedAt).toBe("2026-09-18T15:30:00.000Z");
    expect(invoiceRepository.voidMock).toHaveBeenCalledTimes(1);
  });

  it("deja el asiento de la anulación con su motivo", async () => {
    const { invoiceRepository, recordVoidAudit } = deps(invoice());

    await voidInvoice(
      { invoiceId: "inv_01", ...OWNER, reason: "otro", note: "Se emitió con el RUC viejo" },
      { invoiceRepository, recordVoidAudit },
    );

    expect(recordVoidAudit).toHaveBeenCalledWith({
      invoiceId: "inv_01",
      reason: "otro",
      note: "Se emitió con el RUC viejo",
      actorUserId: "user_owner",
    });
  });

  it("con un motivo de la lista, la nota no se guarda ni viaja al asiento", async () => {
    const { invoiceRepository, recordVoidAudit } = deps(invoice());

    await voidInvoice(
      { invoiceId: "inv_01", ...OWNER, reason: "devolucion_cliente", note: "texto suelto" },
      { invoiceRepository, recordVoidAudit },
    );

    expect(recordVoidAudit).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "devolucion_cliente", note: null }),
    );
  });

  it("solo el dueño anula: un manager no puede, y no se toca nada", async () => {
    const { invoiceRepository, recordVoidAudit } = deps(invoice());

    await expect(
      voidInvoice(
        { invoiceId: "inv_01", actorRole: "manager", actorUserId: "user_manager", reason: "otro", note: "x" },
        { invoiceRepository, recordVoidAudit },
      ),
    ).rejects.toMatchObject({ status: 403 });

    expect(invoiceRepository.voidMock).not.toHaveBeenCalled();
    expect(recordVoidAudit).not.toHaveBeenCalled();
  });

  it("exige un motivo de la lista", async () => {
    const { invoiceRepository, recordVoidAudit } = deps(invoice());

    await expect(
      voidInvoice({ invoiceId: "inv_01", ...OWNER, reason: "porque-si" }, { invoiceRepository, recordVoidAudit }),
    ).rejects.toMatchObject({ status: 400 });

    expect(invoiceRepository.voidMock).not.toHaveBeenCalled();
  });

  it("«Otro» sin texto no anula nada", async () => {
    const { invoiceRepository, recordVoidAudit } = deps(invoice());

    await expect(
      voidInvoice({ invoiceId: "inv_01", ...OWNER, reason: "otro" }, { invoiceRepository, recordVoidAudit }),
    ).rejects.toMatchObject({ status: 400 });

    expect(invoiceRepository.voidMock).not.toHaveBeenCalled();
  });

  it("una factura que no existe es un 404, no un 500", async () => {
    const { invoiceRepository, recordVoidAudit } = deps(null);

    await expect(
      voidInvoice(
        { invoiceId: "inv_99", ...OWNER, reason: "correccion_datos" },
        { invoiceRepository, recordVoidAudit },
      ),
    ).rejects.toBeInstanceOf(InvoiceError);
  });

  it("no se anula dos veces la misma factura", async () => {
    const { invoiceRepository, recordVoidAudit } = deps(
      invoice({ status: "voided", voidReason: "otro", voidedAt: "2026-09-18T15:00:00.000Z" }),
    );

    await expect(
      voidInvoice(
        { invoiceId: "inv_01", ...OWNER, reason: "correccion_datos" },
        { invoiceRepository, recordVoidAudit },
      ),
    ).rejects.toMatchObject({ status: 409 });

    expect(invoiceRepository.voidMock).not.toHaveBeenCalled();
  });
});
