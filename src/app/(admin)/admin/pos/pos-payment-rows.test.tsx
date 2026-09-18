// @vitest-environment jsdom

import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import PosPaymentRows from "./pos-payment-rows";
import type { PosPaymentDraft } from "./pos-types";

/**
 * Las filas del cobro del mostrador. El bloque se extrajo de `pos-client.tsx` (deuda con techo congelado)
 * sin cambiar su comportamiento; este test lo fija con lo que el cajero hace: elegir el medio, repartir el
 * cobro entre dos filas, escribir el monto y sacar una fila.
 */

afterEach(cleanup);

function Probe({
  initial = [{ id: "pay_1", method: "cash", currency: "NIO", amount: "" }],
  fieldErrors = {},
  usdExchangeRate = null,
}: {
  initial?: PosPaymentDraft[];
  fieldErrors?: Record<string, string>;
  usdExchangeRate?: number | null;
}) {
  const [payments, setPayments] = React.useState<PosPaymentDraft[]>(initial);

  return (
    <div>
      <PosPaymentRows
        payments={payments}
        setPayments={setPayments}
        fieldErrors={fieldErrors}
        currencyCode="NIO"
        usdExchangeRate={usdExchangeRate}
      />
      <button
        type="button"
        onClick={() =>
          setPayments((current) => [
            ...current,
            { id: `pay_${current.length + 1}`, method: "transfer", currency: "NIO", amount: "" },
          ])
        }
      >
        Partir el cobro
      </button>
    </div>
  );
}

describe("PosPaymentRows", () => {
  it("ofrece los medios del POS, con el elegido marcado", () => {
    render(<Probe />);

    for (const label of ["Efectivo", "Tarjeta", "Transferencia", "Otro"]) {
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

  it("la transferencia pide su referencia", async () => {
    const user = userEvent.setup();
    render(<Probe />);

    await user.click(screen.getByRole("button", { name: /transferencia/i }));

    await user.type(
      screen.getByLabelText("Referencia de la transferencia (opcional)"),
      "TRF-8891",
    );
    expect(
      (screen.getByLabelText("Referencia de la transferencia (opcional)") as HTMLInputElement).value,
    ).toBe("TRF-8891");
  });

  it("en un cobro partido cada fila se numera y solo las extra se pueden quitar", async () => {
    const user = userEvent.setup();
    render(<Probe />);

    await user.click(screen.getByRole("button", { name: "Partir el cobro" }));

    expect(screen.getByText("Cobro 2")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Quitar este cobro" })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Quitar este cobro" }));
    expect(screen.queryByText("Cobro 2")).toBeNull();
  });

  it("con dólares cargados se elige la moneda de cada cobro", () => {
    render(<Probe usdExchangeRate={36.5} />);

    expect(screen.getByLabelText("Moneda del cobro")).toBeTruthy();
  });

  it("sin tasa de cambio la moneda del cobro no se elige", () => {
    render(<Probe />);

    expect(screen.queryByLabelText("Moneda del cobro")).toBeNull();
  });

  it("el error del servidor se muestra en el monto", () => {
    render(<Probe fieldErrors={{ amount: "Escribí con cuánto paga el cliente." }} />);

    expect(screen.getByText("Escribí con cuánto paga el cliente.")).toBeTruthy();
  });
});
