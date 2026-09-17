// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import PaymentMixPanel, { paymentMixOf } from "./payment-mix-panel";

/**
 * Tarea 1.2 del roadmap (2026-09-17) — el desglose por medio en el detalle del cierre.
 *
 * Fija lo que el dueño lee: de dónde salió la plata del día (efectivo, tarjeta, transferencia, otras), las
 * propinas y el total. Y que un turno **anterior** al desglose lo diga con palabras: mostrar ceros
 * afirmaría que no entró nada por tarjeta, que es distinto de «no se guardó».
 */

const props = { currencySymbol: "C$", locale: "es-NI" };

describe("PaymentMixPanel", () => {
  afterEach(cleanup);

  it("muestra cada medio con su monto y el total cobrado", () => {
    render(
      <PaymentMixPanel
        mix={{ cash: 4000, card: 1500, transfer: 500, other: 0, tips: 120 }}
        {...props}
      />,
    );

    const panel = screen.getByRole("region", { name: "Cobros por medio" });

    expect(panel.textContent).toContain("Efectivo");
    expect(panel.textContent).toContain("C$4,000.00");
    expect(panel.textContent).toContain("C$1,500.00");
    expect(panel.textContent).toContain("C$500.00");
    expect(panel.textContent).toContain("Propinas");
    expect(panel.textContent).toContain("C$120.00");
    // 4000 + 1500 + 500 + 0: las propinas ya están dentro de cada medio, no se suman dos veces.
    expect(panel.textContent).toContain("C$6,000.00");
  });

  it("un turno sin el desglose guardado lo dice, en vez de mostrar ceros", () => {
    render(<PaymentMixPanel mix={null} {...props} />);

    const panel = screen.getByRole("region", { name: "Cobros por medio" });

    expect(panel.textContent).toContain("anterior a que el cierre guardara el desglose");
    expect(panel.textContent).not.toContain("C$0.00");
  });
});

describe("paymentMixOf", () => {
  it("arma el desglose con lo que quedó guardado al cerrar", () => {
    expect(
      paymentMixOf({
        cashSalesAmount: 4000,
        cardSalesAmount: 1500,
        transferSalesAmount: 500,
        otherSalesAmount: 0,
        tipsAmount: 120,
      }),
    ).toEqual({ cash: 4000, card: 1500, transfer: 500, other: 0, tips: 120 });
  });

  it("un cierre viejo (sin desglose) no se completa con ceros", () => {
    // El efectivo puede estar (se guardaba antes), pero sin la tarjeta no hay desglose que mostrar.
    expect(paymentMixOf({ cashSalesAmount: 4000, cardSalesAmount: null })).toBeNull();
    expect(paymentMixOf({ cashSalesAmount: 4000 })).toBeNull();
  });
});
