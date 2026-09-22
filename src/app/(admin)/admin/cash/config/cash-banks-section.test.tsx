// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CashBanksSection from "./cash-banks-section";

/**
 * Fase 3 del rediseño de Caja (2026-09-23) — la sección **Bancos** de Config de Caja.
 *
 * Lo que fijan estos casos es lo que el dueño hace: cargar los bancos con los que liquida, asignarlos a
 * cada sucursal, agregar uno nuevo y guardar. Un banco no se borra: se apaga (los cierres viejos dicen
 * contra qué banco se cuadró).
 */

const catalog = [
  {
    id: "bank_bac",
    name: "BAC Credomatic",
    code: "BAC",
    isActive: true,
    sortOrder: 0,
    locationIds: ["loc_principal"],
  },
];

const locations = [
  { id: "loc_principal", name: "Camino de Oriente" },
  { id: "loc_masaya", name: "Carretera Masaya" },
];

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

describe("CashBanksSection", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/admin/cash/banks" && init?.method === "PUT") {
        const body = JSON.parse(String(init.body)) as { banks: typeof catalog };
        return jsonResponse({ data: { banks: body.banks } });
      }
      return jsonResponse({ data: { banks: catalog } });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("muestra los bancos con su sucursal asignada", () => {
    render(<CashBanksSection locations={locations} initialBanks={catalog} />);

    expect(screen.getByRole("region", { name: "Bancos" })).toBeTruthy();
    expect(screen.getByDisplayValue("BAC Credomatic")).toBeTruthy();
    // Dos sucursales: la asignada y la que no. La del banco está marcada.
    const principal = screen.getByLabelText("BAC Credomatic en Camino de Oriente") as HTMLInputElement;
    const masaya = screen.getByLabelText("BAC Credomatic en Carretera Masaya") as HTMLInputElement;

    expect(principal.checked).toBe(true);
    expect(masaya.checked).toBe(false);
  });

  it("sin bancos cargados dice que el cierre no va a ofrecer ninguno", () => {
    render(<CashBanksSection locations={locations} initialBanks={[]} />);

    expect(screen.getByText(/todavía no hay bancos cargados/i)).toBeTruthy();
  });

  it("agregar un banco y guardar manda el catálogo completo", async () => {
    const user = userEvent.setup();
    render(<CashBanksSection locations={locations} initialBanks={catalog} />);

    await user.click(screen.getByRole("button", { name: "Agregar banco" }));
    await user.type(screen.getByLabelText("Nombre del banco 2"), "Banpro");
    await user.click(screen.getByLabelText("Banpro en Carretera Masaya"));
    await user.click(screen.getByRole("button", { name: "Guardar bancos" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const put = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "PUT");
    const body = JSON.parse(String((put?.[1] as RequestInit).body)) as {
      banks: { id: string; name: string; locationIds: string[] }[];
    };

    expect(body.banks).toHaveLength(2);
    expect(body.banks[1]).toMatchObject({ name: "Banpro", locationIds: ["loc_masaya"] });
  });

  it("apagar un banco lo manda inactivo, no lo borra", async () => {
    const user = userEvent.setup();
    render(<CashBanksSection locations={locations} initialBanks={catalog} />);

    await user.click(screen.getByLabelText("BAC Credomatic activo"));
    await user.click(screen.getByRole("button", { name: "Guardar bancos" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const put = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "PUT");
    const body = JSON.parse(String((put?.[1] as RequestInit).body)) as {
      banks: { id: string; isActive: boolean }[];
    };

    expect(body.banks[0]).toMatchObject({ id: "bank_bac", isActive: false });
  });

  it("el error del servidor se muestra tal cual, sin inventar un mensaje", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/admin/cash/banks" && init?.method === "PUT") {
        return jsonResponse(
          { error: { message: "Revisá el catálogo de bancos." } },
          false,
          422,
        );
      }
      return jsonResponse({ data: { banks: catalog } });
    });

    const user = userEvent.setup();
    render(<CashBanksSection locations={locations} initialBanks={catalog} />);

    await user.click(screen.getByRole("button", { name: "Guardar bancos" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Revisá el catálogo de bancos.",
    );
  });
});
