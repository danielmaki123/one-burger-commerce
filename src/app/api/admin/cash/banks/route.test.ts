import { beforeEach, describe, expect, it, vi } from "vitest";

import { BankError } from "@/modules/banks/domain/bank-errors";
import { AuthError } from "@/modules/auth/domain/auth-errors";

/**
 * Fase 3 del rediseño de Caja (2026-09-23) — `GET`/`PUT /api/admin/cash/banks`.
 *
 * El catálogo de bancos se edita **entero** desde Config de Caja y es **solo del dueño**
 * (`canManageCashConfig`): con qué bancos liquida el local decide contra qué se cuadra el lote de la
 * terminal, así que no es operar la caja. El `PUT` firma el cambio en el log de acciones sensibles.
 */

const requireAdminSessionMock = vi.fn();
const listLocationsMock = vi.fn();
const getBankCatalogMock = vi.fn();
const saveBankCatalogMock = vi.fn();
const cashBanksUpdateAuditMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: () => requireAdminSessionMock(),
}));

vi.mock("@/modules/pos/adapters/production-pos-location", () => ({
  createProductionPosLocationDependencies: () => ({
    repository: { listLocations: () => listLocationsMock() },
  }),
}));

vi.mock("@/modules/banks/features/get-bank-catalog/get-bank-catalog", () => ({
  getBankCatalog: (input: unknown, deps: unknown) => getBankCatalogMock(input, deps),
}));

vi.mock("@/modules/banks/features/save-bank-catalog/save-bank-catalog", () => ({
  saveBankCatalog: (input: unknown, deps: unknown) => saveBankCatalogMock(input, deps),
}));

vi.mock("@/modules/banks/adapters/prisma-bank-repository", () => ({
  PrismaBankRepository: class {},
}));

vi.mock("@/app/api/admin/audit-action-helpers", () => ({
  cashBanksUpdateAudit: (input: unknown) => cashBanksUpdateAuditMock(input),
}));

const catalog = [
  {
    id: "bank_bac",
    name: "BAC Credomatic",
    code: "BAC",
    isActive: true,
    sortOrder: 0,
    locationIds: ["loc_principal"],
  },
];

function put(body: unknown) {
  return new Request("http://localhost/api/admin/cash/banks", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/admin/cash/banks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_owner", role: "owner", locationIds: [] },
    });
    listLocationsMock.mockResolvedValue([
      { id: "loc_principal", name: "Camino de Oriente" },
      { id: "loc_masaya", name: "Carretera Masaya" },
    ]);
    getBankCatalogMock.mockResolvedValue({ banks: catalog });
    saveBankCatalogMock.mockResolvedValue({ banks: catalog });
  });

  it("devuelve el catálogo con sus sucursales", async () => {
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.banks).toEqual(catalog);
  });

  it("guarda el catálogo y firma el cambio", async () => {
    const { PUT } = await import("./route");

    const response = await PUT(
      put({ banks: [{ id: "", name: "BAC", code: "BAC", isActive: true, sortOrder: 0, locationIds: ["loc_principal"] }] }),
    );

    expect(response.status).toBe(200);
    expect(saveBankCatalogMock).toHaveBeenCalledWith(
      { banks: [expect.objectContaining({ name: "BAC" })] },
      expect.anything(),
    );
    // Cambiar los bancos cambia contra qué se cuadra el arqueo: se firma quién lo hizo y cuántos quedaron.
    expect(cashBanksUpdateAuditMock).toHaveBeenCalledWith({
      actorUserId: "user_owner",
      banks: 1,
      locations: 1,
    });
  });

  it("el manager no administra el catálogo: 403 sin tocar nada", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_manager", role: "manager", locationIds: ["loc_principal"] },
    });

    const { PUT, GET } = await import("./route");

    expect((await GET()).status).toBe(403);
    expect((await PUT(put({ banks: [] }))).status).toBe(403);
    expect(saveBankCatalogMock).not.toHaveBeenCalled();
  });

  it("rechaza una sucursal que no está en el panel, aunque venga en el payload", async () => {
    const { PUT } = await import("./route");

    const response = await PUT(
      put({
        banks: [
          {
            id: "",
            name: "BAC",
            code: null,
            isActive: true,
            sortOrder: 0,
            locationIds: ["loc_ajena"],
          },
        ],
      }),
    );

    expect(response.status).toBe(403);
    expect(saveBankCatalogMock).not.toHaveBeenCalled();
  });

  it("el error de validación del dominio sale como 422 con el detalle por fila", async () => {
    saveBankCatalogMock.mockRejectedValue(
      new BankError(422, "VALIDATION_ERROR", "Revisá el catálogo de bancos.", {
        "banks.0.name": "Escribí el nombre del banco.",
      }),
    );

    const { PUT } = await import("./route");
    const response = await PUT(put({ banks: [] }));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.fields).toEqual({ "banks.0.name": "Escribí el nombre del banco." });
  });

  it("sin sesión responde el error del guardián, no un 500", async () => {
    requireAdminSessionMock.mockRejectedValue(new AuthError(401, "UNAUTHORIZED", "Unauthorized"));

    const { GET } = await import("./route");

    expect((await GET()).status).toBe(401);
  });
});
