// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { redirectMock, requireAdminSessionMock, listLocationsMock, getCashConfigMock } = vi.hoisted(
  () => ({
    // Igual que Next de verdad: `redirect()` corta la ejecución de la página.
    redirectMock: vi.fn(() => {
      throw new Error("NEXT_REDIRECT");
    }),
    requireAdminSessionMock: vi.fn(),
    listLocationsMock: vi.fn(),
    getCashConfigMock: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: () => requireAdminSessionMock(),
}));

vi.mock("@/modules/pos/adapters/production-pos-location", () => ({
  createProductionPosLocationDependencies: () => ({
    repository: { listLocations: () => listLocationsMock() },
  }),
}));

vi.mock("@/modules/cash-config/features/get-cash-config/get-cash-config", () => ({
  getCashConfig: (input: unknown, deps: unknown) => getCashConfigMock(input, deps),
}));

import AdminCashConfigPage from "./page";

/**
 * Fase 2 del rediseño de Caja (2026-09-22) — **Config de Caja**, la pantalla real (reemplaza el placeholder).
 *
 * Lo que fija este test es la puerta y lo que baja como dato: la configuración de la caja es del **dueño**
 * (`canManageCashConfig`) porque cambia las reglas con las que se firma un arqueo; el manager y el cajero
 * van a Órdenes. Y la pantalla recibe la config de la primera sucursal del alcance.
 */

const LOCATIONS = [
  { id: "loc_principal", name: "Principal", isActive: true, sortOrder: 0, posEnabled: true },
];

const CONFIG = {
  locationId: "loc_principal",
  usdEnabled: false,
  blindCount: true,
  updatedAt: null,
  updatedByUserId: null,
  denominations: [
    { currency: "NIO", value: 1000, isActive: true, sortOrder: 0 },
    { currency: "USD", value: 20, isActive: true, sortOrder: 0 },
  ],
};

function sessionFor(role: "owner" | "manager" | "cashier" | "kitchen") {
  return { isAuthenticated: true as const, user: { role, name: "Quien sea", id: "user_1" } };
}

describe("AdminCashConfigPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("el dueño ve la config y sus controles", async () => {
    requireAdminSessionMock.mockResolvedValue(sessionFor("owner"));
    listLocationsMock.mockResolvedValue(LOCATIONS);
    getCashConfigMock.mockResolvedValue(CONFIG);

    render(await AdminCashConfigPage());

    expect(screen.getByRole("heading", { name: "Config de Caja" })).toBeTruthy();
    expect(screen.getByLabelText("Esta sucursal cuenta dólares")).toBeTruthy();
    expect(screen.getByLabelText(/Arqueo ciego/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Guardar configuración" })).toBeTruthy();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it.each(["manager", "cashier", "kitchen"] as const)(
    "%s no entra: la configuración de la caja es del dueño",
    async (role) => {
      requireAdminSessionMock.mockResolvedValue(sessionFor(role));

      await expect(AdminCashConfigPage()).rejects.toThrow("NEXT_REDIRECT");

      expect(redirectMock).toHaveBeenCalledWith("/admin/orders");
    },
  );
});
