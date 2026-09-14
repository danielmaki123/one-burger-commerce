// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "./button";

/**
 * TASK-206 — el tamaño `pill` del botón.
 *
 * Acá la clase **es** el contrato: el chip de filtro necesita `rounded-full` y no puede ganarlo desde
 * `className`, porque `rounded-md` (la base de los otros tamaños) se emite después en el CSS de
 * Tailwind y gana la cascada. El test fija que el tamaño traiga el radio correcto y que los otros
 * tamaños sigan con el suyo.
 */

afterEach(cleanup);

describe("Button", () => {
  it("el tamaño pill trae la pastilla y el mínimo táctil, sin el radio de la base", () => {
    render(
      <Button size="pill" variant="secondary">
        Todas
      </Button>,
    );

    const classes = screen.getByRole("button", { name: "Todas" }).className;

    expect(classes).toContain("rounded-full");
    expect(classes).toContain("min-h-11");
    expect(classes).not.toContain("rounded-md");
  });

  it("los tamaños de acción siguen con el radio de la base", () => {
    render(<Button size="md">Guardar</Button>);

    const classes = screen.getByRole("button", { name: "Guardar" }).className;

    expect(classes).toContain("rounded-md");
    expect(classes).not.toContain("rounded-full");
  });

  it("deja pasar el estado de presión y el click, que es lo que usa un chip de filtro", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Button size="pill" aria-pressed onClick={onClick}>
        Activas
      </Button>,
    );

    const chip = screen.getByRole("button", { name: "Activas", pressed: true });
    await user.click(chip);

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
