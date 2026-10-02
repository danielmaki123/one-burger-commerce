// @vitest-environment jsdom

import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import type { PosPaymentMethodOption } from "@/modules/pos/domain/pos-payment-methods";

import PosPaymentRows from "./pos-payment-rows";
import type { PosPaymentDraft } from "./pos-types";

/**
 * Las filas del cobro del mostrador. El bloque se extrajo de `pos-client.tsx` (deuda con techo congelado)
 * y hoy es **el componente compartido** de la venta normal y del cobro del pedido existente; este test lo
 * fija con lo que el cajero hace: elegir el medio, repartir el cobro entre dos filas, escribir el monto y
 * sacar una fila.
 *
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §37, §39) — **los medios salen del catálogo configurado del
 * local**, así que el fixture de abajo es la configuración del negocio: los nombres los pone el dueño
 * («Transferencia Banpro») y la referencia la pide **el medio** (`requiresReference`), no el tipo.
 */

/**
 * Los medios que este local tiene configurados. Se declara **una sola vez** y lo comparten todos los casos.
 *
 * Las dos transferencias son el caso que prueba la regla: **mismo `kind` (`bank_transfer`) y mismo
 * `method` (`transfer`)** y distinto `requiresReference`. Un componente que decidiera con
 * `payment.method === "transfer"` dibujaría la referencia en las dos —o en ninguna—, así que ninguno de
 * los dos casos puede pasar por casualidad.
 */
const methodOptions: PosPaymentMethodOption[] = [
  {
    id: "pm_cash",
    label: "Efectivo",
    kind: "cash",
    method: "cash",
    requiresReference: false,
    currencyCodes: [],
  },
  {
    id: "pm_card",
    label: "Tarjeta",
    kind: "card",
    method: "card",
    requiresReference: false,
    currencyCodes: [],
  },
  {
    id: "pm_banpro",
    label: "Transferencia Banpro",
    kind: "bank_transfer",
    method: "transfer",
    requiresReference: true,
    currencyCodes: [],
  },
  {
    id: "pm_bac",
    label: "Transferencia BAC",
    kind: "bank_transfer",
    method: "transfer",
    requiresReference: false,
    currencyCodes: [],
  },
  {
    id: "pm_other",
    label: "Otro",
    kind: "other",
    method: "other",
    requiresReference: false,
    currencyCodes: [],
  },
];

afterEach(cleanup);

function Probe({
  initial = [
    { id: "pay_1", method: "cash", paymentMethodId: "pm_cash", currency: "NIO", amount: "" },
  ],
  fieldErrors = {},
  acceptedCurrencies = ["NIO"],
  total = 145,
}: {
  initial?: PosPaymentDraft[];
  fieldErrors?: Record<string, string>;
  /** Las monedas que el negocio acepta hoy (`A-85`): con una sola no hay nada que elegir. */
  acceptedCurrencies?: string[];
  total?: number;
}) {
  const [payments, setPayments] = React.useState<PosPaymentDraft[]>(initial);

  return (
    <div>
      <PosPaymentRows
        payments={payments}
        setPayments={setPayments}
        fieldErrors={fieldErrors}
        currencyCode="NIO"
        currency={{ symbol: "C$", locale: "es-NI" }}
        total={total}
        acceptedCurrencies={acceptedCurrencies}
        methodOptions={methodOptions}
        // El control de la fila avisa a la pantalla, que es la dueña del cobro; acá el probe hace de pantalla.
        onRemovePayment={(paymentId) =>
          setPayments((current) => current.filter((item) => item.id !== paymentId))
        }
      />
      <button
        type="button"
        onClick={() =>
          setPayments((current) => [
            ...current,
            {
              id: `pay_${current.length + 1}`,
              method: "transfer",
              // Con `paymentMethodId` la fila nueva tiene un medio propio; sin él no hay opción elegida.
              paymentMethodId: "pm_banpro",
              currency: "NIO",
              amount: "",
            },
          ])
        }
      >
        Partir el cobro
      </button>
    </div>
  );
}

describe("PosPaymentRows", () => {
  it("ofrece los medios configurados del local, con el elegido marcado", () => {
    render(<Probe />);

    /*
     * Los medios **no** son una constante del código: son el catálogo del local, con los nombres que el
     * dueño configuró en Finanzas. La lista incluye un nombre que no existía en la constante vieja
     * («Transferencia Banpro»), así que el caso no puede pasar con una lista hardcodeada.
     */
    for (const label of [
      "Efectivo",
      "Tarjeta",
      "Transferencia Banpro",
      "Transferencia BAC",
      "Otro",
    ]) {
      expect(screen.getByRole("button", { name: new RegExp(`^${label}$`, "i") })).toBeTruthy();
    }
    // `mixed` es un resultado del cobro partido, no una opción.
    expect(screen.queryByRole("button", { name: /mixto/i })).toBeNull();
    expect(screen.getByRole("button", { name: /efectivo/i }).getAttribute("aria-pressed")).toBe("true");
  });

  it("cambiar el medio y escribir el monto actualizan el cobro", async () => {
    const user = userEvent.setup();
    render(<Probe />);

    await user.click(screen.getByRole("button", { name: /tarjeta/i }));
    expect(screen.getByRole("button", { name: /tarjeta/i }).getAttribute("aria-pressed")).toBe("true");

    await user.type(screen.getByLabelText("Con cuánto paga"), "80");
    expect((screen.getByLabelText("Con cuánto paga") as HTMLInputElement).value).toBe("80");
  });

  it("la transferencia que pide referencia la muestra y guarda lo escrito", async () => {
    const user = userEvent.setup();
    render(<Probe />);

    await user.click(screen.getByRole("button", { name: /transferencia banpro/i }));

    await user.type(screen.getByLabelText("Referencia del cobro"), "TRF-8891");
    expect((screen.getByLabelText("Referencia del cobro") as HTMLInputElement).value).toBe("TRF-8891");
  });

  /**
   * `brief §39` — la referencia la pide **el medio configurado** (`requiresReference`), no el tipo
   * histórico del cobro. Los dos casos de abajo son el **mismo** `kind`/`method`
   * (`bank_transfer`/`transfer`) y se comportan distinto: la regla es por medio, no por tipo.
   */
  it("un medio con requiresReference muestra el campo de referencia", async () => {
    const user = userEvent.setup();
    render(<Probe />);

    await user.click(screen.getByRole("button", { name: /transferencia banpro/i }));

    expect(screen.getByLabelText("Referencia del cobro")).toBeTruthy();
  });

  it("un medio sin requiresReference no muestra el campo de referencia", async () => {
    const user = userEvent.setup();
    render(<Probe />);

    // Mismo `kind` y mismo `method` que «Transferencia Banpro»: cambia sólo `requiresReference`.
    await user.click(screen.getByRole("button", { name: /transferencia bac/i }));
    expect(screen.queryByLabelText("Referencia del cobro")).toBeNull();

    // Y vuelve al elegir la que sí la pide: la decisión es del medio elegido, no de la fila ni del tipo.
    await user.click(screen.getByRole("button", { name: /transferencia banpro/i }));
    expect(screen.getByLabelText("Referencia del cobro")).toBeTruthy();
  });

  it("en un cobro partido cada fila se numera y solo las extra se pueden quitar", async () => {
    const user = userEvent.setup();
    render(<Probe />);

    await user.click(screen.getByRole("button", { name: "Partir el cobro" }));

    expect(screen.getByText("Cobro 2")).toBeTruthy();
    // El control dice a qué fila pertenece: en un cobro partido hay una sola extra y es la 2.
    expect(screen.getAllByRole("button", { name: "Quitar el cobro 2" })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Quitar el cobro 2" }));
    expect(screen.queryByText("Cobro 2")).toBeNull();
  });

  it("con más de una moneda aceptada se elige la moneda de cada cobro", () => {
    render(<Probe acceptedCurrencies={["NIO", "USD"]} />);

    expect(screen.getByLabelText("Moneda del cobro")).toBeTruthy();
  });

  it("con una sola moneda aceptada la moneda del cobro no se elige", () => {
    render(<Probe acceptedCurrencies={["NIO"]} />);

    expect(screen.queryByLabelText("Moneda del cobro")).toBeNull();
  });

  it("el error del servidor se muestra en el monto", () => {
    render(<Probe fieldErrors={{ amount: "Escribí con cuánto paga el cliente." }} />);

    expect(screen.getByText("Escribí con cuánto paga el cliente.")).toBeTruthy();
  });

  /**
   * Los montos rápidos del efectivo: el cajero no tipea, toca el billete con el que le pagaron. Solo en
   * efectivo y solo en córdobas (los billetes son de córdobas; en un cobro en dólares no aplican).
   */
  it("con efectivo ofrece «Exacto» y los billetes, y llenan el monto", async () => {
    const user = userEvent.setup();
    render(<Probe total={145} />);

    await user.click(screen.getByRole("button", { name: /500\.00/ }));
    expect((screen.getByLabelText("Con cuánto paga") as HTMLInputElement).value).toBe("500");

    await user.click(screen.getByRole("button", { name: "Exacto" }));
    expect((screen.getByLabelText("Con cuánto paga") as HTMLInputElement).value).toBe("145");
  });

  it("con tarjeta no ofrece los montos del efectivo", async () => {
    const user = userEvent.setup();
    render(<Probe />);

    await user.click(screen.getByRole("button", { name: /tarjeta/i }));

    expect(screen.queryByRole("group", { name: "Montos rápidos de efectivo" })).toBeNull();
  });

  it("en un cobro en dólares no ofrece los billetes de córdobas", async () => {
    const user = userEvent.setup();
    render(<Probe acceptedCurrencies={["NIO", "USD"]} />);

    await user.selectOptions(screen.getByLabelText("Moneda del cobro"), "USD");

    expect(screen.queryByRole("group", { name: "Montos rápidos de efectivo" })).toBeNull();
  });

  /**
   * El vuelto en vivo: el cajero ve cuánto tiene que devolver **mientras escribe**, no después de cobrar.
   * Sale de la misma fórmula que usa el servidor (`calculateOrderChange`), así que el número de la
   * pantalla y el del arqueo no pueden discrepar.
   */
  it("mientras escribe el efectivo, el vuelto se ve en vivo", async () => {
    const user = userEvent.setup();
    render(<Probe total={145} />);

    expect(screen.queryByText(/Vuelto/)).toBeNull();

    await user.type(screen.getByLabelText("Con cuánto paga"), "200");

    expect(screen.getByText(/Vuelto/).textContent).toContain("55.00");
  });

  it("si el monto todavía no alcanza, lo dice antes de cobrar", async () => {
    const user = userEvent.setup();
    render(<Probe total={145} />);

    await user.type(screen.getByLabelText("Con cuánto paga"), "100");

    expect(screen.getByText(/Faltan/).textContent).toContain("45.00");
    expect(screen.queryByText(/Vuelto/)).toBeNull();
  });

  it("con lo justo el vuelto es cero", async () => {
    const user = userEvent.setup();
    render(<Probe total={145} />);

    await user.type(screen.getByLabelText("Con cuánto paga"), "145");

    expect(screen.getByText(/Vuelto/).textContent).toContain("0.00");
  });

  it("en un cobro en dólares no se muestra un vuelto en córdobas", async () => {
    const user = userEvent.setup();
    render(<Probe total={145} acceptedCurrencies={["NIO", "USD"]} />);

    await user.selectOptions(screen.getByLabelText("Moneda del cobro"), "USD");
    await user.type(screen.getByLabelText("Con cuánto paga (en USD)"), "10");

    expect(screen.queryByText(/Vuelto/)).toBeNull();
  });
});
