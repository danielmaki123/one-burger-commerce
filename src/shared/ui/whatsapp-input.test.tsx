// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WhatsAppInput } from "./whatsapp-input";

/**
 * Fase 6 del checkout — el país del negocio no puede estar en el código.
 *
 * El prefijo sale del teléfono configurado. Sin teléfono **no se asume ninguno**: el campo
 * arranca en "Otro" pidiendo el prefijo internacional, en vez de proponer Nicaragua.
 */
function renderInput(defaultPrefix: string | null) {
  render(
    <WhatsAppInput value="" onChange={vi.fn()} defaultPrefix={defaultPrefix} />,
  );

  return {
    prefixSelect: screen.getByLabelText("Prefijo WhatsApp") as HTMLSelectElement,
  };
}

describe("WhatsAppInput", () => {
  afterEach(cleanup);

  it("con teléfono del negocio propone su prefijo y no pide nada más", () => {
    const { prefixSelect } = renderInput("+506");

    expect(prefixSelect.value).toBe("+506");
    expect(screen.queryByLabelText("Prefijo manual")).toBeNull();
  });

  it("sin teléfono configurado no inventa un país: arranca en Otro", () => {
    const { prefixSelect } = renderInput(null);

    expect(prefixSelect.value).toBe("OTHER");
    expect(screen.getByLabelText("Prefijo manual")).toBeTruthy();
  });

  it("la ayuda no nombra ningún país", () => {
    renderInput("+506");

    expect(screen.getByText(/prefijo internacional/)).toBeTruthy();
    expect(screen.queryByText(/Nicaragua/)).toBeNull();
  });
});
