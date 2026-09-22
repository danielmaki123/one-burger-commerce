// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CashMovementSheet from "./cash-movement-sheet";

/**
 * Fase 5 del rediseño de Caja (2026-09-23) — el **movimiento de caja en una hoja**, con una fila por moneda.
 *
 * Qué cambia: el alta era un formulario con **una** moneda a la vez. Cuando el local trabaja córdobas y
 * dólares, sacar plata de los dos cajones eran dos altas y dos motivos. Ahora la hoja pide el motivo una vez
 * y muestra una fila por moneda: cada fila con monto se registra como el movimiento de esa moneda.
 *
 * Lo que fijan estos casos: la hoja manda **una fila por moneda con monto** (las vacías no viajan), el motivo
 * es obligatorio, y si una de las dos falla se dice **cuál** entró y cuál no (a diferencia de un "error" que
 * deja al cajero sin saber si la plata se movió).
 */

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("CashMovementSheet", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(() => jsonResponse({ data: { id: "mov_1" } }, 201));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  /**
   * La hoja se lleva el foco al abrir con un `requestAnimationFrame` (contrato del primitivo
   * `AdminEditSheet`): si el test empieza a tipear antes de ese frame, el foco le roba las teclas al campo
   * y el monto queda vacío. Se espera un frame (y un tick) antes de tocar el formulario.
   */
  async function setup(overrides: Partial<React.ComponentProps<typeof CashMovementSheet>> = {}) {
    const onRegistered = vi.fn();
    const onClose = vi.fn();

    render(
      <CashMovementSheet
        open
        shiftId="shift_1"
        currencies={["NIO", "USD"]}
        onRegistered={onRegistered}
        onClose={onClose}
        {...overrides}
      />,
    );

    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

    return { onRegistered, onClose };
  }

  function movementBodies() {
    return fetchMock.mock.calls
      .filter(([, init]) => (init as RequestInit)?.method === "POST")
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)));
  }

  it("muestra una fila por moneda del local", async () => {
    await setup();

    expect(screen.getByRole("dialog", { name: "Movimiento de caja" })).toBeTruthy();
    expect(screen.getByLabelText("Monto en NIO")).toBeTruthy();
    expect(screen.getByLabelText("Monto en USD")).toBeTruthy();
  });

  it("registra un movimiento por moneda con monto, con el motivo compartido", async () => {
    const user = userEvent.setup();
    const { onRegistered } = await setup();

    await user.selectOptions(screen.getByLabelText("Tipo"), "withdrawal");
    await user.type(screen.getByLabelText("Monto en NIO"), "500");
    await user.type(screen.getByLabelText("Monto en USD"), "20");
    await user.type(screen.getByLabelText("Por qué"), "Retiro para el proveedor");
    await user.click(screen.getByRole("button", { name: "Registrar movimiento" }));

    await waitFor(() => expect(onRegistered).toHaveBeenCalled());

    expect(movementBodies()).toEqual([
      {
        kind: "withdrawal",
        category: "supplier",
        amount: 500,
        currency: "NIO",
        reason: "Retiro para el proveedor",
      },
      {
        kind: "withdrawal",
        category: "supplier",
        amount: 20,
        currency: "USD",
        reason: "Retiro para el proveedor",
      },
    ]);
  });

  it("una fila vacía no viaja: la moneda que no se tocó no registra nada", async () => {
    const user = userEvent.setup();
    await setup();

    await user.type(screen.getByLabelText("Monto en USD"), "35");
    await user.type(screen.getByLabelText("Por qué"), "Cambio de dólares");
    await user.click(screen.getByRole("button", { name: "Registrar movimiento" }));

    await waitFor(() => expect(movementBodies()).toHaveLength(1));
    expect(movementBodies()[0]).toMatchObject({ amount: 35, currency: "USD" });
  });

  it("sin motivo no se registra: un movimiento sin porqué no se audita", async () => {
    const user = userEvent.setup();
    await setup();

    await user.type(screen.getByLabelText("Monto en NIO"), "500");

    expect(screen.getByRole("button", { name: "Registrar movimiento" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("si una moneda falla, dice cuál entró y cuál no", async () => {
    // Dos altas no son una transacción: la que entró quedó registrada y el cajero tiene que saberlo.
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String((init as RequestInit).body)) as { currency: string };

      return body.currency === "USD"
        ? jsonResponse({ error: { message: "No se pudo registrar el movimiento." } }, 500)
        : jsonResponse({ data: { id: "mov_1" } }, 201);
    });

    const user = userEvent.setup();
    const { onRegistered } = await setup();

    await user.type(screen.getByLabelText("Monto en NIO"), "500");
    await user.type(screen.getByLabelText("Monto en USD"), "20");
    await user.type(screen.getByLabelText("Por qué"), "Retiro para el proveedor");
    await user.click(screen.getByRole("button", { name: "Registrar movimiento" }));

    const alert = await screen.findByRole("alert");

    expect(alert.textContent).toContain("NIO");
    expect(alert.textContent).toContain("USD");
    expect(alert.textContent).toMatch(/no se registr/i);
    // Lo que sí entró refresca el historial: la pantalla no puede quedarse con un estado viejo.
    expect(onRegistered).toHaveBeenCalled();
  });
});
