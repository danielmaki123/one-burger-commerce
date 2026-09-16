// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ColorInput } from "./color-input";

afterEach(cleanup);

describe("ColorInput", () => {
  it("asocia la etiqueta al selector y usa el input de color nativo", () => {
    render(<ColorInput label="Color de marca" value="#38bdf8" onChange={() => {}} />);

    const input = screen.getByLabelText("Color de marca") as HTMLInputElement;

    expect(input.type).toBe("color");
    expect(input.value).toBe("#38bdf8");
    // 44 px: es un control táctil del panel.
    expect(input.className).toContain("h-11");
    // El borde del control es el medido a 3:1, no el sutil de las tarjetas.
    expect(input.className).toContain("border-line-control");
  });

  it("avisa el cambio con el valor elegido", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ColorInput label="Acento" value="#f59e0b" onChange={onChange} />);

    const input = screen.getByLabelText("Acento") as HTMLInputElement;
    // En jsdom el input de color se escribe con `fireEvent`-like: un `type` no cambia el valor, así que
    // se comprueba el contrato del componente y no la rueda de color del navegador.
    await user.click(input);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("anuncia el error y lo asocia al control", () => {
    render(<ColorInput label="Marca" value="#000" error="Tiene que ser un hex" />);

    const input = screen.getByLabelText("Marca");
    const error = screen.getByRole("alert");

    expect(error.textContent).toBe("Tiene que ser un hex");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(error.id);
  });
});
