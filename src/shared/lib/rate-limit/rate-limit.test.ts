import { describe, expect, it } from "vitest";

import { FixedWindowRateLimiter, getClientIp } from "@/shared/lib/rate-limit/rate-limit";

describe("FixedWindowRateLimiter", () => {
  it("permite hasta el limite y bloquea el siguiente intento dentro de la ventana", () => {
    const now = 1_000;
    const limiter = new FixedWindowRateLimiter({
      prefix: "test-login",
      limit: 5,
      windowMs: 60_000,
      now: () => now,
    });

    for (let i = 0; i < 5; i += 1) {
      const result = limiter.consume("127.0.0.1");
      expect(result.allowed).toBe(true);
    }

    const blocked = limiter.consume("127.0.0.1");

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
    expect(blocked.remaining).toBe(0);
  });

  it("reinicia la ventana cuando expira", () => {
    let now = 1_000;
    const limiter = new FixedWindowRateLimiter({
      prefix: "test-otp",
      limit: 2,
      windowMs: 10_000,
      now: () => now,
    });

    expect(limiter.consume("10.0.0.1").allowed).toBe(true);
    expect(limiter.consume("10.0.0.1").allowed).toBe(true);
    expect(limiter.consume("10.0.0.1").allowed).toBe(false);

    now += 10_001;

    const reset = limiter.consume("10.0.0.1");
    expect(reset.allowed).toBe(true);
    expect(reset.remaining).toBe(1);
  });

  it("usa buckets separados por clave", () => {
    const limiter = new FixedWindowRateLimiter({
      prefix: "test-separated",
      limit: 1,
      windowMs: 60_000,
    });

    expect(limiter.consume("ip-a").allowed).toBe(true);
    expect(limiter.consume("ip-b").allowed).toBe(true);
    expect(limiter.consume("ip-a").allowed).toBe(false);
  });
});

describe("getClientIp", () => {
  it("prioriza x-forwarded-for", () => {
    const request = new Request("http://localhost/test", {
      headers: {
        "x-forwarded-for": "203.0.113.1, 10.0.0.1",
        "x-real-ip": "198.51.100.5",
      },
    });

    expect(getClientIp(request)).toBe("203.0.113.1");
  });

  it("usa x-real-ip como fallback", () => {
    const request = new Request("http://localhost/test", {
      headers: {
        "x-real-ip": "198.51.100.5",
      },
    });

    expect(getClientIp(request)).toBe("198.51.100.5");
  });

  it("devuelve unknown si no hay headers de ip", () => {
    const request = new Request("http://localhost/test");
    expect(getClientIp(request)).toBe("unknown");
  });
});
