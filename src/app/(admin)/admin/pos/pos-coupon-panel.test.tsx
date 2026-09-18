// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import PosCouponPanel from "./pos-coupon-panel";

/**
 * Tarea 9.6 del roadmap del POS (Fase 2) — el cupón en el mostrador.
 *
 * El cajero escribe el código, el **servidor** dice cuánto descuenta y esa cotización se muestra antes de
 * cobrar. Tres cosas que la pantalla tiene que decir sin que nadie las adivine: qué promo se aplicó (para
 * que el cliente la reconozca), cuánto baja el total y que un cambio en la venta **vence** la cotización
 * (el descuento se calculó sobre lo que había, no sobre lo que hay).
 */

afterEach(cleanup);

const currency = { symbol: "C$", locale: "es-NI" };

const applied = { code: "BIENVENIDA10", label: "10 % de descuento", discount: 7 };

function renderPanel(props: {
  applied?: typeof applied | null;
  stale?: boolean;
  busy?: boolean;
  error?: string | null;
  onApply?: (code: string) => void;
  onRemove?: () => void;
}) {
  return render(
    <PosCouponPanel
      applied={props.applied ?? null}
      stale={props.stale ?? false}
      busy={props.busy ?? false}
      error={props.error ?? null}
      currency={currency}
      onApply={props.onApply ?? (() => {})}
      onRemove={props.onRemove ?? (() => {})}
    />,
  );
}

describe("PosCouponPanel", () => {
  it("sin código escrito no se puede aplicar nada", () => {
    renderPanel({});

    expect(
      (screen.getByRole("button", { name: "Aplicar" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("aplica el código que escribió el cajero (sin espacios de más)", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    renderPanel({ onApply });

    await user.type(screen.getByLabelText("Código de promo (opcional)"), "  b2g1 ");
    await user.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(onApply).toHaveBeenCalledWith("b2g1");
  });

  it("con la promo aplicada se ve qué es y cuánto baja, y se puede quitar", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    renderPanel({ applied, onRemove });

    expect(screen.getByText("BIENVENIDA10")).toBeTruthy();
    expect(screen.getByText("10 % de descuento")).toBeTruthy();
    expect(screen.getByText(/−.*7\.00/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Quitar" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("mientras el servidor cotiza, el botón lo dice y no se puede volver a pedir", () => {
    renderPanel({ busy: true });

    expect(
      (screen.getByRole("button", { name: "Cotizando…" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("un cambio en la venta vence la cotización y lo dice", () => {
    renderPanel({ stale: true });

    expect(
      screen.getByText("La venta cambió: volvé a aplicar el código para recalcular el descuento."),
    ).toBeTruthy();
  });

  it("cuando el código no sirve, el motivo se muestra tal como lo devolvió el servidor", () => {
    renderPanel({ error: "Ese código ya se usó todas las veces que se podía." });

    expect(screen.getByText("Ese código ya se usó todas las veces que se podía.")).toBeTruthy();
  });
});
