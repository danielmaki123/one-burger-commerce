// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HelpText } from "./help-text";

afterEach(cleanup);

describe("HelpText", () => {
  it("se registra con el id que el control va a citar en aria-describedby", () => {
    render(<HelpText id="slug">Se guarda en minúsculas y con guiones.</HelpText>);

    expect(screen.getByRole("note").id).toBe("slug-help");
    expect(screen.getByRole("note").textContent).toBe("Se guarda en minúsculas y con guiones.");
  });

  it("no es una alerta: no interrumpe, solo se puede recorrer", () => {
    render(<HelpText id="slug">Texto de ayuda</HelpText>);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("note")).toBeTruthy();
  });

  it("el tono de error sale del token, no de una paleta cruda", () => {
    render(
      <HelpText id="slug" tone="error">
        Solo minúsculas
      </HelpText>,
    );

    const classes = screen.getByRole("note").className;

    expect(classes).toContain("text-danger-strong");
    expect(classes).not.toContain("red-");
  });
});
