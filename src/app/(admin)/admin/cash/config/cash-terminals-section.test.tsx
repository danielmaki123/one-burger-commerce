// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CashTerminalsSection from "./cash-terminals-section";

/**
 * Fase 6 del rediseño de Caja (2026-09-23) — la sección **Terminales** de Config de Caja.
 *
 * Lo que fijan estos casos: se edita **una sucursal por vez** (las terminales son del local), el guardado
 * manda el estado completo de esa sucursal, una terminal sin nombre se apaga (no se borra) y una nueva nace
 * con su `id` (el servidor hace `upsert` por id).
 */

const locations = [
  { id: "loc_principal", name: "Camino de Oriente" },
  { id: "loc_masaya", name: "Carretera Masaya" },
];

const terminals = [
  { id: "term_caja_1", locationId: "loc_principal", label: "Caja 1", isActive: true, sortOrder: 0 },
  { id: "term_barra", locationId: "loc_principal", label: "Barra", isActive: true, sortOrder: 1 },
  {
    id: "term_masaya",
    locationId: "loc_masaya",
    label: "Caja única",
    isActive: true,
    sortOrder: 0,
  },
];

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response);
}

describe("CashTerminalsSection", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/admin/cash/terminals" && init?.method === "PUT") {
        const body = JSON.parse(String(init.body)) as {
          locationId: string;
          terminals: typeof terminals;
        };

        return jsonResponse({
          data: {
            terminals: body.terminals.map((terminal) => ({
              ...terminal,
              locationId: body.locationId,
            })),
          },
        });
      }

      return jsonResponse({ data: { terminals } });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("muestra las terminales de la sucursal elegida", () => {
    render(<CashTerminalsSection locations={locations} initialTerminals={terminals} />);

    expect(screen.getByRole("region", { name: "Terminales" })).toBeTruthy();
    expect(screen.getByDisplayValue("Caja 1")).toBeTruthy();
    expect(screen.getByDisplayValue("Barra")).toBeTruthy();
    // La de la otra sucursal no se mezcla: las terminales son del local.
    expect(screen.queryByDisplayValue("Caja única")).toBeNull();

    cleanup();
    render(<CashTerminalsSection locations={locations} initialTerminals={terminals} />);
  });

  it("una sucursal sin terminales lo dice y no inventa una", async () => {
    const user = userEvent.setup();

    // Solo la primera sucursal tiene terminales cargadas: la otra arranca vacía.
    render(
      <CashTerminalsSection
        locations={locations}
        initialTerminals={[terminals[0]!, terminals[1]!]}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Sucursal"), "loc_masaya");

    expect(screen.getByText(/todavía no tiene terminales/)).toBeTruthy();
  });

  it("agregar una terminal y guardar manda la lista completa de la sucursal", async () => {
    const user = userEvent.setup();
    render(<CashTerminalsSection locations={locations} initialTerminals={terminals} />);

    await user.click(screen.getByRole("button", { name: "Agregar terminal" }));
    await user.type(screen.getByLabelText("Nombre de la terminal 3"), "Kiosco");
    await user.click(screen.getByRole("button", { name: "Guardar terminales" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const put = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "PUT");
    const body = JSON.parse(String((put?.[1] as RequestInit).body)) as {
      locationId: string;
      terminals: { id: string; label: string }[];
    };

    expect(body.locationId).toBe("loc_principal");
    expect(body.terminals.map((terminal) => terminal.label)).toEqual(["Caja 1", "Barra", "Kiosco"]);
    // La nueva nace con id (el servidor guarda por id).
    expect(body.terminals[2]?.id).toMatch(/^term_/);
    expect(await screen.findByText("Terminales guardadas.")).toBeTruthy();
  });

  it("una terminal que se apaga viaja inactiva, no borrada", async () => {
    const user = userEvent.setup();
    render(<CashTerminalsSection locations={locations} initialTerminals={terminals} />);

    await user.click(screen.getByLabelText("Barra activa"));
    await user.click(screen.getByRole("button", { name: "Guardar terminales" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const put = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "PUT");
    const body = JSON.parse(String((put?.[1] as RequestInit).body)) as {
      terminals: { label: string; isActive: boolean }[];
    };

    expect(body.terminals.find((terminal) => terminal.label === "Barra")).toMatchObject({
      isActive: false,
    });
  });

  it("el error del servidor se muestra tal cual, sin inventar un mensaje", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) =>
      String(input) === "/api/admin/cash/terminals" && init?.method === "PUT"
        ? jsonResponse({ error: { message: "Revisá las terminales." } }, false, 422)
        : jsonResponse({ data: { terminals } }),
    );

    const user = userEvent.setup();
    render(<CashTerminalsSection locations={locations} initialTerminals={terminals} />);

    await user.click(screen.getByRole("button", { name: "Guardar terminales" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Revisá las terminales.",
    );
  });
});
