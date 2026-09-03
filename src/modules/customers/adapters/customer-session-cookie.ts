import { CUSTOMER_SESSION_TTL_MS } from "@/modules/customers/domain/customer-auth-policy";

export const CUSTOMER_SESSION_COOKIE_NAME = "ca_customer_session";

export function buildCustomerSessionExpiry(now = new Date()) {
  return new Date(now.getTime() + CUSTOMER_SESSION_TTL_MS);
}

export function buildCustomerSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  };
}
