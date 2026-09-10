import { beforeEach, describe, expect, it, vi } from "vitest";

import { CustomerAuthError } from "@/modules/customers/domain/customer-auth-errors";

const cookiesMock = vi.fn();
const getCustomerSessionMock = vi.fn();
const repositoryCtorMock = vi.fn(function RepositoryMock() {
  return {};
});

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock(
  "@/modules/customers/adapters/prisma-customer-auth-repository",
  () => ({
    PrismaCustomerAuthRepository: repositoryCtorMock,
  }),
);

vi.mock(
  "@/modules/customers/features/get-customer-session/get-customer-session",
  () => ({
    getCustomerSession: getCustomerSessionMock,
  }),
);

describe("GET /api/customer/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when customer cookie is missing", async () => {
    cookiesMock.mockResolvedValueOnce({
      get: () => undefined,
    });
    getCustomerSessionMock.mockImplementationOnce(() => {
      throw new CustomerAuthError(401, "UNAUTHORIZED", "Customer session expired");
    });

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(401);
    expect(getCustomerSessionMock).toHaveBeenCalledWith(undefined, expect.any(Object));
  });

  it("returns 200 when customer cookie is valid", async () => {
    cookiesMock.mockResolvedValueOnce({
      get: (name: string) =>
        name === "ca_customer_session" ? { value: "customer_token" } : undefined,
    });
    getCustomerSessionMock.mockResolvedValueOnce({
      isAuthenticated: true,
      customer: {
        id: "cus_1",
        fullName: null,
        whatsappNormalized: "+50586791327",
      },
    });

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.customer.id).toBe("cus_1");
  });

  it("does not authenticate customer session from admin cookie", async () => {
    cookiesMock.mockResolvedValueOnce({
      get: (name: string) =>
        name === "ob_admin_session" ? { value: "admin_token" } : undefined,
    });
    getCustomerSessionMock.mockImplementationOnce(() => {
      throw new CustomerAuthError(401, "UNAUTHORIZED", "Customer session expired");
    });

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(401);
    expect(getCustomerSessionMock).toHaveBeenCalledWith(undefined, expect.any(Object));
  });
});
