import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultBusinessSettingsRecord } from "@/modules/business-settings/domain/business-settings-defaults";

const createOrderMock = vi.fn();
const loadBusinessSettingsMock = vi.fn();

/**
 * El reloj se fija a las 19:00 del viernes en Managua, dentro del horario por defecto
 * (12:00-22:00). Sin esto, el estado operativo haría que los tests dependan de la hora
 * a la que se corran.
 */
const PINNED_NOW = new Date("2026-09-11T19:00:00-06:00");

/**
 * Este archivo manda más pedidos que el límite de producción (10 por minuto y por IP), así
 * que el límite se sube acá. El valor por defecto del servicio no cambia.
 */
process.env.ORDER_CREATE_RATE_LIMIT = "200";

vi.mock("@/modules/notifications/adapters/outbox-subscriber", () => ({
  registerOutboxEventBusHandlers: vi.fn(),
}));

vi.mock("@/modules/orders/adapters/prisma-order-repository", () => ({
  PrismaOrderRepository: vi.fn(function () {
    return {};
  }),
}));

/**
 * Sin locales cargados (el mock devuelve vacío) el gate operativo sale de la configuración,
 * que es como funcionaba antes de T8. Los casos de local pisan este mock.
 */
const listLocationsMock = vi.fn(async () => [] as unknown[]);

vi.mock("@/modules/locations/adapters/prisma-location-repository", () => ({
  PrismaLocationRepository: vi.fn(function () {
    return { listLocations: listLocationsMock };
  }),
}));

vi.mock("@/modules/business-settings/adapters/prisma-business-settings-repository", () => ({
  PrismaBusinessSettingsRepository: vi.fn(function () {
    return {};
  }),
}));

vi.mock(
  "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings",
  () => ({
    loadBusinessSettings: loadBusinessSettingsMock,
  }),
);

vi.mock("@/modules/orders/features/create-order/create-order", () => ({
  createOrder: createOrderMock,
}));

describe("POST /api/orders", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // `reset` explícito: una implementación `Once` de un test anterior se consumía en el
    // siguiente y lo hacía fallar por algo que no tenía que ver.
    listLocationsMock.mockReset();
    listLocationsMock.mockResolvedValue([]);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PINNED_NOW);
    loadBusinessSettingsMock.mockResolvedValue(createDefaultBusinessSettingsRecord());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("completa la hora de retiro cuando el cliente no programa el pedido", async () => {
    createOrderMock.mockResolvedValueOnce({
      data: { id: "order_01", type: "pickup" },
      meta: { sourceOfTruth: "backend" },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          type: "pickup",
          customerName: "Daniel",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1 }],
        }),
      }),
    );

    expect(response.status).toBe(201);
    // El reloj del servidor, no el del cliente: si el cliente mandara su propia hora
    // "lo antes posible", un formulario lento la volvería una hora del pasado.
    expect(createOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pickupTime: new Date(PINNED_NOW.getTime() + 25 * 60_000).toISOString(),
        pickupScheduled: false,
      }),
      expect.any(Object),
    );
  });

  it("deja pasar el local de retiro que eligió el cliente (T8)", async () => {
    createOrderMock.mockResolvedValueOnce({
      data: { id: "order_01", type: "pickup" },
      meta: { sourceOfTruth: "backend" },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          type: "pickup",
          locationId: "loc_norte",
          customerName: "Daniel",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1 }],
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ locationId: "loc_norte" }),
      expect.any(Object),
    );
  });

  it("no acepta pedidos si el local elegido está pausado (T8)", async () => {
    listLocationsMock.mockResolvedValueOnce([
      {
        id: "loc_norte",
        name: "Norte",
        slug: "norte",
        isActive: true,
        sortOrder: 1,
        isAcceptingOrders: false,
        closedMessage: "Volvemos mañana a las 12.",
        businessHours: createDefaultBusinessSettingsRecord().businessHours,
        pickupLeadMinutes: 25,
        pickupMaxMinutes: null,
      },
    ]);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          type: "pickup",
          locationId: "loc_norte",
          customerName: "Daniel",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1 }],
        }),
      }),
    );

    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error.message).toContain("Volvemos mañana");
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it("marca el pedido como programado cuando el cliente elige la hora", async () => {
    createOrderMock.mockResolvedValueOnce({
      data: { id: "order_01", type: "pickup" },
      meta: { sourceOfTruth: "backend" },
    });

    const { POST } = await import("./route");
    await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          type: "pickup",
          customerName: "Daniel",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1 }],
          pickupTime: "2026-09-11T20:30:00-06:00",
        }),
      }),
    );

    expect(createOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pickupTime: new Date("2026-09-11T20:30:00-06:00").toISOString(),
        pickupScheduled: true,
      }),
      expect.any(Object),
    );
  });

  it("rechaza el pedido si el negocio no está aceptando pedidos", async () => {
    loadBusinessSettingsMock.mockResolvedValue(
      createDefaultBusinessSettingsRecord({ isAcceptingOrders: false }),
    );

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          type: "pickup",
          customerName: "Daniel",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1 }],
        }),
      }),
    );

    expect(response.status).toBe(409);
    expect(createOrderMock).not.toHaveBeenCalled();
    const payload = await response.json();
    expect(payload.error.fields.acceptance).toBe("not-accepting-orders");
    expect(payload.error.message).toBe(
      "Estamos cerrados. Podés mirar el menú y volver cuando abramos.",
    );
  });

  it("rechaza una hora de retiro fuera del horario del local", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          type: "pickup",
          customerName: "Daniel",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1 }],
          // 23:00 en Managua: todavía no pasó (son las 19:00) pero el local cerró a las 22:00.
          pickupTime: "2026-09-11T23:00:00-06:00",
        }),
      }),
    );

    expect(response.status).toBe(409);
    expect(createOrderMock).not.toHaveBeenCalled();
    const payload = await response.json();
    expect(payload.error.fields.acceptance).toBe("closed");
  });

  it("acepta el pedido dentro del horario y le pasa la hora de retiro", async () => {
    createOrderMock.mockResolvedValueOnce({
      data: { id: "order_01", type: "pickup" },
      meta: { sourceOfTruth: "backend" },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          type: "pickup",
          customerName: "Daniel",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1 }],
          pickupTime: "2026-09-11T20:00:00-06:00",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createOrderMock).toHaveBeenCalled();
  });

  it("rejects delivery orders in the One Burger pickup-only MVP", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          type: "delivery",
          customerName: "Daniel",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1 }],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it("rejects table orders in the One Burger pickup-only MVP", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          type: "table",
          customerName: "Daniel",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1 }],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it("accepts pickup orders and delegates total calculation to the domain feature", async () => {
    createOrderMock.mockResolvedValueOnce({
      data: { id: "order_01", type: "pickup" },
      meta: { sourceOfTruth: "backend" },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          type: "pickup",
          customerName: "Daniel",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1 }],
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "pickup" }),
      expect.any(Object),
    );
  });

  it("inyecta la propina configurada en el negocio en vez de un 10 % fijo", async () => {
    loadBusinessSettingsMock.mockResolvedValue(
      createDefaultBusinessSettingsRecord({ tipEnabled: true, tipRate: 15 }),
    );
    createOrderMock.mockResolvedValueOnce({
      data: { id: "order_01", type: "pickup" },
      meta: { sourceOfTruth: "backend" },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          type: "pickup",
          customerName: "Daniel",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1 }],
          tipOptIn: true,
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "pickup", tipOptIn: true }),
      expect.objectContaining({ tipPolicy: { enabled: true, rate: 15 } }),
    );
  });
});
