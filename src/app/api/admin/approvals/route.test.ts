import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Bloque 3.6 del roadmap del POS (Fase 2) — la cola de aprobaciones.
 *
 * Ver la cola es parte del control: el cajero que pide una devolución no la ve listada para
 * resolverse solo (y la ruta le responde 403).
 */

const requireAdminSessionMock = vi.fn();
const listPendingMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: () => requireAdminSessionMock(),
}));

vi.mock("@/modules/orders/adapters/prisma-refund-repository", () => ({
  PrismaRefundRepository: class {
    listPending() {
      return listPendingMock();
    }
  },
}));

describe("GET /api/admin/approvals", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_manager", role: "manager", locationIds: [] },
    });
    listPendingMock.mockResolvedValue([
      {
        id: "ref_01",
        amount: 200,
        currency: "NIO",
        reason: "Faltaba una bebida",
        status: "pending",
      },
    ]);
  });

  it("devuelve la cola de devoluciones pendientes", async () => {
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].status).toBe("pending");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("el cajero no ve la cola: 403", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_cashier", role: "cashier", locationIds: [] },
    });

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(403);
    expect(listPendingMock).not.toHaveBeenCalled();
  });
});
