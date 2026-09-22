// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CashView from "./cash-view";

/**
 * Fase 1a del rediseño de Caja (2026-09-19) — **los cuatro estados de la pantalla**.
 *
 * Es el orquestador: un solo sujeto (el ciclo del turno) y el contenido que muta según el estado —
 * *cargando*, *error*, *sin turno* y *turno abierto*. Acá se fija A-44 de punta a punta: el error se ve,
 * se puede reintentar, y al reintentar con éxito la pantalla vuelve sola al estado que corresponde.
 */

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const OPEN_SHIFT = { id: "shift_1", openedAt: "2026-09-15T14:00:00.000Z", openingAmount: 1000 };
const locations = [{ id: "loc_norte", name: "Camino de Oriente" }];

describe("CashView", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(() => jsonResponse({ data: null }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("mientras lee muestra el esqueleto y después el estado sin turno", async () => {
    let release: ((value: Response) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );

    render(
      <CashView
        locations={locations}
        cashCountConfigs={{ loc_norte: { currencies: ["NIO"], denominations: { NIO: [1000, 500, 200, 100, 50, 20, 10, 5, 1] } } }}
        canSeeShiftDetail={false}
        canSeeCloseDetail={false}
        actorName={null}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain("Leyendo el estado de la caja");

    release?.(jsonResponse({ data: null }));

    await waitFor(() => expect(screen.getByText(/Sin caja abierta en este local/)).toBeTruthy());
  });

  it("si la lectura falla muestra el error y el reintento devuelve la pantalla al estado real", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ error: { message: "No se pudo leer el estado de la caja." } }, 500),
    );
    fetchMock.mockImplementationOnce(() => jsonResponse({ data: OPEN_SHIFT }));

    render(
      <CashView
        locations={locations}
        cashCountConfigs={{ loc_norte: { currencies: ["NIO"], denominations: { NIO: [1000, 500, 200, 100, 50, 20, 10, 5, 1] } } }}
        canSeeShiftDetail
        canSeeCloseDetail
        actorName={null}
      />,
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      "No se pudo leer el estado de la caja.",
    );

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText(/Caja abierta desde/)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("con turno abierto muestra el turno y sus acciones", async () => {
    fetchMock.mockImplementation(() => jsonResponse({ data: OPEN_SHIFT }));

    render(
      <CashView
        locations={locations}
        cashCountConfigs={{ loc_norte: { currencies: ["NIO"], denominations: { NIO: [1000, 500, 200, 100, 50, 20, 10, 5, 1] } } }}
        canSeeShiftDetail={false}
        canSeeCloseDetail={false}
        actorName={null}
      />,
    );

    expect(await screen.findByText(/Caja abierta desde/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cerrar caja" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Lectura parcial y traspaso" })).toBeTruthy();
  });

  it("sin turno abierto ofrece la apertura", async () => {
    render(
      <CashView
        locations={locations}
        cashCountConfigs={{ loc_norte: { currencies: ["NIO"], denominations: { NIO: [1000, 500, 200, 100, 50, 20, 10, 5, 1] } } }}
        canSeeShiftDetail={false}
        canSeeCloseDetail={false}
        actorName={null}
      />,
    );

    expect(await screen.findByRole("button", { name: "Abrir caja" })).toBeTruthy();
  });

  it("con más de una sucursal, cambiar de local vuelve a pedir el estado del turno y cambia la grilla", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() => jsonResponse({ data: null }));

    render(
      <CashView
        locations={[
          { id: "loc_norte", name: "Camino de Oriente" },
          { id: "loc_sur", name: "Carretera Masaya" },
        ]}
        cashCountConfigs={{
          loc_norte: { currencies: ["NIO"], denominations: { NIO: [1000, 500] } },
          loc_sur: { currencies: ["NIO", "USD"], denominations: { NIO: [1000], USD: [20] } },
        }}
        canSeeShiftDetail={false}
        canSeeCloseDetail={false}
        actorName={null}
      />,
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/pos/shift?locationId=loc_norte",
        expect.objectContaining({ cache: "no-store" }),
      ),
    );

    // La sucursal sin dólares no ofrece el conteo en dólares (Fase 2).
    await screen.findByLabelText("Cantidad de billetes de NIO 1000");
    expect(screen.queryByLabelText("Cantidad de billetes de USD 20")).toBeNull();

    await user.selectOptions(screen.getByLabelText("Local"), "loc_sur");

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/pos/shift?locationId=loc_sur",
        expect.objectContaining({ cache: "no-store" }),
      ),
    );

    // Y la que sí los maneja, los muestra: la grilla sigue a la config del local elegido.
    expect(await screen.findByLabelText("Cantidad de billetes de USD 20")).toBeTruthy();
  });
});
