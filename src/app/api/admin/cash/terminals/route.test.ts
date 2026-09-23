import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";
import { CashConfigError } from "@/modules/cash-config/domain/cash-config-errors";

/**
 * Fase 6 del rediseño de Caja (2026-09-23) — `GET`/`PUT /api/admin/cash/terminals`.
 *
 * Las terminales del POS se administran desde Config de Caja y son **solo del dueño**
 * (`canManageCashConfig`): con qué estaciones cuenta el local decide cómo se abre y se cierra cada caja. El
 * `PUT` firma el cambio en el log de acciones sensibles.
 */

const requireAdminSessionMock = vi.fn();
const listLocationsMock = vi.fn();
const getCashTerminalsMock = vi.fn();
const saveCashTerminalsMock = vi.fn();
const cashTerminalsUpdateAuditMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: () => requireAdminSessionMock(),
}));

vi.mock("@/modules/pos/adapters/production-pos-location", () => ({
  createProductionPosLocationDependencies: () => ({
    repository: { listLocations: () => listLocationsMock() },
  }),
}));

vi.mock("@/modules/cash-config/features/get-cash-terminals/get-cash-terminals", () => ({
  getCashTerminals: (input: unknown, deps: unknown) => getCashTerminalsMock(input, deps),
}));

vi.mock("@/modules/cash-config/features/save-cash-terminals/save-cash-terminals", () => ({
  saveCashTerminals: (input: unknown, deps: unknown) => saveCashTerminalsMock(input, deps),
}));

vi.mock("@/modules/cash-config/adapters/prisma-cash-config-repository", () => ({
  PrismaCashConfigRepository: class {},
}));

vi.mock("@/app/api/admin/audit-action-helpers", () => ({
  cashTerminalsUpdateAudit: (input: unknown) => cashTerminalsUpdateAuditMock(input),
}));

const terminals = [
  { id: "term_caja_1", locationId: "loc_principal", label: "Caja 1", isActive: true, sortOrder: 0 },
];

function put(body: unknown) {
  return new Request("http://localhost/api/admin/cash/terminals", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function get(locationId: string) {
  return new Request(
    `http://localhost/api/admin/cash/terminals?locationId=${encodeURIComponent(locationId)}`,
  );
}

describe("/api/admin/cash/terminals", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_owner", role: "owner", locationIds: [] },
    });
    listLocationsMock.mockResolvedValue([{ id: "loc_principal", name: "Camino de Oriente" }]);
    getCashTerminalsMock.mockResolvedValue({ terminals });
    saveCashTerminalsMock.mockResolvedValue({ terminals });
  });

  it("devuelve las terminales de la sucursal pedida", async () => {
    const { GET } = await import("./route");

    const response = await GET(get("loc_principal"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.terminals).toEqual(terminals);
    expect(getCashTerminalsMock).toHaveBeenCalledWith(
      { locationIds: ["loc_principal"] },
      expect.anything(),
    );
  });

  it("guarda las terminales y firma el cambio con la sucursal y cuántas quedaron activas", async () => {
    const { PUT } = await import("./route");

    const response = await PUT(
      put({
        locationId: "loc_principal",
        terminals: [{ id: "term_caja_1", label: "Caja 1", isActive: true, sortOrder: 0 }],
      }),
    );

    expect(response.status).toBe(200);
    expect(saveCashTerminalsMock).toHaveBeenCalledWith(
      {
        locationId: "loc_principal",
        terminals: [expect.objectContaining({ label: "Caja 1" })],
      },
      expect.anything(),
    );
    expect(cashTerminalsUpdateAuditMock).toHaveBeenCalledWith({
      actorUserId: "user_owner",
      locationId: "loc_principal",
      terminals: 1,
    });
  });

  it("el manager no administra las terminales: 403 sin tocar nada", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_manager", role: "manager", locationIds: ["loc_principal"] },
    });

    const { GET, PUT } = await import("./route");

    expect((await GET(get("loc_principal"))).status).toBe(403);
    expect((await PUT(put({ locationId: "loc_principal", terminals: [] }))).status).toBe(403);
    expect(saveCashTerminalsMock).not.toHaveBeenCalled();
  });

  it("una sucursal fuera del alcance responde 403, no 404 con datos de otra", async () => {
    const { GET } = await import("./route");

    expect((await GET(get("loc_ajena"))).status).toBe(403);
    expect(getCashTerminalsMock).not.toHaveBeenCalled();
  });

  it("el error de validación del dominio sale como 422 con el detalle por fila", async () => {
    saveCashTerminalsMock.mockRejectedValue(
      new CashConfigError(422, "VALIDATION_ERROR", "Revisá las terminales.", {
        "terminals.0.label": "Escribí el nombre de la terminal.",
      }),
    );

    const { PUT } = await import("./route");
    const response = await PUT(put({ locationId: "loc_principal", terminals: [] }));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.fields).toEqual({ "terminals.0.label": "Escribí el nombre de la terminal." });
  });

  it("sin sesión responde el error del guardián, no un 500", async () => {
    requireAdminSessionMock.mockRejectedValue(new AuthError(401, "UNAUTHORIZED", "Unauthorized"));

    const { GET } = await import("./route");

    expect((await GET(get("loc_principal"))).status).toBe(401);
  });
});
