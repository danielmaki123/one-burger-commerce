import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_PUBLIC_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL_PUBLIC_VERSION === undefined) {
      delete process.env.NEXT_PUBLIC_APP_VERSION;
      return;
    }

    process.env.NEXT_PUBLIC_APP_VERSION = ORIGINAL_PUBLIC_VERSION;
  });

  it("returns the resolved build version with no-store headers", async () => {
    process.env.NEXT_PUBLIC_APP_VERSION = "qa-v2";

    const route = await import("./route");
    const response = await route.GET();
    const body = await response.json();

    expect(route.dynamic).toBe("force-dynamic");
    expect(route.revalidate).toBe(0);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.version).toBe("qa-v2");
  });
});
