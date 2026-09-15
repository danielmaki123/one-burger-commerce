// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Toast } from "./toast";

afterEach(cleanup);

describe("Toast", () => {
  it("el éxito se anuncia sin interrumpir", () => {
    render(<Toast tone="success" message="Local borrado." />);

    expect(screen.getByRole("status").textContent).toContain("Local borrado.");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("el error corta: se anuncia como alerta", () => {
    render(<Toast tone="error" message="No se pudo borrar el local." />);

    expect(screen.getByRole("alert").textContent).toContain("No se pudo borrar el local.");
  });

  it("los cuatro tonos salen de tokens, no de paleta cruda", () => {
    const { container } = render(
      <>
        <Toast tone="success" message="ok" />
        <Toast tone="error" message="error" />
        <Toast tone="warning" message="aviso" />
        <Toast tone="info" message="info" />
      </>,
    );

    const classes = [...container.querySelectorAll("div")].map((node) => node.className).join(" ");

    expect(classes).toContain("bg-success");
    expect(classes).toContain("bg-danger");
    expect(classes).toContain("bg-warning");
    expect(classes).not.toMatch(/(red|green|amber|emerald|stone)-\d/);
  });

  it("sin onDismiss no dibuja el cierre; con onDismiss, el botón cierra", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();

    const { rerender } = render(<Toast tone="success" message="ok" />);
    expect(screen.queryByRole("button")).toBeNull();

    rerender(<Toast tone="success" message="ok" onDismiss={onDismiss} />);
    await user.click(screen.getByRole("button", { name: "Cerrar el aviso" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
