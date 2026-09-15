// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Toggle } from "./toggle";

afterEach(cleanup);

describe("Toggle", () => {
  it("se anuncia como interruptor con su estado", () => {
    render(<Toggle checked label="Cambiar disponibilidad de Taco" onChange={() => {}} />);

    const toggle = screen.getByRole("switch", { name: "Cambiar disponibilidad de Taco" });

    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  it("devuelve el estado contrario al actual, no el actual", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<Toggle checked={false} label="Cambiar disponibilidad" onChange={onChange} />);

    await user.click(screen.getByRole("switch"));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("lleva el mínimo táctil en el primitivo y el color de estado en los tokens", () => {
    render(<Toggle checked label="Cambiar disponibilidad" onChange={() => {}} />);

    const classes = screen.getByRole("switch").className;

    expect(classes).toContain("min-h-11");
    expect(classes).toContain("min-w-11");
    expect(classes).not.toContain("red-");
  });

  it("mientras guarda se deshabilita y muestra el giro en vez de la pastilla", () => {
    render(<Toggle checked label="Cambiar disponibilidad" onChange={() => {}} saving />);

    const toggle = screen.getByRole("switch");

    expect((toggle as HTMLButtonElement).disabled).toBe(true);
    expect(toggle.querySelector(".animate-spin")).toBeTruthy();
    expect(toggle.querySelector(".rounded-full")).toBeNull();
  });

  it("no dispara el cambio si el click no viene del control habilitado", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<Toggle checked label="Cambiar disponibilidad" onChange={onChange} disabled />);

    await user.click(screen.getByRole("switch"));

    expect(onChange).not.toHaveBeenCalled();
  });
});
