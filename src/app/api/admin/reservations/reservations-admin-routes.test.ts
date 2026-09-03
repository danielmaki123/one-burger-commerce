import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const listAdminReservationsMock = vi.fn();
const getAdminReservationMock = vi.fn();
const updateReservationStatusMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/reservations/adapters/prisma-reservation-repository", () => ({
  PrismaReservationRepository: class PrismaReservationRepository {},
}));

vi.mock("@/modules/reservations/features/list-admin-reservations/list-admin-reservations", () => ({
  listAdminReservations: listAdminReservationsMock,
}));

vi.mock("@/modules/reservations/features/get-admin-reservation/get-admin-reservation", () => ({
  getAdminReservation: getAdminReservationMock,
}));

vi.mock("@/modules/reservations/features/update-reservation-status/update-reservation-status", () => ({
  updateReservationStatus: updateReservationStatusMock,
}));

describe("admin reservations routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "admin_01", role: "owner" },
    });
  });

  it("returns 401 for admin list when session is invalid", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Invalid admin session"),
    );
    const { GET } = await import("@/app/api/admin/reservations/route");

    const response = await GET(
      new Request("http://localhost/api/admin/reservations"),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns admin list payload when authenticated", async () => {
    listAdminReservationsMock.mockResolvedValueOnce({
      data: [{ id: "res_01" }],
      meta: { count: 1 },
    });
    const { GET } = await import("@/app/api/admin/reservations/route");

    const response = await GET(
      new Request("http://localhost/api/admin/reservations?status=requested"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta.count).toBe(1);
  });

  it("returns 401 for admin detail when session is invalid", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Invalid admin session"),
    );
    const { GET } = await import("@/app/api/admin/reservations/[id]/route");

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "res_01" }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns admin reservation detail when authenticated", async () => {
    getAdminReservationMock.mockResolvedValueOnce({
      data: { id: "res_01", status: "requested" },
    });
    const { GET } = await import("@/app/api/admin/reservations/[id]/route");

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "res_01" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.id).toBe("res_01");
  });

  it("returns BAD_REQUEST when PATCH status is outside enum", async () => {
    const { PATCH } = await import("@/app/api/admin/reservations/[id]/status/route");

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ status: "invalid_status" }),
      }),
      { params: Promise.resolve({ id: "res_01" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(updateReservationStatusMock).not.toHaveBeenCalled();
  });
});
