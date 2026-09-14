// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ComandaSessionBar } from "./comanda-session-bar";

/**
 * B6 — la salida de la vista de comandas.
 *
 * Esta vista esconde la barra lateral del panel (donde vive «Cerrar sesión»), así que la barra de
 * comandas tiene que ofrecer la salida ella misma. El bug que esto arregla lo encontró el owner en
 * producción: entró con una cuenta de **cocina**, tocó «Volver al panel» y volvió a la misma pantalla
 * —su rol no tiene Resumen, o sea que el enlace la mandaba en círculos— sin forma de cerrar sesión.
 */
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

const session = vi.hoisted(() => ({ payload: {} as unknown }));

beforeEach(() => {
  pushMock.mockClear();
  session.payload = {};
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (String(url).includes("/api/auth/admin/session")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => session.payload });
      }

      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function authenticated(role: string) {
  // La misma forma que devuelve la ruta real (`{ data: { user } }`), que es la que lee el shell.
  session.payload = {
    data: { user: { name: "Cocina Uno", email: "cocina@example.com", role } },
  };
}

describe("barra de sesión de las comandas (B6)", () => {
  it("dice quién está en la pantalla: en una tablet compartida eso importa", async () => {
    authenticated("kitchen");
    render(<ComandaSessionBar />);

    expect(await screen.findByText("Cocina Uno")).toBeTruthy();
    expect(screen.getByText(/cocina@example\.com/)).toBeTruthy();
  });

  it("una cuenta de cocina puede cerrar sesión (no tiene barra lateral)", async () => {
    const user = userEvent.setup();
    authenticated("kitchen");

    render(<ComandaSessionBar />);

    await user.click(await screen.findByRole("button", { name: "Cerrar sesión" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/auth/admin/logout", { method: "POST" });
      expect(pushMock).toHaveBeenCalledWith("/admin/login");
    });
  });

  it("a la cocina no le ofrece «Volver al panel»: su rol no tiene Resumen y el enlace la manda en círculos", async () => {
    authenticated("kitchen");
    render(<ComandaSessionBar />);

    await screen.findByText("Cocina Uno");
    expect(screen.queryByRole("link", { name: /Volver al panel/ })).toBeNull();
  });

  it("a un manager tampoco: su panel es Menú y Órdenes, no el Resumen", async () => {
    authenticated("manager");
    render(<ComandaSessionBar />);

    await screen.findByText("Cocina Uno");
    expect(screen.queryByRole("link", { name: /Volver al panel/ })).toBeNull();
  });

  it("el dueño sí: para él el panel es el Resumen", async () => {
    authenticated("owner");
    render(<ComandaSessionBar />);

    const link = await screen.findByRole("link", { name: /Volver al panel/ });
    expect(link.getAttribute("href")).toBe("/admin");
  });

  it("mientras no se sabe la sesión, no ofrece cerrar sesión a ciegas", () => {
    render(<ComandaSessionBar />);

    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();
  });
});

