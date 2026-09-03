import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const cookiesMock = vi.fn();
const getAdminSessionMock = vi.fn();
const repositoryCtorMock = vi.fn(function RepositoryMock() {
  return {};
});

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/modules/auth/adapters/prisma-admin-auth-repository", () => ({
  PrismaAdminAuthRepository: repositoryCtorMock,
}));

vi.mock("@/modules/auth/features/get-admin-session/get-admin-session", () => ({
  getAdminSession: getAdminSessionMock,
}));

describe("GET /api/auth/admin/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when only customer cookie exists", async () => {
    cookiesMock.mockResolvedValueOnce({
      get: (name: string) =>
        name === "ca_customer_session" ? { value: "customer_token" } : undefined,
    });
    getAdminSessionMock.mockImplementationOnce(() => {
      throw new AuthError(401, "UNAUTHORIZED", "Admin session expired");
    });

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(401);
    expect(getAdminSessionMock).toHaveBeenCalledWith(undefined, expect.any(Object));
  });
});
