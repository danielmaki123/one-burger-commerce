import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRawMock = vi.fn();

vi.mock("@/infrastructure/database/prisma", () => ({
  getPrismaClient: () => ({
    $queryRaw: queryRawMock,
  }),
}));

describe("GET /api/readiness", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns ready when the database responds", async () => {
    queryRawMock.mockResolvedValueOnce([{ "?column?": 1 }]);

    const route = await import("./route");
    const response = await route.GET();
    const body = await response.json();

    expect(route.dynamic).toBe("force-dynamic");
    expect(route.revalidate).toBe(0);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.status).toBe("ready");
    expect(body.checks.database.status).toBe("ok");
  });

  it("returns unavailable when the database check fails", async () => {
    queryRawMock.mockRejectedValueOnce(new Error("database unavailable"));

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.status).toBe("unavailable");
    expect(body.checks.database.status).toBe("error");
  });
});
