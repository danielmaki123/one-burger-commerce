// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AdminPageHeader } from "./admin-operational-ui";

/**
 * A-43 — la **cabecera del panel** (2026-09-25).
 *
 * El componente estaba por encima del techo del sistema (≤20% del alto) en las pantallas con descripción
 * de dos líneas y acción propia: 186 px a 375×800 = 23,3%. Acá se fija lo que el componente tiene que
 * seguir teniendo (las tres piezas: título, descripción y acción) y la **escala compacta** del título en
 * celular, que es lo que baja el alto. El alto real lo mide el navegador
 * (`tests/e2e/admin-page-header-height.spec.ts`): en jsdom no hay layout.
 */

afterEach(cleanup);

describe("AdminPageHeader", () => {
  it("dibuja el rótulo, el título, la descripción y la acción", () => {
    render(
      <AdminPageHeader
        label="Control"
        title="Caja"
        description="Abrí y cerrá la caja del local."
        actions={<button type="button">Reporte del día</button>}
      />,
    );

    expect(screen.getByText("Control")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Caja" })).toBeTruthy();
    expect(screen.getByText("Abrí y cerrá la caja del local.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reporte del día" })).toBeTruthy();
  });

  it("sin rótulo no dibuja la línea de arriba (varias pantallas usan solo el título)", () => {
    render(<AdminPageHeader title="Órdenes" description="El tablero del turno." />);

    expect(screen.getByRole("heading", { level: 1, name: "Órdenes" })).toBeTruthy();
    expect(screen.queryByText("Control")).toBeNull();
  });

  it("sin acciones no deja el bloque vacío", () => {
    render(<AdminPageHeader title="Cierres" description="Lo que ya se cerró." />);

    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("el título va en la escala de sección en celular y en la de módulo desde md (A-43)", () => {
    render(<AdminPageHeader title="Locales" description="Dónde se retira." />);

    // El mecanismo del arreglo: `text-st-h2` (20 px) a 375 y `text-st-h1` (24 px) de 768 en adelante. Si
    // alguien vuelve a dejar `text-st-h1` fijo, el navegador vuelve a medir 23,3% y el E2E lo caza.
    const titulo = screen.getByRole("heading", { level: 1, name: "Locales" });
    expect(titulo.className).toContain("text-st-h2");
    expect(titulo.className).toContain("md:text-st-h1");
  });
});
