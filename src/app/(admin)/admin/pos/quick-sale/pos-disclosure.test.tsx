// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { OverlineLabel, PosDisclosure } from "./pos-disclosure";

/**
 * El bloque de progressive disclosure de la venta rápida.
 *
 * Lo que se prueba es **la mecánica de la capa**: que el contenido no esté a la vista hasta que el cajero
 * lo pida, que el disparador diga su estado (`aria-expanded`/`aria-controls`) y que Enter lo abra. Es lo
 * que hace que la venta normal no muestre seis formularios a la vez.
 */

afterEach(cleanup);

describe("PosDisclosure", () => {
  it("arranca cerrado: el contenido no está en pantalla hasta que se pide", () => {
    render(
      <PosDisclosure label="Correo (opcional)">
        <input aria-label="Correo del cliente" />
      </PosDisclosure>,
    );

    const disparador = screen.getByRole("button", { name: "Correo (opcional)" });
    expect(disparador.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText("Correo del cliente")).toBeNull();
  });

  it("abre el contenido al tocar el disparador y lo cierra al volver a tocarlo", async () => {
    const user = userEvent.setup();

    render(
      <PosDisclosure label="Correo (opcional)">
        <input aria-label="Correo del cliente" />
      </PosDisclosure>,
    );

    const disparador = screen.getByRole("button", { name: "Correo (opcional)" });

    await user.click(disparador);
    expect(disparador.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("Correo del cliente")).toBeTruthy();

    await user.click(disparador);
    expect(disparador.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText("Correo del cliente")).toBeNull();
  });

  it("la región del contenido está asociada al disparador", async () => {
    const user = userEvent.setup();

    render(
      <PosDisclosure label="Factura con RUC">
        <p>Datos de la factura</p>
      </PosDisclosure>,
    );

    const disparador = screen.getByRole("button", { name: "Factura con RUC" });
    await user.click(disparador);

    const controls = disparador.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(document.getElementById(controls!)).toBeTruthy();
  });

  it("el disparador se opera con el teclado (Enter)", async () => {
    const user = userEvent.setup();

    render(
      <PosDisclosure label="Aplicar promo">
        <input aria-label="Código de promo" />
      </PosDisclosure>,
    );

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Aplicar promo" }));

    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("Código de promo")).toBeTruthy();
  });

  it("con `defaultOpen` el contenido ya está a la vista", () => {
    render(
      <PosDisclosure label="Dividir pago" defaultOpen>
        <input aria-label="Segundo cobro" />
      </PosDisclosure>,
    );

    expect(screen.getByLabelText("Segundo cobro")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Dividir pago" }).getAttribute("aria-expanded"),
    ).toBe("true");
  });
});

describe("OverlineLabel", () => {
  it("rotula con la tipografía de etiqueta del panel", () => {
    render(<OverlineLabel>Cliente</OverlineLabel>);

    const etiqueta = screen.getByText("Cliente");
    expect(etiqueta.className).toContain("text-panel-overline");
  });
});
