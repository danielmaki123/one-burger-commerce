// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { redirectMock, requireAdminSessionMock } = vi.hoisted(() => ({
  // Igual que Next de verdad: `redirect()` corta la ejecución de la página.
  redirectMock: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  requireAdminSessionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: () => requireAdminSessionMock(),
}));

import AdminCashConfigPage from "./page";

/**
 * Fase 1a del rediseño de Caja (2026-09-19) — **Config de Caja** entra al sidebar desde la Fase 1a, con la
 * pantalla mínima, para no tocar la navegación dos veces (decisión del owner).
 *
 * Lo que fija este test es la puerta: la configuración de la caja es del **dueño** (`canManageCashConfig`),
 * porque cambia las reglas con las que se firma un arqueo. La pantalla real llega en la Fase 2; mientras
 * tanto dice qué va a vivir acá y no ofrece ningún control decorativo.
 */

function sessionFor(role: "owner" | "manager" | "cashier" | "kitchen") {
  return { isAuthenticated: true as const, user: { role, name: "Quien sea", id: "user_1" } };
}

describe("AdminCashConfigPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("el dueño ve la pantalla y qué se va a configurar", async () => {
    requireAdminSessionMock.mockResolvedValue(sessionFor("owner"));

    render(await AdminCashConfigPage());

    expect(screen.getByRole("heading", { name: "Config de Caja" })).toBeTruthy();
    expect(screen.getByText(/En construcción/)).toBeTruthy();
    expect(screen.getByText(/[Dd]enominaciones/)).toBeTruthy();
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
