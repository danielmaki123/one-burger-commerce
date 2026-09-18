// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import PosDiscountPanel from "./pos-discount-panel";

/**
 * Tarea 9.7 del roadmap del POS (Fase 2) — el **descuento manual** en pantalla.
 *
 * Solo lo ve quien puede darlo (la pantalla no lo ofrece al cajero: `canDiscountPosSale`) y siempre pide el
 * **motivo**: un descuento sin motivo es plata que sale del arqueo sin explicación. El monto se calcula con
 * la regla del dominio —un porcentaje de hasta 100 % o un monto que nunca pasa de la venta— y viaja al
 * servidor como forma, no como número.
 */

afterEach(cleanup);

const currency = { symbol: "C$", locale: "es-NI" };

function renderPanel(props: {
  subtotal?: number;
  applied?: { kind: "percentage" | "amount"; value: number; reason: string; amount: number } | null;
  onChange?: (discount: unknown) => void;
}) {
  return render(
    <PosDiscountPanel
      subtotal={props.subtotal ?? 200}
      currency={currency}
      applied={props.applied ?? null}
      onChange={props.onChange ?? (() => {})}
    />,
  );
}

describe("PosDiscountPanel", () => {
  it("sin descuento aplicado pide el valor y el motivo, y no deja aplicar a medias", async () => {
    const user = userEvent.setup();
    renderPanel({});

    const aplicar = screen.getByRole("button", { name: "Aplicar descuento" });
    expect((aplicar as HTMLButtonElement).disabled).toBe(true);

    await user.clear(screen.getByLabelText("Descuento (%)"));
    await user.type(screen.getByLabelText("Descuento (%)"), "10");
    // Falta el motivo: sigue bloqueado.
    expect((aplicar as HTMLButtonElement).disabled).toBe(true);
  });

  it("aplica un porcentaje con su motivo y calcula el monto sobre la venta", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPanel({ subtotal: 200, onChange });

    await user.clear(screen.getByLabelText("Descuento (%)"));
    await user.type(screen.getByLabelText("Descuento (%)"), "10");
    await user.type(screen.getByLabelText("Motivo del descuento"), "Cliente de siempre");
    await user.click(screen.getByRole("button", { name: "Aplicar descuento" }));

    expect(onChange).toHaveBeenCalledWith({
      kind: "percentage",
      value: 10,
      reason: "Cliente de siempre",
      amount: 20,
    });
  });

  it("también se puede descontar un monto fijo, que nunca pasa de la venta", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPanel({ subtotal: 200, onChange });

    await user.click(screen.getByRole("button", { name: "Monto fijo" }));
    await user.clear(screen.getByLabelText("Descuento (C$)"));
    await user.type(screen.getByLabelText("Descuento (C$)"), "500");
    await user.type(screen.getByLabelText("Motivo del descuento"), "Cortesía de la casa");
    await user.click(screen.getByRole("button", { name: "Aplicar descuento" }));

    expect(onChange).toHaveBeenCalledWith({
      kind: "amount",
      value: 500,
      reason: "Cortesía de la casa",
      amount: 200,
    });
  });

  it("un porcentaje de más del 100 % se rechaza en la pantalla, no se recorta", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPanel({ onChange });

    await user.clear(screen.getByLabelText("Descuento (%)"));
    await user.type(screen.getByLabelText("Descuento (%)"), "120");
    await user.type(screen.getByLabelText("Motivo del descuento"), "Cortesía");

    expect(
      (screen.getByRole("button", { name: "Aplicar descuento" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("con el descuento aplicado se ve el resumen con el monto y se puede quitar", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPanel({
      applied: { kind: "percentage", value: 10, reason: "Cliente de siempre", amount: 20 },
      onChange,
    });

    expect(screen.getByText("Descuento manual · 10 %")).toBeTruthy();
    expect(screen.getByText("Cliente de siempre")).toBeTruthy();
    expect(screen.getByText(/−.*20\.00/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Quitar descuento" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
