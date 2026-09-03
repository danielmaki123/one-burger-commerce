// @vitest-environment jsdom

import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminEditSheet from "./admin-edit-sheet";

function EditSheetHarness() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  // Reproduce the consumers: this callback changes identity after each input update.
  const closeSheet = () => setOpen(false);

  return (
    <main data-admin-background data-testid="admin-background">
      <button type="button" onClick={() => setOpen(true)}>
        Abrir editor
      </button>
      <AdminEditSheet open={open} onClose={closeSheet} title="Editar">
        <label>
          Nombre
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
      </AdminEditSheet>
    </main>
  );
}

describe("AdminEditSheet", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps the input focused while entering consecutive characters", async () => {
    const user = userEvent.setup();
    render(<EditSheetHarness />);

    await user.click(screen.getByRole("button", { name: "Abrir editor" }));
    const input = screen.getByRole("textbox", { name: "Nombre" });

    expect(screen.getByTestId("admin-background").getAttribute("aria-hidden")).toBe("true");
    expect(input.closest("[data-admin-background]")).toBeNull();

    await user.click(input);
    await user.type(input, "AB");

    expect(input).toHaveProperty("value", "AB");
    expect(document.activeElement).toBe(input);
  });
});
