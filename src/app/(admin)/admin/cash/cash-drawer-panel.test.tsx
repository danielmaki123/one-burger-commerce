// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CashDrawerPanel from "./cash-drawer-panel";

/**
 * Tarea 1 del brief (2026-09-17) — **la caja, separada del POS**.
 *
 * Estos casos vivían en el test del POS («abre la caja con el conteo de billetes» y «cierra la caja y
 * muestra el arqueo»): se mudaron con la pantalla. Lo que fijan es lo mismo de antes, ahora en su lugar:
 * el conteo sale en el payload, el fondo lo deriva el servidor y el cierre muestra contado, esperado y
 * diferencia.
 */

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const locations = [{ id: "loc_norte", name: "Camino de Oriente" }];

describe("CashDrawerPanel", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/admin/pos/shift?")) return jsonResponse({ data: null });
      if (url === "/api/admin/pos/shift/open" && init?.method === "POST") {
        return jsonResponse(
          { data: { id: "shift_1", openedAt: "2026-09-15T14:00:00.000Z", openingAmount: 1000 } },
          201,
        );
      }
      if (url === "/api/admin/pos/shift/close" && init?.method === "POST") {
        return jsonResponse({
          data: { id: "shift_1", closingAmount: 900, expectedAmount: 1000, difference: -100 },
          meta: { expectedByCurrency: { NIO: 1000 } },
        });
      }
      return jsonResponse({ data: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("abre la caja con el conteo de billetes y manda el conteo al servidor", async () => {
    const user = userEvent.setup();
    render(<CashDrawerPanel locations={locations} />);

    expect(await screen.findByText(/Sin caja abierta en este local/)).toBeTruthy();

    await user.type(screen.getByLabelText("Cantidad de billetes de NIO 100"), "10");
    await user.click(screen.getByRole("button", { name: "Abrir caja" }));

    const openCall = fetchMock.mock.calls.find(([input]) => String(input) === "/api/admin/pos/shift/open");
    expect(openCall).toBeTruthy();
    const body = JSON.parse(String((openCall![1] as RequestInit).body));

    expect(body.locationId).toBe("loc_norte");
    expect(body.counts).toEqual([{ currency: "NIO", denomination: 100, quantity: 10 }]);
    // El fondo lo deriva el servidor del conteo: la pantalla muestra lo que devolvió.
    expect(await screen.findByText(/Caja abierta desde/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cerrar caja" })).toBeTruthy();
  });

  it("cierra la caja y muestra el arqueo con la diferencia y el esperado por moneda", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.startsWith("/api/admin/pos/shift?") && init?.method !== "POST") {
        return jsonResponse({
          data: { id: "shift_1", openedAt: "2026-09-15T14:00:00.000Z", openingAmount: 1000 },
        });
      }
      if (url === "/api/admin/pos/shift/close") {
        return jsonResponse({
          data: { id: "shift_1", closingAmount: 900, expectedAmount: 1000, difference: -100 },
          meta: { expectedByCurrency: { NIO: 1000 } },
        });
      }
      return jsonResponse({ data: null });
    });

    render(<CashDrawerPanel locations={locations} />);

    expect(await screen.findByText(/Caja abierta desde/)).toBeTruthy();

    await user.type(screen.getByLabelText("Cantidad de billetes de NIO 100"), "9");
    await user.click(screen.getByRole("button", { name: "Cerrar caja" }));

    const closeCall = fetchMock.mock.calls.find(
      ([input]) => String(input) === "/api/admin/pos/shift/close",
    );
    expect(JSON.parse(String((closeCall![1] as RequestInit).body)).counts).toEqual([
      { currency: "NIO", denomination: 100, quantity: 9 },
    ]);

    const resumen = await screen.findByRole("status");
    expect(resumen.textContent).toContain("Cierre registrado");
    expect(resumen.textContent).toContain("diferencia");
    // El operario ve el id del turno y la diferencia (tareas 5 y 6), no el arqueo completo.
    expect(resumen.textContent).toContain("shift_1");
    expect(resumen.textContent).not.toContain("esperado");
  });

  it("quien audita ve el arqueo completo con el detalle por moneda", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.startsWith("/api/admin/pos/shift?") && init?.method !== "POST") {
        return jsonResponse({
          data: { id: "shift_1", openedAt: "2026-09-15T14:00:00.000Z", openingAmount: 1000 },
        });
      }
      if (url === "/api/admin/pos/shift/close") {
        return jsonResponse({
          data: { id: "shift_1", closingAmount: 900, expectedAmount: 1000, difference: -100 },
          meta: { expectedByCurrency: { NIO: 1000 } },
        });
      }
      return jsonResponse({ data: null });
    });

    render(<CashDrawerPanel locations={locations} canSeeCloseDetail />);

    expect(await screen.findByText(/Caja abierta desde/)).toBeTruthy();
    await user.type(screen.getByLabelText("Cantidad de billetes de NIO 100"), "9");
    await user.click(screen.getByRole("button", { name: "Cerrar caja" }));

    const resumen = await screen.findByRole("status");
    expect(resumen.textContent).toContain("Cierre registrado");
    expect(resumen.textContent).toContain("Contado");
    expect(resumen.textContent).toContain("esperado");
    expect(resumen.textContent).toContain("NIO");
  });

  it("si el servidor rechaza el cierre, lo dice y no muestra un arqueo inventado", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.startsWith("/api/admin/pos/shift?") && init?.method !== "POST") {
        return jsonResponse({
          data: { id: "shift_1", openedAt: "2026-09-15T14:00:00.000Z", openingAmount: 1000 },
        });
      }
      if (url === "/api/admin/pos/shift/close") {
        return jsonResponse(
          { error: { message: "No hay una caja abierta en este local." } },
          409,
        );
      }
      return jsonResponse({ data: null });
    });

    render(<CashDrawerPanel locations={locations} />);
    expect(await screen.findByText(/Caja abierta desde/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Cerrar caja" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "No hay una caja abierta en este local.",
    );
    expect(screen.queryByText(/Caja cerrada/)).toBeNull();
  });
});
