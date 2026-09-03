import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const findManyMock = vi.fn();
const createMock = vi.fn();
const canManageCriticalConfigMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canManageCriticalConfig: canManageCriticalConfigMock,
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  getPrismaClient: () => ({
    table: {
      findMany: findManyMock,
      create: createMock,
    },
  }),
}));

describe("GET /api/admin/tables", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(401);
  }, 10000);

  it("returns 200 with tables when session exists", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "owner" },
    });
    findManyMock.mockResolvedValueOnce([
      {
        id: "table_10",
        label: "Mesa 10",
        isActive: true,
        capacity: 4,
        locationId: "Terraza",
        qrToken: "qr_10",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "table_1",
        label: "Mesa 1",
        isActive: true,
        capacity: 4,
        locationId: "main",
        qrToken: "qr_1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.data.map((table: { label: string }) => table.label)).toEqual([
      "Mesa 1",
      "Mesa 10",
    ]);
  });

  it("POST returns 401 when session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/tables", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: "Mesa Nueva", capacity: 4 }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("POST returns 403 when role has no permission", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "manager" },
    });
    canManageCriticalConfigMock.mockReturnValueOnce(false);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/tables", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: "Mesa Nueva", capacity: 4 }),
      }),
    );

    expect(response.status).toBe(403);
  });

  it("POST returns 400 for empty label", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "owner" },
    });
    canManageCriticalConfigMock.mockReturnValueOnce(true);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/tables", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: "   ", capacity: 4 }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("POST returns 400 for invalid capacity", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "owner" },
    });
    canManageCriticalConfigMock.mockReturnValueOnce(true);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/tables", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: "Mesa Nueva", capacity: 0 }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("POST returns 201 for valid payload", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "owner" },
    });
    canManageCriticalConfigMock.mockReturnValueOnce(true);
    createMock.mockResolvedValueOnce({
      id: "table_2",
      label: "Mesa Nueva",
      isActive: true,
      capacity: 4,
      locationId: "main",
      qrToken: "mesa-nueva-ab12cd",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/tables", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: "Mesa Nueva", capacity: 4 }),
      }),
    );

    expect(response.status).toBe(201);
  });
});

