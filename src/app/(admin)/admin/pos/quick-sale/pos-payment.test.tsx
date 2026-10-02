// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PosPaymentMethodOption } from "@/modules/pos/domain/pos-payment-methods";
import { DEFAULT_CURRENCY_FORMAT, formatCurrency } from "@/shared/lib/format-currency";

import type { PosPaymentDraft } from "../pos-types";
import PosPaymentFields from "./pos-payment";

/**
 * El cobro de la venta normal: medio de pago, monto, montos rápidos de billetes y **vuelto en vivo**.
 *
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §37, §39) — los medios de «¿Cómo paga?» salen del **catálogo
 * configurado** del local y no de una constante del código: la pieza recibe `methodOptions` y las filas
 * viven en `PosPaymentRows`, compartido con el cobro del pedido existente.
 *
 * El vuelto se prueba contra una regla explícita del negocio —paga C$100 por una venta de C$40, el vuelto es
 * C$60; paga C$20, faltan C$20— y no contra el helper que usa la pantalla. El vuelto de un **cobro partido**
 * no existe (lo dice el panel): acá se fija que la fila única en efectivo sí lo muestre.
 */

const currency = DEFAULT_CURRENCY_FORMAT;
const money = (amount: number) => formatCurrency(amount, currency);

/**
 * Los medios configurados que este local ofrece. Se declara **una sola vez** y lo usan todos los renders:
 * las dos transferencias comparten `kind`/`method` y difieren en `requiresReference`, que es la regla que
 * decide si el cobro pide referencia (brief §39).
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

/**
 * La fila del cobro único en efectivo. Lleva su `paymentMethodId` para que la fila tenga medio elegido: sin
 * él no hay opción seleccionada y no habría montos rápidos ni vuelto que probar.
 */
const cash: PosPaymentDraft = {
  id: "pay_1",
  method: "cash",
  paymentMethodId: "pm_cash",
  currency: "NIO",
  amount: "",
};

function Harness({ initial = [cash], total = 40 }: { initial?: PosPaymentDraft[]; total?: number }) {
  const [payments, setPayments] = useState(initial);

  return (
    <PosPaymentFields
      payments={payments}
      setPayments={setPayments}
      fieldErrors={{}}
      money={{ baseCurrencyCode: "NIO", locale: "es-NI", rates: { USD: 36.5 }, knownCurrencyCodes: ["NIO", "USD"] }}
      acceptedCurrencies={["NIO", "USD"]}
      currency={currency}
      total={total}
      methodOptions={methodOptions}
    />
  );
}

afterEach(cleanup);

describe("PosPaymentFields", () => {
  it("pregunta cómo paga con los medios configurados del local", () => {
    render(<Harness />);

    /*
     * Los medios ya no son los cuatro de la constante: son el catálogo del local, con el nombre que el
     * dueño configuró («Transferencia Banpro» no existía como constante). El grupo con su nombre accesible
     * sigue siendo el de la pregunta.
     */
    const grupo = screen.getByRole("group", { name: "¿Cómo paga?" });

    for (const medio of [
      "Efectivo",
      "Tarjeta",
      "Transferencia Banpro",
      "Transferencia BAC",
      "Otro",
    ]) {
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

  /**
   * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-85`) — **el selector de moneda sale de las monedas
   * aceptadas**, no de si hay una tasa del dólar cargada.
   *
   * Antes el control aparecía sólo con `usdExchangeRate` y ofrecía exactamente dos entradas (la base y el
   * dólar). Ahora ofrece las monedas que `money` declara activas, y con una sola no hay nada que elegir.
   */
  it("con una sola moneda aceptada no hay nada que elegir", () => {
    render(
      <PosPaymentFields
        payments={[cash]}
        setPayments={() => {}}
        fieldErrors={{}}
        money={{ baseCurrencyCode: "NIO", locale: "es-NI", rates: {} }}
        acceptedCurrencies={["NIO"]}
        currency={currency}
        total={40}
        methodOptions={methodOptions}
      />,
    );

    expect(screen.queryByLabelText("Moneda del cobro")).toBeNull();
  });

  it("ofrece todas las monedas aceptadas, no sólo la base y el dólar", () => {
    render(
      <PosPaymentFields
        payments={[cash]}
        setPayments={() => {}}
        fieldErrors={{}}
        money={{
          baseCurrencyCode: "NIO",
          locale: "es-NI",
          rates: { USD: 36.5, EUR: 40 },
          knownCurrencyCodes: ["NIO", "USD", "EUR"],
        }}
        acceptedCurrencies={["NIO", "USD", "EUR"]}
        currency={currency}
        total={40}
        methodOptions={methodOptions}
      />,
    );

    expect(screen.getByLabelText("Moneda del cobro")).toBeTruthy();
    expect(screen.getByRole("option", { name: "USD" })).toBeTruthy();
    // Si esto necesitara un `if EUR` en el componente, la arquitectura seguiría mal.
    expect(screen.getByRole("option", { name: "EUR" })).toBeTruthy();
  });

  it("la transferencia que pide referencia la muestra y el efectivo no", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.queryByLabelText("Referencia del cobro")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Transferencia Banpro" }));
    expect(screen.getByLabelText("Referencia del cobro")).toBeTruthy();
  });

  it("numera las filas de un cobro partido y permite sacarlas", async () => {
    const user = userEvent.setup();
    const onRemovePayment = vi.fn();

    render(
      <PosPaymentFields
        payments={[
          { id: "pay_1", method: "cash", paymentMethodId: "pm_cash", currency: "NIO", amount: "40" },
          {
            id: "pay_2",
            method: "transfer",
            paymentMethodId: "pm_banpro",
            currency: "NIO",
            amount: "",
          },
        ]}
        setPayments={() => {}}
        fieldErrors={{}}
        money={{ baseCurrencyCode: "NIO", locale: "es-NI", rates: { USD: 36.5 }, knownCurrencyCodes: ["NIO", "USD"] }}
      acceptedCurrencies={["NIO", "USD"]}
        currency={currency}
        total={40}
        methodOptions={methodOptions}
        onRemovePayment={onRemovePayment}
      />,
    );

    expect(screen.getByText("Cobro 2")).toBeTruthy();
    // El control lleva el número de la fila y la pantalla es la que saca el cobro (acá, el espía).
    await user.click(screen.getByRole("button", { name: "Quitar el cobro 2" }));
    expect(onRemovePayment).toHaveBeenCalledWith("pay_2");
  });

  it("un cobro partido dice que no hay vuelto y cuánto se lleva cobrado", () => {
    render(
      <PosPaymentFields
        payments={[
          { id: "pay_1", method: "cash", paymentMethodId: "pm_cash", currency: "NIO", amount: "20" },
          {
            id: "pay_2",
            method: "transfer",
            paymentMethodId: "pm_banpro",
            currency: "NIO",
            amount: "20",
          },
        ]}
        setPayments={() => {}}
        fieldErrors={{}}
        money={{ baseCurrencyCode: "NIO", locale: "es-NI", rates: { USD: 36.5 }, knownCurrencyCodes: ["NIO", "USD"] }}
      acceptedCurrencies={["NIO", "USD"]}
        currency={currency}
        total={40}
        methodOptions={methodOptions}
      />,
    );

    expect(screen.getByText(/En un cobro partido no hay vuelto/)).toBeTruthy();
    // El total de la venta: C$20 + C$20 es lo que el cajero ya lleva cobrado y lo que vale la venta.
    expect(screen.getAllByText(money(40)).length).toBeGreaterThan(0);
    expect(screen.getByText(money(20))).toBeTruthy();
  });

  /**
   * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-69c`, invariante 3) — **el cobro partido se muestra en una sola
   * moneda**.
   *
   * El caso del hallazgo: `US$10 + C$355` sobre un pedido de C$720 a tasa 36.5. Sumando crudo, el ticket
   * decía «Cobrado C$365» (10 + 355) sobre un pedido de C$720: el cajero veía cubierto un pedido que no lo
   * estaba. El equivalente real es `10 × 36.5 = 365`, así que el cobrado es **C$720**.
   */
  it("convierte la fila en dólares antes de mostrar el cobrado (A-69c)", () => {
    render(
      <PosPaymentFields
        payments={[
          { id: "pay_1", method: "cash", paymentMethodId: "pm_cash", currency: "USD", amount: "10" },
          {
            id: "pay_2",
            method: "transfer",
            paymentMethodId: "pm_banpro",
            currency: "NIO",
            amount: "355",
          },
        ]}
        setPayments={() => {}}
        fieldErrors={{}}
        money={{ baseCurrencyCode: "NIO", locale: "es-NI", rates: { USD: 36.5 }, knownCurrencyCodes: ["NIO", "USD"] }}
      acceptedCurrencies={["NIO", "USD"]}
        currency={currency}
        total={720}
        methodOptions={methodOptions}
      />,
    );

    /*
     * El cobrado convertido: 365 + 355 = 720. Se busca dentro de la línea del cobro partido —el total de la
     * venta muestra el mismo número— y se afirma que el **crudo** (365) no aparece como cobrado.
     */
    const cobrado = screen.getByText(/Cobrado/);

    expect(cobrado.textContent).toContain("720");
    expect(cobrado.textContent).not.toContain("365");
  });

  it("muestra el error de monto que devuelve el servidor", () => {
    render(
      <PosPaymentFields
        payments={[cash]}
        setPayments={() => {}}
        fieldErrors={{ amount: "El cobro supera lo que falta." }}
        money={{ baseCurrencyCode: "NIO", locale: "es-NI", rates: { USD: 36.5 }, knownCurrencyCodes: ["NIO", "USD"] }}
      acceptedCurrencies={["NIO", "USD"]}
        currency={currency}
        total={40}
        methodOptions={methodOptions}
      />,
    );

    expect(screen.getByText("El cobro supera lo que falta.")).toBeTruthy();
  });
});
