import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminSessionMock = vi.fn();
const canViewOrdersMock = vi.fn();
const resolveAdminLandingMock = vi.fn();
const redirectMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canViewOrders: canViewOrdersMock,
}));

vi.mock("@/modules/auth/domain/admin-landing", () => ({
  resolveAdminLanding: resolveAdminLandingMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("./_components/order-detail-client", () => ({
  default: () => null,
}));

async function renderPage() {
  const { default: Page } = await import("./page");

  return Page({ params: Promise.resolve({ id: "ord_1" }) });
}

/**
 * `TASK-ORDERS-RUNTIME-5B` — la **puerta** del detalle de Pedidos.
 *
 * El detalle es la pantalla donde `A-60` se veía: le mostraba montos, PIN, cobros y factura a cocina. La
 * página aplica la misma capacidad que la API (`canViewOrders`) y, si el rol no entra, lo manda a **su**
 * superficie con el resolutor único de landing —no a un destino genérico—.
 *
 * El recorte de los campos financieros y el alcance por sucursal **no** se prueban acá: los aplica el
 * servidor y tienen su propio test (`api/admin/orders/[id]`).
 */
describe("/admin/orders/[id] · la puerta", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resolveAdminLandingMock.mockReturnValue("/admin/kitchen");
  });

  it("con permiso renderiza el detalle y no redirige", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "cashier", locationIds: [] },
    });
    canViewOrdersMock.mockReturnValueOnce(true);

    await renderPage();

    expect(canViewOrdersMock).toHaveBeenCalledWith("cashier");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("cocina va a su superficie, no a Pedidos", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_5", role: "kitchen", locationIds: [] },
    });
    canViewOrdersMock.mockReturnValueOnce(false);

    await renderPage();

    expect(redirectMock).toHaveBeenCalledWith("/admin/kitchen");
  });

  it("sin sesión no se proyecta nada: la excepción sale antes del render", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(new Error("sin sesión"));

    await expect(renderPage()).rejects.toThrow("sin sesión");
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
