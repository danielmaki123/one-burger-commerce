// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import PosCustomerFields, { type PosCustomerDraft } from "./pos-customer";

/**
 * Los datos del cliente de una venta de mostrador.
 *
 * La ley es la de siempre —nombre y número obligatorios (a quién se le avisa que el pedido está listo),
 * correo opcional, RUC y razón social solo al activar la factura— y lo que cambia en la venta rápida es
 * **dónde** vive cada cosa: lo que se necesita en una venta normal está a la vista y lo ocasional (correo,
 * factura) se pide bajo demanda, sin desaparecer.
 */

const EMPTY: PosCustomerDraft = {
  name: "",
  whatsapp: "",
  email: "",
  fiscal: { wantsInvoice: false, taxId: "", legalName: "" },
};

/** Los campos son controlados: el test los maneja como la pantalla. */
function Harness({ initial = EMPTY }: { initial?: PosCustomerDraft }) {
  const [customer, setCustomer] = useState(initial);

  return <PosCustomerFields customer={customer} setCustomer={setCustomer} fieldErrors={{}} />;
}

afterEach(cleanup);

describe("PosCustomerFields", () => {
  it("nombre y número están siempre a la vista y el correo no ocupa la venta normal", () => {
    render(<Harness />);

    expect(screen.getByLabelText("Nombre del cliente")).toBeTruthy();
    expect(screen.getByLabelText("Número del cliente")).toBeTruthy();
    expect(screen.queryByLabelText("Correo (opcional)")).toBeNull();
  });

  it("el correo se pide bajo demanda y se puede escribir", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Correo (opcional)" }));
    await user.type(screen.getByLabelText("Correo (opcional)"), "cliente@correo.com");

    expect((screen.getByLabelText("Correo (opcional)") as HTMLInputElement).value).toBe(
      "cliente@correo.com",
    );
  });

  it("la factura con RUC está apagada y sus campos aparecen solo con el tilde", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.queryByLabelText("RUC (mínimo 8 caracteres)")).toBeNull();

    await user.click(screen.getByLabelText("Cliente pide factura con RUC"));
    expect(screen.getByLabelText("RUC (mínimo 8 caracteres)")).toBeTruthy();
    expect(screen.getByLabelText("Razón social")).toBeTruthy();
  });

  it("destildar la factura limpia el RUC y la razón social del cliente anterior", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByLabelText("Cliente pide factura con RUC"));
    await user.type(screen.getByLabelText("RUC (mínimo 8 caracteres)"), "J0310");
    await user.type(screen.getByLabelText("Razón social"), "Distribuidora");

    await user.click(screen.getByLabelText("Cliente pide factura con RUC"));
    expect(screen.queryByLabelText("RUC (mínimo 8 caracteres)")).toBeNull();

    await user.click(screen.getByLabelText("Cliente pide factura con RUC"));
    expect((screen.getByLabelText("RUC (mínimo 8 caracteres)") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Razón social") as HTMLInputElement).value).toBe("");
  });

  it("muestra los errores por campo que devuelve el servidor", () => {
    render(
      <PosCustomerFields
        customer={EMPTY}
        setCustomer={() => {}}
        fieldErrors={{
          customerName: "Escribí el nombre del cliente.",
          customerWhatsapp: "Escribí el número del cliente.",
        }}
      />,
    );

    expect(screen.getByText("Escribí el nombre del cliente.")).toBeTruthy();
    expect(screen.getByText("Escribí el número del cliente.")).toBeTruthy();
  });
});
