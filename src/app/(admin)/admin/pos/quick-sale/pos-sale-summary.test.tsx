// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CURRENCY_FORMAT, formatCurrency } from "@/shared/lib/format-currency";

import PosSaleSummary, { PosMobileSaleBar } from "./pos-sale-summary";

/**
 * El resumen de plata de la venta: subtotal, descuentos, **total** y la barra inferior del celular.
 *
 * El total es el número de mayor jerarquía del POS, así que lo que se prueba es que sea el mismo número que
 * el servidor va a cobrar (la fórmula se la pasa la pantalla) y que sus partes estén: empaque solo cuando
 * existe, promo y descuento con su signo, y el conteo de líneas del encabezado.
 *
 * El texto esperado del dinero se deriva del **formato configurado** (`C$` + locale `es-NI`), no de un
 * helper del componente: el oráculo es la configuración del negocio.
 */

const currency = DEFAULT_CURRENCY_FORMAT;
const money = (amount: number) => formatCurrency(amount, currency);

afterEach(cleanup);

describe("PosSaleSummary", () => {
  it("muestra subtotal, empaque y total cuando la venta los tiene", () => {
    render(
      <PosSaleSummary
        linesCount={2}
        totals={{ subtotal: 450, packagingAmount: 10, total: 460 }}
        appliedCoupon={{ code: "BIENVENIDA10", discount: 45 }}
        manualDiscountAmount={0}
        currency={currency}
      />,
    );

    expect(screen.getByText("Subtotal")).toBeTruthy();
    expect(screen.getByText("Empaque")).toBeTruthy();
    expect(screen.getByText("Total", { exact: true })).toBeTruthy();
    expect(
      screen.getByText((_, element) => element?.textContent === "Descuento BIENVENIDA10"),
    ).toBeTruthy();
    expect(screen.getByText(`−${money(45)}`)).toBeTruthy();
  });

  it("no dibuja empaque cuando es cero", () => {
    render(
      <PosSaleSummary
        linesCount={1}
        totals={{ subtotal: 100, packagingAmount: 0, total: 100 }}
        appliedCoupon={null}
        manualDiscountAmount={0}
        currency={currency}
      />,
    );

    expect(screen.queryByText("Empaque")).toBeNull();
  });

  it("suma el descuento manual al de la promo en una sola línea de descuento", () => {
    render(
      <PosSaleSummary
        linesCount={1}
        totals={{ subtotal: 100, packagingAmount: 0, total: 60 }}
        appliedCoupon={null}
        manualDiscountAmount={40}
        currency={currency}
      />,
    );

    expect(screen.getByText("Descuento")).toBeTruthy();
    expect(screen.getByText(`−${money(40)}`)).toBeTruthy();
  });

  it("el encabezado cuenta las líneas con su singular y plural (variante `meta`)", () => {
    const { rerender } = render(
      <PosSaleSummary
        variant="meta"
        linesCount={0}
        totals={{ subtotal: 0, packagingAmount: 0, total: 0 }}
        appliedCoupon={null}
        manualDiscountAmount={0}
        currency={currency}
      />,
    );

    expect(screen.getByText("Sin productos")).toBeTruthy();
    // En `meta` los importes no se repiten: viven en el checkout del panel.
    expect(screen.queryByText("Subtotal")).toBeNull();

    rerender(
      <PosSaleSummary
        variant="meta"
        linesCount={1}
        totals={{ subtotal: 35, packagingAmount: 0, total: 35 }}
        appliedCoupon={null}
        manualDiscountAmount={0}
        currency={currency}
      />,
    );
    expect(screen.getByText("1 producto")).toBeTruthy();

    rerender(
      <PosSaleSummary
        variant="meta"
        linesCount={3}
        totals={{ subtotal: 105, packagingAmount: 0, total: 105 }}
        appliedCoupon={null}
        manualDiscountAmount={0}
        currency={currency}
      />,
    );
    expect(screen.getByText("3 productos")).toBeTruthy();
  });

  it("el total se lee con tipografía mono y se anuncia al cambiar", () => {
    render(
      <PosSaleSummary
        linesCount={1}
        totals={{ subtotal: 40, packagingAmount: 0, total: 40 }}
        appliedCoupon={null}
        manualDiscountAmount={0}
        currency={currency}
      />,
    );

    const total = screen.getByTestId("pos-sale-total");
    expect(total.className).toContain("font-mono");
    expect(total.className).toContain("tabular-nums");
    expect(total.getAttribute("aria-live")).toBe("polite");
    expect(total.textContent).toBe(money(40));
  });
});

describe("PosMobileSaleBar", () => {
  it("en la venta vacía dice que no hay productos y abre la venta", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();

    render(
      <PosMobileSaleBar linesCount={0} unitsCount={0} total={0} currency={currency} onOpen={onOpen} />,
    );

    expect(screen.getByText("Sin productos")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Ver venta/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("resume productos, unidades y total, y el nombre accesible lleva el total", () => {
    render(
      <PosMobileSaleBar
        linesCount={2}
        unitsCount={3}
        total={450}
        currency={currency}
        onOpen={() => {}}
      />,
    );

    const barra = screen.getByRole("region", { name: "Resumen de la venta" });
    expect(within(barra).getByText("2 productos")).toBeTruthy();
    expect(within(barra).getByText("3 unidades")).toBeTruthy();
    expect(within(barra).getByText(money(450))).toBeTruthy();
    expect(screen.getByRole("button", { name: `Ver venta · ${money(450)}` })).toBeTruthy();
  });

  it("las unidades se escriben en singular cuando hay una sola", () => {
    render(
      <PosMobileSaleBar
        linesCount={1}
        unitsCount={1}
        total={100}
        currency={currency}
        onOpen={() => {}}
      />,
    );

    expect(screen.getByText("1 unidad")).toBeTruthy();
  });
});
