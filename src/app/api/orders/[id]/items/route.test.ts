import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const addTableOrderItemsMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/orders/adapters/prisma-order-repository", () => ({
  PrismaOrderRepository: class {},
}));

vi.mock("@/modules/orders/features/add-table-order-items/add-table-order-items", () => ({
  addTableOrderItems: addTableOrderItemsMock,
}));

const validPayload = JSON.stringify({
  items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
});

function buildRequest() {
  return new Request("http://localhost/api/orders/order_01/items", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: validPayload,
  });
}

describe("POST /api/orders/[id]/items", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 for anonymous callers so orders cannot be mutated publicly", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );

    const { POST } = await import("./route");
    const response = await POST(buildRequest(), {
      params: Promise.resolve({ id: "order_01" }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(addTableOrderItemsMock).not.toHaveBeenCalled();
  });

  it("allows staff with order permissions to add items", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_kitchen", role: "kitchen" },
    });
    addTableOrderItemsMock.mockResolvedValueOnce({
      data: { id: "order_01", total: 100 },
    });

    const { POST } = await import("./route");
    const response = await POST(buildRequest(), {
      params: Promise.resolve({ id: "order_01" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.id).toBe("order_01");
    expect(addTableOrderItemsMock).toHaveBeenCalledWith(
      "order_01",
      {
        items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
      },
      expect.objectContaining({ repository: expect.anything() }),
    );
  });

  it("returns 400 for invalid payload before touching the order", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_owner", role: "owner" },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/orders/order_01/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: [] }),
      }),
      { params: Promise.resolve({ id: "order_01" }) },
    );

    expect(response.status).toBe(400);
    expect(addTableOrderItemsMock).not.toHaveBeenCalled();
  });
});
