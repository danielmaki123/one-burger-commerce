// @vitest-environment jsdom

import * as React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import PosCustomerFields, { type PosCustomerDraft } from "./pos-customer-fields";
import { EMPTY_POS_FISCAL_DRAFT } from "./pos-fiscal-payload";

/**
 * Punto 4 del roadmap (2026-09-18) — los campos del cliente del mostrador.
 *
 * Se prueba el componente solo (con su estado real, como lo usa el POS) porque el tilde cambia el
 * formulario: con «Cliente pide factura con RUC» puesto aparecen el RUC y la razón social, y al
 * destildarlo **se limpian** para que el próximo cliente no herede los datos del anterior.
 */

afterEach(cleanup);

function Harness() {
  const [customer, setCustomer] = React.useState<PosCustomerDraft>({
    name: "Cliente",
    whatsapp: "88887777",
    email: "",
    fiscal: EMPTY_POS_FISCAL_DRAFT,
  });

  return <PosCustomerFields customer={customer} setCustomer={setCustomer} fieldErrors={{}} />;
}

const invoiceToggle = () => screen.getByLabelText("Cliente pide factura con RUC");
const taxIdField = () => screen.getByLabelText("RUC (mínimo 8 caracteres)");

describe("pos customer fields", () => {
  it("arranca sin la factura pedida: los campos fiscales no están", () => {
    render(<Harness />);

    expect((invoiceToggle() as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByLabelText("RUC (mínimo 8 caracteres)")).toBeNull();
    expect(screen.queryByLabelText("Razón social")).toBeNull();
  });

  it("con el tilde puesto aparecen el RUC y la razón social", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(invoiceToggle());

    await waitFor(() => expect((invoiceToggle() as HTMLInputElement).checked).toBe(true));
    expect(taxIdField()).toBeTruthy();
    expect(screen.getByLabelText("Razón social")).toBeTruthy();
  });

  it("al destildarlo se limpian los dos datos", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(invoiceToggle());
    await user.type(taxIdField(), "J0310000001");
    await user.type(screen.getByLabelText("Razón social"), "Distribuidora La Unión");

    expect((taxIdField() as HTMLInputElement).value).toBe("J0310000001");

    await user.click(invoiceToggle());

    await waitFor(() => expect((invoiceToggle() as HTMLInputElement).checked).toBe(false));
    // Vuelven a aparecer vacíos: el RUC de este cliente no es el del siguiente.
    await user.click(invoiceToggle());
    expect((taxIdField() as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Razón social") as HTMLInputElement).value).toBe("");
  });

  /**
   * La guía visual del mockup: cada campo lleva su ícono a la derecha (persona, teléfono, correo). Es
   * decoración: el campo se sigue leyendo por su etiqueta, así que el ícono va `aria-hidden`.
   */
  it("cada campo del cliente tiene su ícono a la derecha, decorativo", () => {
    render(<Harness />);

    for (const field of ["name", "whatsapp", "email"]) {
      const icon = screen.getByTestId(`pos-customer-icon-${field}`);

      expect(icon.getAttribute("aria-hidden")).toBe("true");
      expect(icon.className).toContain("right-3");
    }
  });
});
