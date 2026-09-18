import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InvoiceRecord } from "@/modules/invoices/domain/invoice";

/**
 * Punto 2 del roadmap (2026-09-18) — `GET /api/admin/invoices`.
 *
 * Lo que se prueba es la orquestación real: el permiso de la sección (`canViewHistory`), el alcance por
 * sucursal —una sucursal pedida fuera del alcance **se ignora**— y que los filtros basura no lleguen a
 * la consulta. El doble es de la dependencia de Prisma, no del helper.
 */

const requireAdminSessionMock = vi.fn();
const listMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: () => requireAdminSessionMock(),
}));

vi.mock("@/modules/invoices/adapters/prisma-invoice-repository", () => ({
  PrismaInvoiceRepository: class {
    list(filters: unknown) {
      return listMock(filters);
    }
  },
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

function request(query: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/admin/invoices");
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

  return new Request(url);
}

describe("GET /api/admin/invoices", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_owner", role: "owner", locationIds: [] },
    });
    listMock.mockResolvedValue([invoice()]);
  });

  it("devuelve las facturas con su total y sin filtro de sucursal para el dueño", async () => {
    const { GET } = await import("./route");

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].number).toBe("F-000001");
    expect(body.meta).toEqual({ total: 1, locationIds: null });
    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ locationIds: null }));
  });

  it("un manager consulta solo sus sucursales", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_manager", role: "manager", locationIds: ["loc_norte"] },
    });
    const { GET } = await import("./route");

    await GET(request());

    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ locationIds: ["loc_norte"] }));
  });

  it("una sucursal pedida fuera del alcance se ignora, no se filtra por ella", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_manager", role: "manager", locationIds: ["loc_norte"] },
    });
    const { GET } = await import("./route");

    const response = await GET(request({ locationId: "loc_sur" }));
    const body = await response.json();

    expect(body.meta.locationIds).toEqual(["loc_norte"]);
  });

  it("el cajero no entra al Historial (403)", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_cashier", role: "cashier", locationIds: [] },
    });
    const { GET } = await import("./route");

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("cocina tampoco: no maneja plata (403)", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_kitchen", role: "kitchen", locationIds: [] },
    });
    const { GET } = await import("./route");

    const response = await GET(request());

    expect(response.status).toBe(403);
  });

  it("un estado que no existe no se manda a la consulta", async () => {
    const { GET } = await import("./route");

    await GET(request({ status: "no-existe", search: "  F-000001  " }));

    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: null, search: "F-000001" }),
    );
  });

  it("respuesta sin caché: el Historial no puede quedar pegado", async () => {
    const { GET } = await import("./route");

    const response = await GET(request());

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
