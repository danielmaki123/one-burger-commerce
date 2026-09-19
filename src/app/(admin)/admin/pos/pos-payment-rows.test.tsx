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
  total = 145,
}: {
  initial?: PosPaymentDraft[];
  fieldErrors?: Record<string, string>;
  usdExchangeRate?: number | null;
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
    render(<Probe usdExchangeRate={36.5} />);

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
    render(<Probe total={145} usdExchangeRate={36.5} />);

    await user.selectOptions(screen.getByLabelText("Moneda del cobro"), "USD");
    await user.type(screen.getByLabelText("Con cuánto paga (en USD)"), "10");

    expect(screen.queryByText(/Vuelto/)).toBeNull();
  });
});
