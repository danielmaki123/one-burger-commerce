// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminUsersPage from "./users-client";

const owner = {
  id: "user_1",
  name: "Daniel",
  email: "owner@oneburger.local",
  role: "owner",
  locationIds: [],
};

const kitchen = {
  id: "user_2",
  name: "Cocina",
  email: "cocina@oneburger.local",
  role: "kitchen",
  locationIds: [],
};

const LOCATIONS = [
  { id: "loc_norte", name: "Norte", isActive: true },
  { id: "loc_sur", name: "Sur", isActive: true },
];

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
  } as Response);
}

describe("AdminUsersPage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  function stubFetch({
    users = [owner, kitchen],
    locations = LOCATIONS,
  }: { users?: unknown[]; locations?: unknown[] } = {}) {
    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);

      if (url === "/api/admin/locations" && !init?.method) {
        return jsonResponse({ data: locations });
      }

      if (url === "/api/admin/users" && !init?.method) {
        return jsonResponse({ data: users });
      }

      if (url === "/api/admin/users" && init?.method === "POST") {
        return jsonResponse({ data: { id: "user_9" } });
      }

      if (init?.method === "PATCH") {
        return jsonResponse({ data: { ...kitchen, role: "manager" } });
      }

      if (init?.method === "DELETE") {
        return jsonResponse({ data: { id: kitchen.id } });
      }

      return jsonResponse({ data: null });
    });

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn(() => true));
  }

  beforeEach(() => {
    stubFetch();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows a role selector and a revoke action per user", async () => {
    render(<AdminUsersPage />);

    expect(
      await screen.findByRole("combobox", { name: "Rol de Daniel" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Revocar acceso de Cocina" }),
    ).toBeTruthy();
  });

  it("sends a PATCH when the role changes", async () => {
    const user = userEvent.setup();
    render(<AdminUsersPage />);

    const selector = await screen.findByRole("combobox", {
      name: "Rol de Cocina",
    });
    await user.selectOptions(selector, "manager");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/users/user_2",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ role: "manager" }),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Rol actualizado.")).toBeTruthy();
    });
  });

  it("asks for confirmation and revokes access", async () => {
    const user = userEvent.setup();
    render(<AdminUsersPage />);

    const revokeButton = await screen.findByRole("button", {
      name: "Revocar acceso de Cocina",
    });
    await user.click(revokeButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/users/user_2",
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Revocar acceso de Cocina" }),
      ).toBeNull();
    });
  });

  it("keeps the user in the list when the revoke fails", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);

      if (url === "/api/admin/locations") {
        return jsonResponse({ data: LOCATIONS });
      }

      if (init?.method === "DELETE") {
        return jsonResponse(
          { error: { code: "BAD_REQUEST", message: "At least one owner must remain" } },
          false,
        );
      }

      if (init?.method === "PATCH") {
        return jsonResponse({ data: kitchen });
      }

      return jsonResponse({ data: [owner, kitchen] });
    });

    render(<AdminUsersPage />);

    await user.click(
      await screen.findByRole("button", { name: "Revocar acceso de Cocina" }),
    );

    await waitFor(() => {
      expect(screen.getByText("At least one owner must remain")).toBeTruthy();
    });
    expect(
      screen.getByRole("button", { name: "Revocar acceso de Cocina" }),
    ).toBeTruthy();
  });

  it("never offers revoke on the signed-in owner row without a selector change", async () => {
    render(<AdminUsersPage />);

    const row = (await screen.findByText("owner@oneburger.local")).closest("article");

    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByRole("combobox")).toBeTruthy();
  });

  /**
   * A — las sucursales de cada usuario.
   *
   * El owner ve todas (su asignación se ignora); un gerente o cocina sin asignar también ve todas,
   * y el admin lo dice con todas las letras. El control de asignación **no se dibuja con una sola
   * sucursal**: con un solo local, "asignada" y "sin asignar" son lo mismo, así que sería un
   * control decorativo.
   */
  it("al crear, manda las sucursales elegidas", async () => {
    const user = userEvent.setup();
    render(<AdminUsersPage />);

    const branchSelector = await screen.findByRole("group", {
      name: "Sucursales asignadas",
    });
    await user.click(within(branchSelector).getByRole("checkbox", { name: "Norte" }));

    await user.type(screen.getByLabelText("Nombre"), "Cocina Norte");
    await user.type(screen.getByLabelText("Correo"), "norte@oneburger.local");
    await user.type(screen.getByLabelText("Contraseña temporal"), "Admin1234!");
    await user.click(screen.getByRole("button", { name: "Crear usuario" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/users",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            name: "Cocina Norte",
            email: "norte@oneburger.local",
            password: "Admin1234!",
            role: "kitchen",
            locationIds: ["loc_norte"],
          }),
        }),
      );
    });
  });

  it("con una sola sucursal no dibuja el selector de asignación", async () => {
    stubFetch({ locations: [LOCATIONS[0]] });
    render(<AdminUsersPage />);

    await screen.findByText("owner@oneburger.local");

    expect(screen.queryByRole("group", { name: "Sucursales asignadas" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Sucursales de Cocina" })).toBeNull();
  });

  it("muestra las sucursales de cada usuario y quién ve todas", async () => {
    stubFetch({ users: [owner, { ...kitchen, locationIds: ["loc_norte"] }] });
    render(<AdminUsersPage />);

    const row = (await screen.findByText("cocina@oneburger.local")).closest("article");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("Asignado a: Norte")).toBeTruthy();

    // El owner ve todas por rol, y se dice explícito.
    expect(screen.getByText("Ve todas las sucursales")).toBeTruthy();
  });

  it("muestra 'sin asignar · ve todas' cuando el usuario no tiene sucursales", async () => {
    render(<AdminUsersPage />);

    expect(await screen.findByText("Sin asignar · ve todas")).toBeTruthy();
  });

  it("cambia las sucursales de un usuario existente", async () => {
    const user = userEvent.setup();
    render(<AdminUsersPage />);

    const branchSelector = await screen.findByRole("group", {
      name: "Sucursales de Cocina",
    });
    await user.click(within(branchSelector).getByRole("checkbox", { name: "Sur" }));
    await user.click(
      within(branchSelector).getByRole("button", {
        name: "Guardar sucursales de Cocina",
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/users/user_2",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ locationIds: ["loc_sur"] }),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Sucursales actualizadas.")).toBeTruthy();
    });
  });

  it("avisa cuando no pudo cargar las sucursales, sin dibujar el selector", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);

      if (url === "/api/admin/locations") {
        return jsonResponse({ error: { message: "boom" } }, false);
      }

      if (url === "/api/admin/users" && !init?.method) {
        return jsonResponse({ data: [owner, kitchen] });
      }

      return jsonResponse({ data: null });
    });

    render(<AdminUsersPage />);

    expect(
      await screen.findByText("No se pudieron cargar las sucursales."),
    ).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Sucursales asignadas" })).toBeNull();
  });
});
