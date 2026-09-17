import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Bloque 3.6 del roadmap del POS (Fase 2) + tarea 9 del brief (2026-09-17) — la cola de aprobaciones.
 *
 * Ver la cola es parte de **firmar**: desde la tarea 9 solo el dueño resuelve devoluciones, así que la
 * cola la ve él (y el manager, que puede pedirlas pero no firmarlas, recibe 403).
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
      user: { id: "user_owner", role: "owner", locationIds: [] },
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

  it.each(["cashier", "manager"] as const)("%s no ve la cola: 403", async (role) => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_x", role, locationIds: [] },
    });

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(403);
    expect(listPendingMock).not.toHaveBeenCalled();
  });
});
