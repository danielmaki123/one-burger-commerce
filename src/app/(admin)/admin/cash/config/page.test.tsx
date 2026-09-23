// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  redirectMock,
  requireAdminSessionMock,
  listLocationsMock,
  getCashConfigMock,
  getBankCatalogMock,
  getCashTerminalsMock,
} = vi.hoisted(() => ({
  // Igual que Next de verdad: `redirect()` corta la ejecución de la página.
  redirectMock: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  requireAdminSessionMock: vi.fn(),
  listLocationsMock: vi.fn(),
  getCashConfigMock: vi.fn(),
  getBankCatalogMock: vi.fn(),
  getCashTerminalsMock: vi.fn(),
}));

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

// Fase 3 del rediseño de Caja: la sección Bancos baja con la config.
vi.mock("@/modules/banks/features/get-bank-catalog/get-bank-catalog", () => ({
  getBankCatalog: (input: unknown, deps: unknown) => getBankCatalogMock(input, deps),
}));

// Fase 6 del rediseño de Caja: la sección Terminales baja con la config.
vi.mock("@/modules/cash-config/features/get-cash-terminals/get-cash-terminals", () => ({
  getCashTerminals: (input: unknown, deps: unknown) => getCashTerminalsMock(input, deps),
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
    getBankCatalogMock.mockResolvedValue({
      banks: [
        {
          id: "bank_bac",
          name: "BAC Credomatic",
          code: "BAC",
          isActive: true,
          sortOrder: 0,
          locationIds: ["loc_principal"],
        },
      ],
    });
    getCashTerminalsMock.mockResolvedValue({
      terminals: [
        {
          id: "term_caja_1",
          locationId: "loc_principal",
          label: "Caja 1",
          isActive: true,
          sortOrder: 0,
        },
      ],
    });

    render(await AdminCashConfigPage());

    expect(screen.getByRole("heading", { name: "Config de Caja" })).toBeTruthy();
    expect(screen.getByLabelText("Esta sucursal cuenta dólares")).toBeTruthy();
    expect(screen.getByLabelText(/Arqueo ciego/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Guardar configuración" })).toBeTruthy();
    // Fase 3 del rediseño de Caja: los bancos del cuadre bajan con la config y se editan acá.
    expect(screen.getByRole("region", { name: "Bancos" })).toBeTruthy();
    expect(screen.getByDisplayValue("BAC Credomatic")).toBeTruthy();
    // Fase 6: las terminales del POS también bajan con la config (es donde se administran).
    expect(screen.getByRole("region", { name: "Terminales" })).toBeTruthy();
    expect(screen.getByDisplayValue("Caja 1")).toBeTruthy();
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
