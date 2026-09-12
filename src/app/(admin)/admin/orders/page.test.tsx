// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminOrdersPage from "./page";

/**
 * La bandeja de órdenes tiene que decir **para cuándo es cada retiro** y qué tan
 * atrasado va contra esa hora. Antes no mostraba la hora en absoluto, y el rojo se
 * disparaba por antigüedad del pedido: uno programado para las 21:00 aparecía en rojo
 * a las 19:20.
 */

const NOW = new Date("2026-09-11T20:10:00-06:00");

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "ord_1",
    orderNumber: "OB-1",
    type: "pickup",
    status: "preparing",
    customerName: "Ana",
    customerWhatsapp: "+50588887777",
    total: 380,
    createdAt: "2026-09-12T01:40:00.000Z",
    ...overrides,
  };
}

/**
 * El chip del semáforo, por su token de color. Se busca por substring porque la clase
 * lleva opacidad (`bg-pickup-late/15`) y el `/` no matchea en un selector de clase.
 */
function timingChip(container: HTMLElement, tone: "on-time" | "past" | "late") {
  return container.querySelector(`[class*="bg-pickup-${tone}"]`);
}

async function renderWith(orders: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: orders }),
    }),
  );

  const view = render(<AdminOrdersPage />);
  await waitFor(() => expect(screen.getByText("OB-1")).toBeTruthy());

  return view;
}

/**
 * Render con locales cargados (T8): el filtro por local solo aparece cuando hay más de uno.
 */
async function renderWithLocations(
  orders: unknown[],
  locations: Array<{ id: string; name: string; isActive?: boolean }>,
) {
  const fetchMock = vi.fn((url: string) =>
    Promise.resolve({
      ok: true,
      json: async () => ({ data: String(url).includes("/api/admin/locations") ? locations : orders }),
    }),
  );
  vi.stubGlobal("fetch", fetchMock);

  const view = render(<AdminOrdersPage />);
  await waitFor(() => expect(screen.getByText("OB-1")).toBeTruthy());

  return { ...view, fetchMock };
}

describe("bandeja de órdenes: hora de retiro y semáforo", () => {
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
    await renderWith([
      order({ pickupTime: "2026-09-12T02:30:00.000Z", pickupScheduled: true }),
    ]);

    expect(screen.getByText("Retiro 8:30 p. m. · Programado")).toBeTruthy();
  });

  it("distingue un pedido sin programar de uno programado", async () => {
    await renderWith([
      order({ pickupTime: "2026-09-12T02:35:00.000Z", pickupScheduled: false }),
    ]);

    expect(screen.getByText("Retiro ~8:35 p. m. · Lo antes posible")).toBeTruthy();
  });

  it("pinta en verde mientras falta para la hora prometida", async () => {
    const { container } = await renderWith([
      order({ pickupTime: "2026-09-12T02:40:00.000Z", pickupScheduled: true }),
    ]);

    expect(timingChip(container, "on-time")?.textContent).toBe("en 30 min");
  });

  it("pasa a naranja cuando se cumplió la hora", async () => {
    const { container } = await renderWith([
      order({ pickupTime: "2026-09-12T02:05:00.000Z", pickupScheduled: true }),
    ]);

    expect(timingChip(container, "past")?.textContent).toBe("hace 5 min");
  });

  it("pasa a rojo cuando ya es muy tarde", async () => {
    const { container } = await renderWith([
      order({ pickupTime: "2026-09-12T01:50:00.000Z", pickupScheduled: true }),
    ]);

    expect(timingChip(container, "late")?.textContent).toBe("hace 20 min");
  });

  it("un pedido programado para más tarde no alarma, por viejo que sea", async () => {
    // Es el bug que esto arregla: antes el color salía de la antigüedad del pedido, así
    // que uno creado hace 70 minutos ya estaba en rojo con 50 minutos de margen.
    const { container } = await renderWith([
      order({
        createdAt: "2026-09-12T01:00:00.000Z",
        pickupTime: "2026-09-12T03:00:00.000Z",
        pickupScheduled: true,
      }),
    ]);

    expect(timingChip(container, "on-time")?.textContent).toBe("en 50 min");
    expect(timingChip(container, "past")).toBeNull();
    expect(timingChip(container, "late")).toBeNull();
  });

  it("un pedido cerrado no alarma", async () => {
    const { container } = await renderWith([
      order({
        status: "closed",
        pickupTime: "2026-09-12T01:00:00.000Z",
        pickupScheduled: true,
      }),
    ]);

    expect(timingChip(container, "past")).toBeNull();
    expect(timingChip(container, "late")).toBeNull();
    expect(timingChip(container, "on-time")).toBeNull();
  });

  it("no inventa una hora si el pedido no la tiene", async () => {
    const { container } = await renderWith([order({ pickupTime: null })]);

    // Sin hora cae al dato que sí existe: cuándo entró el pedido.
    expect(screen.queryByText(/^Retiro ~?\d/)).toBeNull();
    expect(screen.getByText(/^Recibida /)).toBeTruthy();
    expect(timingChip(container, "late")).toBeNull();
  });

  it("con un solo local no dibuja el filtro por local (T8)", async () => {
    const user = userEvent.setup();
    await renderWithLocations([order()], [{ id: "loc_principal", name: "Principal", isActive: true }]);

    // El panel de filtros se abre a propósito: si no, la ausencia no probaría nada.
    await user.click(screen.getByRole("button", { name: "Mostrar filtros" }));

    expect(screen.queryByLabelText("Local")).toBeNull();
  });

  it("con varios locales deja filtrar y muestra de qué local es cada pedido (T8)", async () => {
    const user = userEvent.setup();
    const { fetchMock } = await renderWithLocations(
      [order({ locationName: "Norte" })],
      [
        { id: "loc_principal", name: "Principal", isActive: true },
        { id: "loc_norte", name: "Norte", isActive: true },
      ],
    );

    // El pedido dice de qué local es.
    expect(screen.getByText(/· Norte/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Mostrar filtros" }));
    await user.selectOptions(screen.getByLabelText("Local"), "loc_norte");

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("locationId=loc_norte")),
    );
  });
});
