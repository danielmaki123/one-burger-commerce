// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import PosChargePanel from "./pos-charge-panel";

/**
 * El **pie del checkout**: el CTA `Cobrar C$…`, el aviso de sin conexión y la venta recuperada.
 *
 * `SCREEN-POS-QUICK-SALE-001.1` §8 y §11: el diagnóstico de la caja («Caja cerrada», «Cierre pendiente») y su
 * acción viven en `PosCashAction`, en el mismo bloque; acá no se repiten. Lo que sí vive acá es la **única
 * acción primaria** de la pantalla, que tiene que quedar bloqueada cuando no se puede cobrar.
 */

afterEach(cleanup);

const currency = { symbol: "C$", locale: "es-NI" };

function renderPanel(over: Partial<React.ComponentProps<typeof PosChargePanel>> = {}) {
  const onCharge = vi.fn();

  const { unmount } = render(
    <PosChargePanel
      canCharge
      blockedReason={null}
      total={145}
      currency={currency}
      charging={false}
      saleError={null}
      restoredSale={false}
      onCharge={onCharge}
      {...over}
    />,
  );

  return { onCharge, unmount };
}

describe("PosChargePanel", () => {
  it("el botón dice el total y cobra", async () => {
    const user = userEvent.setup();
    const { onCharge } = renderPanel();

    await user.click(screen.getByRole("button", { name: /Cobrar/ }));

    expect(onCharge).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Cobrar/ }).textContent).toContain("145.00");
  });

  it("sin caja no se puede cobrar (y el motivo lo dice el bloque de caja)", () => {
    renderPanel({ canCharge: false });

    expect((screen.getByRole("button", { name: /Cobrar/ }) as HTMLButtonElement).disabled).toBe(true);
    // Este panel no repite el diagnóstico: no hay tarjeta de alerta acá.
    expect(screen.queryByText(/Caja cerrada/)).toBeNull();
  });

  it("con un motivo de bloqueo el botón queda deshabilitado", () => {
    renderPanel({ blockedReason: "Cerrá la caja de ayer antes de cobrar.", canCharge: true });

    expect((screen.getByRole("button", { name: /Cobrar/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("muestra el error del cobro y la venta recuperada", () => {
    const { unmount } = renderPanel({ saleError: "No se pudo cobrar." });

    expect(screen.getByRole("alert").textContent).toContain("No se pudo cobrar.");

    unmount();

    renderPanel({ restoredSale: true });
    expect(screen.getByText(/Recuperamos la venta/)).toBeTruthy();
  });

  it("mientras cobra, el botón lo dice y no acepta un segundo toque", async () => {
    const user = userEvent.setup();
    const { onCharge } = renderPanel({ charging: true });

    const boton = screen.getByRole("button", { name: "Cobrando…" });
    expect(boton.hasAttribute("disabled")).toBe(true);

    await user.click(boton);
    expect(onCharge).not.toHaveBeenCalled();
  });
});
