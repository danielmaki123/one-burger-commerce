// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OrderDetailActions } from "./order-detail-actions";
import type { OrderDetailView } from "../../order-detail-panels";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §24) — **el puente de Pedidos al POS**.
 *
 * Pedidos **localiza y revisa**; el **POS cobra** (*one canonical flow*). Por eso el detalle administrativo no
 * gana un formulario de cobro: gana un **enlace** al mismo modo «pedido existente» del POS que usan los KPI
 * (`/admin/pos?orderId=<id>`). Un checkout dentro del detalle sería el segundo flujo financiero que el brief
 * §26 prohíbe, y el test lo fija en las dos direcciones: el enlace está donde tiene que estar y **no hay
 * ningún control de cobro** en esta superficie.
 */

function order(overrides: Partial<OrderDetailView> = {}): OrderDetailView {
  return {
    id: "ord_1",
    orderNumber: "P-1042",
    type: "pickup",
    status: "ready_for_pickup",
    canViewFinancials: true,
    financial: {
      status: "pending",
      paidAmount: 0,
      outstandingAmount: 380,
      unresolvedAmount: 0,
      baseCurrencyCode: "NIO",
    },
    ...overrides,
  } as OrderDetailView;
}

afterEach(() => {
  cleanup();
});

describe("OrderDetailActions · Cobrar en POS (brief §24)", () => {
  it("un pedido por cobrar ofrece el enlace al POS, con el id del pedido", () => {
    render(<OrderDetailActions order={order()} onDone={vi.fn()} />);

    const link = screen.getByTestId("order-collect-in-pos");

    expect(link.getAttribute("href")).toBe("/admin/pos?orderId=ord_1");
    expect(link.textContent).toContain("Cobrar en POS");
  });

  it("un pedido ya cobrado no ofrece el enlace", () => {
    render(
      <OrderDetailActions
        order={order({
          financial: {
            status: "paid",
            paidAmount: 380,
            outstandingAmount: 0,
            unresolvedAmount: 0,
            baseCurrencyCode: "NIO",
          },
        })}
        onDone={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("order-collect-in-pos")).toBeNull();
  });

  it("un pedido cancelado no ofrece el enlace", () => {
    render(<OrderDetailActions order={order({ status: "cancelled" })} onDone={vi.fn()} />);

    expect(screen.queryByTestId("order-collect-in-pos")).toBeNull();
  });

  it("sin capacidad financiera no se manda a cobrar a ciegas", () => {
    // Quien no puede ver montos no recibe el enlace: mandarlo a cobrar sin el saldo sería peor que no ofrecerlo.
    render(
      <OrderDetailActions order={order({ canViewFinancials: false, financial: null })} onDone={vi.fn()} />,
    );

    expect(screen.queryByTestId("order-collect-in-pos")).toBeNull();
  });

  it("un pedido con plata sin equivalente demostrable igual manda al POS: ahí se revisa", () => {
    // Brief §32: el POS muestra REVISAR y no lo cobra. El destino correcto sigue siendo el POS, porque es
    // donde la decisión se toma —lo que no hace es cobrarlo—.
    render(
      <OrderDetailActions
        order={order({
          financial: {
            status: "partial",
            paidAmount: 100,
            outstandingAmount: 280,
            unresolvedAmount: 100,
            baseCurrencyCode: "NIO",
          },
        })}
        onDone={vi.fn()}
      />,
    );

    expect(screen.getByTestId("order-collect-in-pos")).toBeTruthy();
  });

  it("esta superficie no cobra: no hay ningún control de pago", () => {
    render(<OrderDetailActions order={order()} onDone={vi.fn()} />);

    expect(screen.queryByLabelText("Con cuánto paga")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Cobrar/ })).toBeNull();
  });
});
