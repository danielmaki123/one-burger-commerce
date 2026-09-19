// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { formatCurrency } from "@/shared/lib/format-currency";

import PosQuickCash, { POS_QUICK_CASH_AMOUNTS } from "./pos-quick-cash";

/**
 * Los montos con los que el cliente paga en efectivo.
 *
 * Son los billetes que existen en Nicaragua (**no hay C$150**) y no se configuran: es una constante del
 * mostrador, con su test. «Exacto» llena el total de la venta, que es el caso más frecuente.
 */

afterEach(cleanup);

const currency = { symbol: "C$", locale: "es-NI" };

describe("PosQuickCash", () => {
  it("ofrece Exacto y los billetes, en el orden del mostrador", () => {
    render(<PosQuickCash total={145} currency={currency} onPick={() => {}} />);

    expect(screen.getByRole("group", { name: "Montos rápidos de efectivo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Exacto" })).toBeTruthy();
    expect(POS_QUICK_CASH_AMOUNTS).toEqual([200, 500, 1000]);

    for (const amount of POS_QUICK_CASH_AMOUNTS) {
      expect(screen.getByRole("button", { name: formatCurrency(amount, currency) })).toBeTruthy();
    }
    // C$150 no es un billete: no está, ni como texto.
    expect(screen.queryByText(/150/)).toBeNull();
  });

  it("elegir un billete avisa el monto", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<PosQuickCash total={145} currency={currency} onPick={onPick} />);

    await user.click(screen.getByRole("button", { name: formatCurrency(500, currency) }));

    expect(onPick).toHaveBeenCalledWith(500);
  });

  it("«Exacto» avisa el total de la venta", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<PosQuickCash total={145} currency={currency} onPick={onPick} />);

    await user.click(screen.getByRole("button", { name: "Exacto" }));

    expect(onPick).toHaveBeenCalledWith(145);
  });

  it("los montos se formatean con la moneda configurada", () => {
    render(
      <PosQuickCash total={145} currency={{ symbol: "US$", locale: "es-NI" }} onPick={() => {}} />,
    );

    expect(screen.getByRole("button", { name: /US\$\s?200/ })).toBeTruthy();
  });
});
