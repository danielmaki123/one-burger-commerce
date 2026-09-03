import { beforeEach, describe, expect, it, vi } from "vitest";

const listPublicDeliveryZonesMock = vi.fn();

vi.mock("@/modules/orders/adapters/prisma-delivery-zone-repository", () => ({
  PrismaDeliveryZoneRepository: vi.fn(function Repository() {
    return {};
  }),
}));

vi.mock(
  "@/modules/orders/features/list-public-delivery-zones/list-public-delivery-zones",
  () => ({
    listPublicDeliveryZones: listPublicDeliveryZonesMock,
  }),
);

describe("GET /api/delivery-zones", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns a no-store dynamic response", async () => {
    listPublicDeliveryZonesMock.mockResolvedValueOnce({
      data: [{ id: "zone_1", name: "Centro", description: null, baseFee: 25 }],
    });

    const route = await import("./route");
    const response = await route.GET();
    const body = await response.json();

    expect(route.dynamic).toBe("force-dynamic");
    expect(route.revalidate).toBe(0);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.data).toHaveLength(1);
  });
});
