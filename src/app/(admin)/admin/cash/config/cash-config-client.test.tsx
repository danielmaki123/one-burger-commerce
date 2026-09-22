// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CashConfigClient from "./cash-config-client";

/**
 * Fase 2 del rediseño de Caja (2026-09-22) — **Config de Caja**, la pantalla real.
 *
 * Lo que fijan estos casos es lo que el dueño hace: ver la config de una sucursal, prender los dólares,
 * apagar el arqueo ciego, apagar un billete, agregar uno nuevo y guardar. El billete **no se borra**: se
 * manda inactivo (los cierres viejos guardan con qué se contó).
 */

const denominations = [
  { currency: "NIO", value: 1000, isActive: true, sortOrder: 0 },
  { currency: "NIO", value: 500, isActive: true, sortOrder: 1 },
  { currency: "USD", value: 20, isActive: true, sortOrder: 0 },
];

const config = {
  locationId: "loc_principal",
  usdEnabled: false,
  blindCount: true,
  updatedAt: "2026-09-22T15:00:00.000Z",
  updatedByUserId: "user_owner",
  denominations,
};

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

const locations = [
  { id: "loc_principal", name: "Principal" },
  { id: "loc_norte", name: "Norte" },
];

describe("CashConfigClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("/api/admin/cash/config?") && !init?.method) {
        return jsonResponse({ data: config });
      }
      if (String(input) === "/api/admin/cash/config" && init?.method === "PUT") {
        return jsonResponse({ data: config });
      }
      return jsonResponse({ data: null });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("muestra los billetes de la config y los dos flags", () => {
    render(<CashConfigClient locations={locations} initialConfig={config} />);

    expect(screen.getByLabelText("Esta sucursal cuenta dólares")).toBeTruthy();
    expect(screen.getByLabelText(/Arqueo ciego/)).toBeTruthy();
    expect(screen.getByLabelText("1000")).toBeTruthy();
    expect(screen.getByLabelText("500")).toBeTruthy();
    expect(screen.getByLabelText("20")).toBeTruthy();
  });

  it("guardar manda los flags y los billetes con su estado", async () => {
    const user = userEvent.setup();
    render(<CashConfigClient locations={locations} initialConfig={config} />);

    await user.click(screen.getByLabelText("Esta sucursal cuenta dólares"));
    await user.click(screen.getByLabelText("500"));
    await user.click(screen.getByRole("button", { name: "Guardar configuración" }));

    const put = fetchMock.mock.calls.find(
      ([input, init]) => String(input) === "/api/admin/cash/config" && (init as RequestInit)?.method === "PUT",
    );
    expect(put).toBeTruthy();

    const body = JSON.parse(String((put![1] as RequestInit).body));
    expect(body).toMatchObject({ locationId: "loc_principal", usdEnabled: true, blindCount: true });
    expect(body.denominations).toEqual([
      { currency: "NIO", value: 1000, isActive: true },
      { currency: "NIO", value: 500, isActive: false },
      { currency: "USD", value: 20, isActive: true },
    ]);

    expect(await screen.findByText("Configuración guardada.")).toBeTruthy();
  });

  it("agrega un billete nuevo a la moneda que corresponde", async () => {
    const user = userEvent.setup();
    render(<CashConfigClient locations={locations} initialConfig={config} />);

    await user.type(screen.getByLabelText("Agregar billete de NIO"), "200");
    await user.click(screen.getAllByRole("button", { name: "Agregar" })[0]);
    await user.click(screen.getByRole("button", { name: "Guardar configuración" }));

    const put = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit)?.method === "PUT",
    );
    const body = JSON.parse(String((put![1] as RequestInit).body));

    expect(body.denominations).toContainEqual({ currency: "NIO", value: 200, isActive: true });
  });

  it("no deja agregar el mismo billete dos veces", async () => {
    const user = userEvent.setup();
    render(<CashConfigClient locations={locations} initialConfig={config} />);

    await user.type(screen.getByLabelText("Agregar billete de NIO"), "1000");
    await user.click(screen.getAllByRole("button", { name: "Agregar" })[0]);

    expect(screen.getByRole("alert").textContent).toContain("ya está en la lista");
  });

  it("cambiar de sucursal vuelve a pedir la config de esa sucursal", async () => {
    const user = userEvent.setup();
    render(<CashConfigClient locations={locations} initialConfig={config} />);

    await user.selectOptions(screen.getByLabelText("Sucursal"), "loc_norte");

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("locationId=loc_norte"),
        ),
      ).toBe(true),
    );
  });

  it("un rechazo del servidor se muestra con el motivo", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/admin/cash/config" && init?.method === "PUT") {
        return jsonResponse(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Revisá la configuración de la caja.",
              fields: { denominations: "Dejá al menos un billete activo" },
            },
          },
          false,
          422,
        );
      }
      return jsonResponse({ data: config });
    });

    render(<CashConfigClient locations={locations} initialConfig={config} />);

    await user.click(screen.getByRole("button", { name: "Guardar configuración" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Dejá al menos un billete activo");
  });
});
