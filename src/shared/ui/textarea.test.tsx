// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Textarea } from "./textarea";

afterEach(cleanup);

describe("Textarea", () => {
  it("asocia la etiqueta al control por htmlFor", () => {
    render(<Textarea label="Notas para retiro" />);

    const field = screen.getByLabelText("Notas para retiro");
    const label = screen.getByText("Notas para retiro");

    expect(field.tagName).toBe("TEXTAREA");
    expect(label.getAttribute("for")).toBe(field.id);
    expect(field.id).toBeTruthy();
  });

  it("el error se anuncia con aria-describedby y sale del token de peligro", () => {
    render(<Textarea label="Motivo" error="Contá el motivo en una línea" />);

    const field = screen.getByLabelText("Motivo");
    const describedBy = field.getAttribute("aria-describedby") ?? "";

    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(describedBy)?.textContent).toBe("Contá el motivo en una línea");
    // Cambió el contrato (2026-09-16): el error sale del token de peligro **del sistema Stitch**
    // (`--status-sla-text`), no del alias viejo `--danger-strong`. Además ahora se anuncia solo
    // (`role="alert"`), que es lo que el sistema pide para cualquier error de campo.
    expect(document.getElementById(describedBy)?.className).toContain("text-status-sla-text");
    expect(document.getElementById(describedBy)?.getAttribute("role")).toBe("alert");
  });

  it("la ayuda y el error viajan juntos en aria-describedby", () => {
    render(
      <Textarea
        label="Referencia"
        description="Cómo llegar al local"
        error="Máximo 200 caracteres"
      />,
    );

    const field = screen.getByLabelText("Referencia");
    const ids = (field.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);

    expect(ids).toHaveLength(2);
    expect(ids.map((id) => document.getElementById(id)?.textContent)).toEqual([
      "Cómo llegar al local",
      "Máximo 200 caracteres",
    ]);
  });

  it("respeta el alto mínimo cómodo para el celular", () => {
    render(<Textarea label="Notas" />);

    expect(screen.getByLabelText("Notas").className).toContain("min-h-24");
  });
});
