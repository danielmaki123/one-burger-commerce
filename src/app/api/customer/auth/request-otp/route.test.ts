import { beforeEach, describe, expect, it, vi } from "vitest";

const requestOtpMock = vi.fn();
const repositoryCtorMock = vi.fn(
  function RepositoryMock(this: Record<string, never>) {
    return this;
  },
);
const devOtpSenderCtorMock = vi.fn(
  function SenderMock(this: Record<string, never>) {
    return this;
  },
);

vi.mock("@/modules/customers/adapters/prisma-customer-auth-repository", () => ({
  PrismaCustomerAuthRepository: repositoryCtorMock,
}));

vi.mock("@/modules/customers/adapters/dev-otp-sender", () => ({
  DevOtpSender: devOtpSenderCtorMock,
}));

vi.mock("@/modules/customers/features/request-otp/request-otp", () => ({
  requestOtp: requestOtpMock,
}));

vi.mock("@/shared/lib/rate-limit/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/rate-limit/rate-limit")>(
    "@/shared/lib/rate-limit/rate-limit",
  );
  return actual;
});

describe("POST /api/customer/auth/request-otp", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { resetAllRateLimiters } = await import("@/shared/lib/rate-limit/rate-limit");
    resetAllRateLimiters();
  });

  it("permite hasta 5 intentos desde la misma IP", async () => {
    requestOtpMock.mockResolvedValue({
      expiresAt: "2026-06-02T18:00:00.000Z",
      devOtpCode: "123456",
    });

    const { POST } = await import("./route");

    for (let i = 0; i < 5; i += 1) {
      const response = await POST(
        new Request("http://localhost/api/customer/auth/request-otp", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "203.0.113.15",
          },
          body: JSON.stringify({ whatsapp: "+50588887777" }),
        }),
      );

      expect(response.status).toBe(200);
    }
  });

  it("bloquea el sexto intento con 429 y Retry-After", async () => {
    requestOtpMock.mockResolvedValue({
      expiresAt: "2026-06-02T18:00:00.000Z",
      devOtpCode: "123456",
    });

    const { POST } = await import("./route");

    for (let i = 0; i < 5; i += 1) {
      await POST(
        new Request("http://localhost/api/customer/auth/request-otp", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "198.51.100.25",
          },
          body: JSON.stringify({ whatsapp: "+50588887777" }),
        }),
      );
    }

    const blocked = await POST(
      new Request("http://localhost/api/customer/auth/request-otp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.25",
        },
        body: JSON.stringify({ whatsapp: "+50588887777" }),
      }),
    );

    const body = await blocked.json();

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
    expect(body.error.code).toBe("TOO_MANY_REQUESTS");
    expect(requestOtpMock).toHaveBeenCalledTimes(5);
  });
});
