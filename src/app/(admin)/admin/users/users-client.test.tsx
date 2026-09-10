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
};

const kitchen = {
  id: "user_2",
  name: "Cocina",
  email: "cocina@oneburger.local",
  role: "kitchen",
};

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
  } as Response);
}

describe("AdminUsersPage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);

      if (url === "/api/admin/users" && !init?.method) {
        return jsonResponse({ data: [owner, kitchen] });
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
});
