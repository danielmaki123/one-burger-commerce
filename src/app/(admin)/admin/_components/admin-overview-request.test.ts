import { describe, expect, it } from "vitest";

import { runAdminOverviewRequest } from "./admin-overview-request";

type Payload = { data: { id: string } };

function isPayload(value: unknown): value is Payload {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    typeof value.data === "object" &&
    value.data !== null &&
    "id" in value.data &&
    typeof value.data.id === "string"
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("runAdminOverviewRequest", () => {
  it.each([
    [401, "/admin/login"],
    [403, "/admin/inventory"],
  ] as const)("redirects status %s without exposing a retry error", async (status, href) => {
    const redirects: string[] = [];
    const errors: string[] = [];

    await runAdminOverviewRequest<Payload>({
      signal: new AbortController().signal,
      request: async () => new Response(null, { status }),
      isPayload,
      onData: () => undefined,
      onError: () => errors.push("error"),
      onRedirect: (target) => redirects.push(target),
    });

    expect(redirects).toEqual([href]);
    expect(errors).toEqual([]);
  });

  it("reports recoverable server failures without redirecting", async () => {
    const redirects: string[] = [];
    const errors: string[] = [];

    await runAdminOverviewRequest<Payload>({
      signal: new AbortController().signal,
      request: async () => new Response(null, { status: 500 }),
      isPayload,
      onData: () => undefined,
      onError: () => errors.push("error"),
      onRedirect: (target) => redirects.push(target),
    });

    expect(errors).toEqual(["error"]);
    expect(redirects).toEqual([]);
  });

  it("does not commit an aborted response that resolves after the latest request", async () => {
    const oldResponse = deferred<Response>();
    const newResponse = deferred<Response>();
    const oldController = new AbortController();
    const newController = new AbortController();
    const commits: string[] = [];

    const oldRequest = runAdminOverviewRequest<Payload>({
      signal: oldController.signal,
      request: () => oldResponse.promise,
      isPayload,
      onData: (payload) => commits.push(payload.data.id),
      onError: () => commits.push("old-error"),
      onRedirect: () => commits.push("old-redirect"),
    });

    oldController.abort();

    const latestRequest = runAdminOverviewRequest<Payload>({
      signal: newController.signal,
      request: () => newResponse.promise,
      isPayload,
      onData: (payload) => commits.push(payload.data.id),
      onError: () => commits.push("new-error"),
      onRedirect: () => commits.push("new-redirect"),
    });

    newResponse.resolve(Response.json({ data: { id: "new" } }));
    await latestRequest;
    oldResponse.resolve(Response.json({ data: { id: "old" } }));
    await oldRequest;

    expect(commits).toEqual(["new"]);
  });
});
