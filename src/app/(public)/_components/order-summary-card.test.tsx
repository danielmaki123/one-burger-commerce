// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { OrderSummaryCard } from "./order-summary-card";

/**
 * TASK-102 — la tarjeta de resumen es uno de los lugares que calculaba el total por su cuenta
 * (`subtotal + packagingAmount + tipAmount`, sin descuento ni envío). Estos casos fijan la cuenta
 * para que el refactor a la fuente canónica no cambie el número que ve el cliente.
 */
afterEach(cleanup);

function renderCard(props: Partial<Parameters<typeof OrderSummaryCard>[0]> = {}) {
  return render(
    <OrderSummaryCard
      itemCount={1}
      subtotal={100}
      packagingAmount={10}
      {...props}
    />,
  );
}

/** El importe de la fila "Total a pagar". */
function renderedTotal(): string {
  const label = screen.getByText("Total a pagar");
  const row = label.parentElement as HTMLElement;

  return row.lastElementChild?.textContent ?? "";
}

describe("OrderSummaryCard · total (TASK-102)", () => {
  it("suma subtotal, empaque y propina", () => {
    renderCard({ tipAmount: 9 });

    expect(renderedTotal()).toContain("119");
  });

  it("sin propina el total es subtotal más empaque", () => {
    renderCard();

    expect(renderedTotal()).toContain("110");
  });

  it("resta el descuento cuando la pantalla lo conoce", () => {
    renderCard({ discount: 25 });

    expect(renderedTotal()).toContain("85");
  });

  it("suma el envío cuando la pantalla lo conoce", () => {
    renderCard({ deliveryFeeAmount: 30 });

    expect(renderedTotal()).toContain("140");
  });

  it("la propina no se muestra si no hay propina", () => {
    renderCard();

    expect(screen.queryByText(/^Propina/)).toBeNull();
  });
});
