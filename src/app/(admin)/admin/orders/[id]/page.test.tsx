// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "ord_1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

import AdminOrderDetailPage from "./page";

/** Mismo criterio que la bandeja: la hora prometida manda, no la antigüedad del pedido. */

const NOW = new Date("2026-09-11T20:10:00-06:00");

function detail(overrides: Record<string, unknown> = {}) {
  return {
    id: "ord_1",
    orderNumber: "OB-1",
    type: "pickup",
    status: "preparing",
    customerName: "Ana",
    customerWhatsapp: "+50588887777",
    subtotal: 380,
    discount: 0,
    packagingAmount: 0,
    deliveryFeeAmount: 0,
    tipAmount: 0,
    total: 380,
    items: [],
    createdAt: "2026-09-12T01:40:00.000Z",
    updatedAt: "2026-09-12T01:40:00.000Z",
    ...overrides,
  };
}

function timingChip(container: HTMLElement, tone: "on-time" | "past" | "late") {
  return container.querySelector(`[class*="bg-pickup-${tone}"]`);
}

async function renderWith(order: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: order }),
    }),
  );

  const view = render(<AdminOrderDetailPage />);
  await waitFor(() => expect(screen.getByText("OB-1")).toBeTruthy());

  return view;
}

describe("detalle de la orden: hora de retiro", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("muestra la hora del retiro programado", async () => {
    await renderWith({
      ...detail(),
      pickupTime: "2026-09-12T02:30:00.000Z",
      pickupScheduled: true,
    });

    expect(screen.getByText("Retiro 8:30 p. m. · Programado")).toBeTruthy();
  });

  it("distingue un pedido sin programar", async () => {
    await renderWith({
      ...detail(),
      pickupTime: "2026-09-12T02:35:00.000Z",
      pickupScheduled: false,
    });

    expect(screen.getByText("Retiro ~8:35 p. m. · Lo antes posible")).toBeTruthy();
  });

  it("pinta el atraso contra la hora prometida", async () => {
    const { container } = await renderWith({
      ...detail(),
      pickupTime: "2026-09-12T01:50:00.000Z",
      pickupScheduled: true,
    });

    expect(timingChip(container, "late")?.textContent).toBe("hace 20 min");
  });

  it("una orden cerrada no alarma", async () => {
    const { container } = await renderWith({
      ...detail({ status: "closed" }),
      pickupTime: "2026-09-12T01:00:00.000Z",
      pickupScheduled: true,
    });

    expect(timingChip(container, "late")).toBeNull();
    expect(timingChip(container, "past")).toBeNull();
  });
});

/**
 * T8 fase 7 — de qué local sale el pedido.
 *
 * Con más de una sucursal, el mismo número de pedido puede existir en dos cocinas: el
 * detalle tiene que decir cuál, y con la dirección para poder mandarlo si hace falta.
 */
describe("detalle de la orden: local de retiro", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("muestra el local y su dirección", async () => {
    await renderWith({
      ...detail(),
      pickupLocation: {
        name: "Sucursal Norte",
        addressLine: "Frente al parque",
        addressReference: null,
        city: "Managua",
        mapsUrl: null,
      },
    });

    expect(screen.getByText("Local")).toBeTruthy();
    expect(screen.getByText("Sucursal Norte")).toBeTruthy();
    expect(screen.getByText("Frente al parque, Managua")).toBeTruthy();
  });

  it("sin local resuelto no dibuja la sección", async () => {
    await renderWith({ ...detail(), pickupLocation: null });

    expect(screen.queryByText("Local")).toBeNull();
  });
});
