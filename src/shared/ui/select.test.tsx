// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Select } from "./select";

/**
 * TASK-206 — el primitivo que faltaba.
 *
 * TASK-201 midió **31 `<select>` crudos** en la app y `SELECT_CLASS` redefinido en 8 archivos, con
 * la indicación de copiarlo idéntico. Este test fija lo que el primitivo tiene que garantizar para
 * que esas copias puedan desaparecer: etiqueta asociada (es lo que usan los tests y los lectores de
 * pantalla), error anunciado con `aria-describedby`, y un `<select>` **nativo** (de eso dependen
 * `selectOption` de Playwright y el teclado del celular).
 */

const opciones = [
  { value: "percentage", label: "Porcentaje" },
  { value: "bogo", label: "Por cantidad" },
];

afterEach(cleanup);

describe("Select", () => {
  it("asocia la etiqueta al control y renderiza las opciones", () => {
    render(<Select label="Tipo" options={opciones} />);

    const select = screen.getByLabelText("Tipo");

    expect(select.tagName).toBe("SELECT");
    expect(screen.getByRole("option", { name: "Porcentaje" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Por cantidad" })).toBeTruthy();
  });

  it("usa un id propio cuando no se le pasa uno, sin pisar el de otro Select", () => {
    render(
      <>
        <Select label="Tipo" options={opciones} />
        <Select label="Estado" options={opciones} />
      </>,
    );

    const tipo = screen.getByLabelText("Tipo") as HTMLSelectElement;
    const estado = screen.getByLabelText("Estado") as HTMLSelectElement;

    expect(tipo.id).not.toBe("");
    expect(tipo.id).not.toBe(estado.id);
  });

  it("avisa el error en el campo y lo anuncia", () => {
    render(<Select label="Tipo" options={opciones} error="Elegí un tipo" />);

    const select = screen.getByLabelText("Tipo");

    expect(select.getAttribute("aria-invalid")).toBe("true");
    const describedBy = select.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe("Elegí un tipo");
  });

  it("entrega el valor elegido y no un evento raro", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<Select label="Tipo" options={opciones} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText("Tipo"), "bogo");

    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0][0].target as HTMLSelectElement).value).toBe("bogo");
  });

  it("permite una opción vacía con su texto, para los campos opcionales", () => {
    render(
      <Select
        label="¿A qué alcanza?"
        placeholder="Elegí una opción"
        options={opciones}
      />,
    );

    expect(screen.getByRole("option", { name: "Elegí una opción" })).toBeTruthy();
    expect((screen.getByLabelText("¿A qué alcanza?") as HTMLSelectElement).value).toBe("");
  });
});
