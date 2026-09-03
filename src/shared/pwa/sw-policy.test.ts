import { describe, expect, it } from "vitest";

import { resolveServiceWorkerRequestPolicy } from "./sw-policy";

const SCOPE_ORIGIN = "https://casa-antigua.test";

describe("resolveServiceWorkerRequestPolicy", () => {
  it("fuerza network-only para /api/* same-origin", () => {
    const policy = resolveServiceWorkerRequestPolicy({
      requestMethod: "GET",
      requestMode: "cors",
      requestUrl: `${SCOPE_ORIGIN}/api/menu`,
      scopeOrigin: SCOPE_ORIGIN,
    });

    expect(policy.strategy).toBe("network-only");
  });

  it("usa network-first para navegaciones HTML", () => {
    const policy = resolveServiceWorkerRequestPolicy({
      requestMethod: "GET",
      requestMode: "navigate",
      requestUrl: `${SCOPE_ORIGIN}/menu`,
      scopeOrigin: SCOPE_ORIGIN,
    });

    expect(policy.strategy).toBe("network-first");
  });

  it("usa stale-while-revalidate para assets estaticos versionables", () => {
    const policy = resolveServiceWorkerRequestPolicy({
      requestMethod: "GET",
      requestMode: "no-cors",
      requestUrl: `${SCOPE_ORIGIN}/_next/static/chunks/app.js`,
      scopeOrigin: SCOPE_ORIGIN,
    });

    expect(policy.strategy).toBe("stale-while-revalidate");
  });

  it("deja passthrough para requests que no deben entrar al cache", () => {
    const policy = resolveServiceWorkerRequestPolicy({
      requestMethod: "POST",
      requestMode: "cors",
      requestUrl: `${SCOPE_ORIGIN}/api/orders`,
      scopeOrigin: SCOPE_ORIGIN,
    });

    expect(policy.strategy).toBe("passthrough");
  });
});
