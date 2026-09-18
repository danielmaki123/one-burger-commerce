import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";
import type { InvoiceRecord } from "@/modules/invoices/domain/invoice";
import type { CreateInvoiceInput, InvoiceRepository } from "@/modules/invoices/ports/invoice-repository";

/**
 * Factura simple (2026-09-18) — la ruta del documento.
 *
 * Lo que se prueba es la composición: la sesión, el permiso (entrega el documento quien cobra), el payload
 * y los dos caminos del caso de uso (emitir y volver a pedir la misma). El caso de uso corre de verdad, con
 * el repositorio simulado: lo que se prueba es la ruta.
 */

const requireAdminSessionMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

let invoices: InvoiceRecord[] = [];
let payments = 1;
let orderStatus = "picked_up";
let orderExists = true;

const inMemoryRepository: InvoiceRepository = {
  findByOrderId: async (orderId) => invoices.find((invoice) => invoice.orderId === orderId) ?? null,
  findLatestNumber: async () =>
    invoices.length === 0 ? null : [...invoices].sort((a, b) => (a.number < b.number ? 1 : -1))[0].number,
  create: async (input: CreateInvoiceInput) => {
    const invoice: InvoiceRecord = {
      id: `inv_${invoices.length + 1}`,
      status: "emitted",
      issuedAt: "2026-09-18T15:00:00.000Z",
      ...input,
    };
    invoices.push(invoice);

    return invoice;
  },
};

vi.mock("@/modules/invoices/adapters/production-invoice", () => ({
  createProductionInvoiceDependencies: async () => ({
    invoiceRepository: inMemoryRepository,
    findOrder: async (orderId: string) =>
      orderExists
        ? {
            id: orderId,
            status: orderStatus,
            customerName: "Ana",
            subtotal: 100,
            discount: 0,
            packagingAmount: 10,
            deliveryFeeAmount: 0,
            tipAmount: 0,
            total: 110,
          }
        : null,
    countPayments: async () => payments,
    business: {
      name: "One Burger",
      legalName: null,
      taxId: null,
      addressLine: "Camino de Oriente",
      city: "Managua",
      phone: "+50588887777",
      currencyCode: "NIO",
    },
  }),
}));

const params = Promise.resolve({ id: "ord_01" });

async function callGet() {
  const { GET } = await import("./route");

  return GET(new Request("http://localhost/api/admin/orders/ord_01/invoice"), { params });
}

async function callPost(body: unknown = {}) {
  const { POST } = await import("./route");

  return POST(
    new Request("http://localhost/api/admin/orders/ord_01/invoice", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params },
  );
}

describe("admin order invoice route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invoices = [];
    payments = 1;
    orderStatus = "picked_up";
    orderExists = true;
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "admin_1", role: "cashier", locationIds: [] },
    });
  });

  it("sin sesión responde 401", async () => {
    requireAdminSessionMock.mockRejectedValue(new AuthError(401, "UNAUTHORIZED", "No session"));

    expect((await callGet()).status).toBe(401);
    expect((await callPost()).status).toBe(401);
  });

  it("GET dice que todavía no hay factura y que el cajero puede emitirla", async () => {
    const response = await callGet();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ invoice: null, canEmit: true });
  });

  it("GET no ofrece emitir a cocina (no cobra, no entrega documentos)", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "admin_2", role: "kitchen", locationIds: [] },
    });

    const body = await (await callGet()).json();

    expect(body.data.canEmit).toBe(false);
  });

  it("POST emite la factura con los datos fiscales del cliente y devuelve 201", async () => {
    const response = await callPost({ legalName: "Ana S.A.", taxId: "J0310000001" });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.reused).toBe(false);
    expect(body.data.invoice).toMatchObject({
      number: "F-000001",
      customerName: "Ana",
      customerLegalName: "Ana S.A.",
      customerTaxId: "J0310000001",
    });
  });

  it("volver a pedir la factura devuelve la misma con 200 (no emite otra)", async () => {
    await callPost();
    const response = await callPost();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.reused).toBe(true);
    expect(invoices).toHaveLength(1);
  });

  it("cocina no emite: 403, sin tocar nada", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "admin_2", role: "kitchen", locationIds: [] },
    });

    const response = await callPost();

    expect(response.status).toBe(403);
    expect(invoices).toHaveLength(0);
  });

  it("un pedido sin cobros no se factura: 409 con el motivo", async () => {
    payments = 0;

    const response = await callPost();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.message).toContain("cobro");
    expect(invoices).toHaveLength(0);
  });

  it("un pedido que no existe responde 404", async () => {
    orderExists = false;

    expect((await callGet()).status).toBe(404);
    expect((await callPost()).status).toBe(404);
  });
});
