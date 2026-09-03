import { describe, expect, it, vi } from "vitest";

import type { DeviceOrderRef } from "./device-orders";
import type { DeviceReservationRef } from "./device-reservations";
import {
  ACTIVITY_MANUAL_ORDER_LABEL,
  getLatestActivityUpdateText,
  getActivityContextCopy,
  getActivitySummary,
  LEGACY_RESERVATION_BADGE,
  refreshActivity,
  TRACKABLE_RESERVATION_BADGE,
} from "./activity-refresh";

function makeOrder(
  overrides?: Partial<DeviceOrderRef>,
): DeviceOrderRef {
  return {
    orderNumber: "P-001",
    type: "pickup",
    status: "confirmed",
    statusLabel: "Confirmada",
    updatedAt: "2026-06-02T01:00:00.000Z",
    total: 500,
    ...overrides,
  };
}

function makeReservation(
  overrides?: Partial<DeviceReservationRef>,
): DeviceReservationRef {
  return {
    status: "requested",
    reservationNumber: "RSV-001",
    reservationLookupToken: "token_1",
    date: "2026-06-05",
    time: "19:00",
    partySize: 2,
    tableLabel: "Mesa 1",
    updatedAt: "2026-06-02T01:00:00.000Z",
    ...overrides,
  };
}

function createDeps() {
  return {
    getCheckedAt: vi.fn(() => "2026-06-02T02:00:00.000Z"),
    markOrderStale: vi.fn(),
    markReservationStale: vi.fn(),
    syncOrder: vi.fn(),
    syncReservation: vi.fn(),
    trackOrder: vi.fn(),
    trackReservation: vi.fn(),
  };
}

describe("activity refresh", () => {
  it("refreshes active orders and active trackable reservations", async () => {
    const deps = createDeps();
    deps.trackOrder.mockResolvedValue({
      orderNumber: "P-001",
      type: "pickup",
      status: "ready",
      statusLabel: "Lista",
      updatedAt: "2026-06-02T02:10:00.000Z",
      total: 500,
    });
    deps.trackReservation.mockResolvedValue({
      reservationNumber: "RSV-001",
      status: "approved",
      statusLabel: "Confirmada",
      date: "2026-06-05",
      time: "19:00",
      partySize: 2,
      tableLabel: "Mesa 1",
      updatedAt: "2026-06-02T02:15:00.000Z",
    });

    const result = await refreshActivity(
      {
        orders: [makeOrder()],
        reservations: [makeReservation()],
        trackingWhatsapp: "+50586790000",
      },
      deps,
    );

    expect(deps.trackOrder).toHaveBeenCalledTimes(1);
    expect(deps.trackReservation).toHaveBeenCalledTimes(1);
    expect(deps.syncOrder).toHaveBeenCalledTimes(1);
    expect(deps.syncReservation).toHaveBeenCalledTimes(1);
    expect(result.feedback).toBe("Estados actualizados.");
  });

  it("skips legacy reservations without token and keeps compatibility", async () => {
    const deps = createDeps();

    const result = await refreshActivity(
      {
        orders: [],
        reservations: [
          makeReservation({
            reservationNumber: undefined,
            reservationLookupToken: undefined,
          }),
        ],
        trackingWhatsapp: "",
      },
      deps,
    );

    expect(deps.trackReservation).not.toHaveBeenCalled();
    expect(result.attemptedReservationCount).toBe(0);
    expect(result.feedback).toBe("No hay actividades activas para actualizar.");
  });

  it("marks no changes when tracked reservation matches current local status", async () => {
    const deps = createDeps();
    deps.trackReservation.mockResolvedValue({
      reservationNumber: "RSV-001",
      status: "requested",
      statusLabel: "Solicitada",
      date: "2026-06-05",
      time: "19:00",
      partySize: 2,
      tableLabel: "Mesa 1",
      updatedAt: "2026-06-02T01:00:00.000Z",
    });

    const result = await refreshActivity(
      {
        orders: [],
        reservations: [makeReservation()],
        trackingWhatsapp: "",
      },
      deps,
    );

    expect(result.changedCount).toBe(0);
    expect(result.unchangedCount).toBe(1);
    expect(result.feedback).toBe(
      "No encontramos cambios en tus actividades guardadas.",
    );
  });

  it("returns controlled feedback on partial failure", async () => {
    const deps = createDeps();
    deps.trackOrder.mockRejectedValue(new Error("fail order"));
    deps.trackReservation.mockResolvedValue({
      reservationNumber: "RSV-001",
      status: "approved",
      statusLabel: "Confirmada",
      date: "2026-06-05",
      time: "19:00",
      partySize: 2,
      tableLabel: "Mesa 1",
      updatedAt: "2026-06-02T02:15:00.000Z",
    });

    const result = await refreshActivity(
      {
        orders: [makeOrder()],
        reservations: [makeReservation()],
        trackingWhatsapp: "+50586790000",
      },
      deps,
    );

    expect(deps.markOrderStale).toHaveBeenCalledWith("P-001", true);
    expect(result.failedCount).toBe(1);
    expect(result.feedback).toBe(
      "Algunas actividades no pudieron actualizarse.",
    );
  });

  it("prompts inline whatsapp while still refreshing trackable reservations", async () => {
    const deps = createDeps();
    deps.trackReservation.mockResolvedValue({
      reservationNumber: "RSV-001",
      status: "approved",
      statusLabel: "Confirmada",
      date: "2026-06-05",
      time: "19:00",
      partySize: 2,
      tableLabel: "Mesa 1",
      updatedAt: "2026-06-02T02:15:00.000Z",
    });

    const result = await refreshActivity(
      {
        orders: [makeOrder()],
        reservations: [makeReservation()],
        trackingWhatsapp: "",
      },
      deps,
    );

    expect(result.needsWhatsappPrompt).toBe(true);
    expect(deps.trackOrder).not.toHaveBeenCalled();
    expect(deps.trackReservation).toHaveBeenCalledTimes(1);
    expect(result.feedback).toBe(
      "Actualizamos reservas. Para pedidos necesitamos tu WhatsApp.",
    );
  });

  it("refreshes tokenized orders without asking for whatsapp", async () => {
    const deps = createDeps();
    deps.trackOrder.mockResolvedValue({
      orderNumber: "D-TOKEN",
      type: "delivery",
      status: "confirmed",
      statusLabel: "Confirmada",
      updatedAt: "2026-06-02T02:10:00.000Z",
      total: 500,
    });

    const result = await refreshActivity(
      {
        orders: [makeOrder({ orderNumber: "D-TOKEN", orderLookupToken: "opaque-token-123" })],
        reservations: [],
        trackingWhatsapp: "",
      },
      deps,
    );

    expect(result.needsWhatsappPrompt).toBe(false);
    expect(deps.trackOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderNumber: "D-TOKEN", orderLookupToken: "opaque-token-123" }),
      "",
    );
    expect(result.attemptedOrderCount).toBe(1);
  });

  it("skips only legacy orders when whatsapp is missing", async () => {
    const deps = createDeps();
    deps.trackOrder.mockResolvedValue({
      orderNumber: "D-TOKEN",
      type: "delivery",
      status: "confirmed",
      statusLabel: "Confirmada",
      updatedAt: "2026-06-02T02:10:00.000Z",
      total: 500,
    });

    const result = await refreshActivity(
      {
        orders: [
          makeOrder({ orderNumber: "D-TOKEN", orderLookupToken: "opaque-token-123" }),
          makeOrder({ orderNumber: "P-LEGACY", orderLookupToken: undefined }),
        ],
        reservations: [],
        trackingWhatsapp: "",
      },
      deps,
    );

    expect(result.needsWhatsappPrompt).toBe(true);
    expect(result.attemptedOrderCount).toBe(1);
    expect(deps.trackOrder).toHaveBeenCalledTimes(1);
    expect(deps.trackOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderNumber: "D-TOKEN" }),
      "",
    );
  });

  it("builds latest sync text from orders and reservations", () => {
    const text = getLatestActivityUpdateText(
      [makeOrder({ lastCheckedAt: "2026-06-02T02:00:00.000Z" })],
      [makeReservation({ lastCheckedAt: "2026-06-02T03:00:00.000Z" })],
    );

    expect(text).toContain("Ultima sincronizacion:");
  });

  it("returns summary counts for active orders, active reservations and legacy reservations", () => {
    const summary = getActivitySummary(
      [
        makeOrder(),
        makeOrder({ orderNumber: "P-002", status: "delivered" }),
      ],
      [
        makeReservation(),
        makeReservation({
          reservationNumber: undefined,
          reservationLookupToken: undefined,
          createdAt: "2026-06-02T04:00:00.000Z",
          updatedAt: "2026-06-02T04:00:00.000Z",
        }),
        makeReservation({
          reservationNumber: "RSV-002",
          reservationLookupToken: "token_2",
          status: "cancelled",
          createdAt: "2026-06-02T05:00:00.000Z",
          updatedAt: "2026-06-02T05:00:00.000Z",
        }),
      ],
    );

    expect(summary).toEqual({
      activeOrderCount: 1,
      activeReservationCount: 2,
      legacyReservationCount: 1,
    });
  });

  it("returns contextual copy for empty orders tab with active reservations", () => {
    const text = getActivityContextCopy({
      activeTab: "orders",
      activeOrderCount: 0,
      activeReservationCount: 2,
    });

    expect(text).toBe(
      "No hay pedidos guardados. Tambien podes actualizar tus reservas desde aqui.",
    );
  });

  it("returns general context copy outside the empty-orders case", () => {
    const text = getActivityContextCopy({
      activeTab: "reservations",
      activeOrderCount: 0,
      activeReservationCount: 1,
    });

    expect(text).toBe(
      "Actualiza pedidos y reservas guardados en este dispositivo.",
    );
  });

  it("exports the updated labels for manual tracking and reservation badges", () => {
    expect(ACTIVITY_MANUAL_ORDER_LABEL).toBe(
      "Consultar pedido manualmente",
    );
    expect(LEGACY_RESERVATION_BADGE).toBe("Sin refresh automatico");
    expect(TRACKABLE_RESERVATION_BADGE).toBe("Seguimiento disponible");
  });

  it("uses the new no-changes copy", async () => {
    const deps = createDeps();
    deps.trackReservation.mockResolvedValue({
      reservationNumber: "RSV-001",
      status: "requested",
      statusLabel: "Solicitada",
      date: "2026-06-05",
      time: "19:00",
      partySize: 2,
      tableLabel: "Mesa 1",
      updatedAt: "2026-06-02T01:00:00.000Z",
    });

    const result = await refreshActivity(
      {
        orders: [],
        reservations: [makeReservation()],
        trackingWhatsapp: "",
      },
      deps,
    );

    expect(result.feedback).toBe(
      "No encontramos cambios en tus actividades guardadas.",
    );
  });
});
