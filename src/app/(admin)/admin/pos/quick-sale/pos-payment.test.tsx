// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CURRENCY_FORMAT, formatCurrency } from "@/shared/lib/format-currency";

import type { PosPaymentDraft } from "../pos-types";
import PosPaymentFields from "./pos-payment";

/**
 * El cobro de la venta normal: medio de pago, monto, montos rápidos de billetes y **vuelto en vivo**.
 *
 * El vuelto se prueba contra una regla explícita del negocio —paga C$100 por una venta de C$40, el vuelto es
 * C$60; paga C$20, faltan C$20— y no contra el helper que usa la pantalla. El vuelto de un **cobro partido**
 * no existe (lo dice el panel): acá se fija que la fila única en efectivo sí lo muestre.
 */

const currency = DEFAULT_CURRENCY_FORMAT;
const money = (amount: number) => formatCurrency(amount, currency);

const cash: PosPaymentDraft = { id: "pay_1", method: "cash", currency: "NIO", amount: "" };

function Harness({ initial = [cash], total = 40 }: { initial?: PosPaymentDraft[]; total?: number }) {
  const [payments, setPayments] = useState(initial);

  return (
    <PosPaymentFields
      payments={payments}
      setPayments={setPayments}
      fieldErrors={{}}
      currencyCode="NIO"
      currency={currency}
      total={total}
      usdExchangeRate={null}
    />
  );
}

afterEach(cleanup);

describe("PosPaymentFields", () => {
  it("pregunta cómo paga con los cuatro medios del POS", () => {
    render(<Harness />);

    const grupo = screen.getByRole("group", { name: "¿Cómo paga?" });

    for (const medio of ["Efectivo", "Tarjeta", "Transferencia", "Otro"]) {
      expect(within(grupo).getByRole("button", { name: medio })).toBeTruthy();
    }

    expect(within(grupo).getByRole("button", { name: "Efectivo" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("el medio elegido queda marcado con estado, no solo con color", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Tarjeta" }));

    expect(screen.getByRole("button", { name: "Tarjeta" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Efectivo" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("calcula el vuelto en vivo con la regla del negocio", async () => {
    const user = userEvent.setup();
    render(<Harness total={40} />);

    await user.type(screen.getByLabelText("Con cuánto paga"), "100");
    // La venta es de C$40 y el cliente paga con C$100: el vuelto son C$60, no el monto tipeado.
    expect(screen.getByText("Vuelto")).toBeTruthy();
    expect(screen.getByText(money(60))).toBeTruthy();
  });

  it("dice cuánto falta cuando el monto no alcanza", async () => {
    const user = userEvent.setup();
    render(<Harness total={40} />);

    await user.type(screen.getByLabelText("Con cuánto paga"), "20");
    expect(screen.getByText(/Faltan/)).toBeTruthy();
    expect(screen.getByText(money(20))).toBeTruthy();
  });

  it("los montos rápidos llenan el monto con un billete real o con el exacto", async () => {
    const user = userEvent.setup();
    render(<Harness total={40} />);

    await user.click(screen.getByRole("button", { name: "Exacto" }));
    expect((screen.getByLabelText("Con cuánto paga") as HTMLInputElement).value).toBe("40");

    await user.click(screen.getByRole("button", { name: money(500) }));
    expect((screen.getByLabelText("Con cuánto paga") as HTMLInputElement).value).toBe("500");
  });

  it("sin tasa de cambio no se elige moneda", () => {
    render(<Harness />);
    expect(screen.queryByLabelText("Moneda del cobro")).toBeNull();
  });

  it("con tasa de cambio el cobro puede ir en dólares", () => {
    render(
      <PosPaymentFields
        payments={[cash]}
        setPayments={() => {}}
        fieldErrors={{}}
        currencyCode="NIO"
        currency={currency}
        total={40}
        usdExchangeRate={36}
      />,
    );

    expect(screen.getByLabelText("Moneda del cobro")).toBeTruthy();
    expect(screen.getByRole("option", { name: "USD" })).toBeTruthy();
  });

  it("la transferencia pide su referencia y el efectivo no", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.queryByLabelText("Referencia de la transferencia (opcional)")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Transferencia" }));
    expect(screen.getByLabelText("Referencia de la transferencia (opcional)")).toBeTruthy();
  });

  it("numera las filas de un cobro partido y permite sacarlas", async () => {
    const user = userEvent.setup();
    const onRemovePayment = vi.fn();

    render(
      <PosPaymentFields
        payments={[
          { id: "pay_1", method: "cash", currency: "NIO", amount: "40" },
          { id: "pay_2", method: "transfer", currency: "NIO", amount: "" },
        ]}
        setPayments={() => {}}
        fieldErrors={{}}
        currencyCode="NIO"
        currency={currency}
        total={40}
        usdExchangeRate={null}
        onRemovePayment={onRemovePayment}
      />,
    );

    expect(screen.getByText("Cobro 2")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Quitar el cobro 2" }));
    expect(onRemovePayment).toHaveBeenCalledWith("pay_2");
  });

  it("un cobro partido dice que no hay vuelto y cuánto se lleva cobrado", () => {
    render(
      <PosPaymentFields
        payments={[
          { id: "pay_1", method: "cash", currency: "NIO", amount: "20" },
          { id: "pay_2", method: "transfer", currency: "NIO", amount: "20" },
        ]}
        setPayments={() => {}}
        fieldErrors={{}}
        currencyCode="NIO"
        currency={currency}
        total={40}
        usdExchangeRate={null}
      />,
    );

    expect(screen.getByText(/En un cobro partido no hay vuelto/)).toBeTruthy();
    // El total de la venta: C$20 + C$20 es lo que el cajero ya lleva cobrado y lo que vale la venta.
    expect(screen.getAllByText(money(40)).length).toBeGreaterThan(0);
    expect(screen.getByText(money(20))).toBeTruthy();
  });

  it("muestra el error de monto que devuelve el servidor", () => {
    render(
      <PosPaymentFields
        payments={[cash]}
        setPayments={() => {}}
        fieldErrors={{ amount: "El cobro supera lo que falta." }}
        currencyCode="NIO"
        currency={currency}
        total={40}
        usdExchangeRate={null}
      />,
    );

    expect(screen.getByText("El cobro supera lo que falta.")).toBeTruthy();
  });
});
