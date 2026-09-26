// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CURRENCY_FORMAT } from "@/shared/lib/format-currency";

import { PosSaleOptions } from "./pos-sale-options";

/**
 * Las opciones secundarias de la venta: promo, descuento manual, dividir el pago, ventas en espera y el cobro
 * de un pedido del menú.
 *
 * La ley que esta pieza implementa es el **progressive disclosure** (`CONTENT.md` §9): nada de esto ocupa la
 * venta normal. Lo que se prueba es que (a) **nada** esté a la vista sin pedirlo, (b) lo que sí quedó aplicado
 * se **vea sin abrir nada** —el cajero tiene que saber que esa venta lleva promo—, y (c) el descuento manual
 * solo exista para quien puede darlo.
 */

const currency = DEFAULT_CURRENCY_FORMAT;

const baseProps = {
  currency,
  saleSubtotal: 100,
  locationId: "loc_centro",
  couponApplied: null,
  couponStale: false,
  couponBusy: false,
  couponError: null,
  onApplyCoupon: () => {},
  onRemoveCoupon: () => {},
  canDiscount: false,
  manualDiscount: null,
  onChangeManualDiscount: () => {},
};

afterEach(cleanup);

describe("PosSaleOptions", () => {
  it("no muestra ningún formulario secundario hasta que se pide", () => {
    render(
      <PosSaleOptions
        {...baseProps}
        holdsCount={0}
        holds={[]}
        holdsFull={false}
        saleInProgress
        onHold={() => {}}
        onResume={() => {}}
        onDiscard={() => {}}
      />,
    );

    expect(screen.queryByLabelText("Código de promo (opcional)")).toBeNull();
    expect(screen.queryByRole("region", { name: "Descuento manual" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Ventas en espera" })).toBeNull();
  });

  it("la promo se pide bajo demanda y se aplica con Enter", async () => {
    const user = userEvent.setup();
    const onApplyCoupon = vi.fn();

    render(
      <PosSaleOptions
        {...baseProps}
        onApplyCoupon={onApplyCoupon}
        holdsCount={0}
        holds={[]}
        holdsFull={false}
        saleInProgress
        onHold={() => {}}
        onResume={() => {}}
        onDiscard={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Aplicar promo" }));
    await user.type(screen.getByLabelText("Código de promo (opcional)"), "BIENVENIDA10{Enter}");

    expect(onApplyCoupon).toHaveBeenCalledWith("BIENVENIDA10");
  });

  it("cuando hay promo aplicada se ve sin abrir nada y se puede quitar", async () => {
    const user = userEvent.setup();
    const onRemoveCoupon = vi.fn();

    render(
      <PosSaleOptions
        {...baseProps}
        couponApplied={{ code: "BIENVENIDA10", label: "10 % de descuento", discount: 10 }}
        onRemoveCoupon={onRemoveCoupon}
        holdsCount={0}
        holds={[]}
        holdsFull={false}
        saleInProgress
        onHold={() => {}}
        onResume={() => {}}
        onDiscard={() => {}}
      />,
    );

    expect(screen.getByText("Promo BIENVENIDA10")).toBeTruthy();
    expect(screen.getByText("−C$10.00")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Quitar promo BIENVENIDA10" }));
    expect(onRemoveCoupon).toHaveBeenCalledTimes(1);
  });

  it("avisa que la promo cotizada venció cuando la venta cambió", () => {
    render(
      <PosSaleOptions
        {...baseProps}
        couponStale
        holdsCount={0}
        holds={[]}
        holdsFull={false}
        saleInProgress
        onHold={() => {}}
        onResume={() => {}}
        onDiscard={() => {}}
      />,
    );

    expect(
      screen.getByText("La venta cambió: volvé a aplicar el código para recalcular el descuento."),
    ).toBeTruthy();
  });

  it("el descuento manual no existe para quien no puede darlo: lo dice en vez de mostrar el formulario", async () => {
    const user = userEvent.setup();

    render(
      <PosSaleOptions
        {...baseProps}
        holdsCount={0}
        holds={[]}
        holdsFull={false}
        saleInProgress
        onHold={() => {}}
        onResume={() => {}}
        onDiscard={() => {}}
      />,
    );

    // El disparador existe para no esconder que la opción está, pero el formulario (que el servidor
    // rechazaría) no se dibuja: el control no está ni en el árbol accesible.
    await user.click(screen.getByRole("button", { name: "Aplicar descuento" }));

    expect(screen.queryByRole("region", { name: "Descuento manual" })).toBeNull();
    expect(screen.queryByLabelText("Descuento (%)")).toBeNull();
    expect(
      screen.getByText("Un descuento manual lo autoriza el dueño o el encargado."),
    ).toBeTruthy();
  });

  it("con permiso, el descuento manual se pide bajo demanda y su resumen queda visible", async () => {
    const user = userEvent.setup();

    render(
      <PosSaleOptions
        {...baseProps}
        canDiscount
        manualDiscount={{
          kind: "percentage",
          value: 10,
          reason: "Cliente de siempre",
          amount: 10,
        }}
        holdsCount={0}
        holds={[]}
        holdsFull={false}
        saleInProgress
        onHold={() => {}}
        onResume={() => {}}
        onDiscard={() => {}}
      />,
    );

    expect(screen.getByText("Descuento manual · 10 %")).toBeTruthy();
    expect(screen.getByText("Cliente de siempre")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Aplicar descuento" }));
    expect(screen.getByRole("region", { name: "Descuento manual" })).toBeTruthy();
  });

  it("el descuento manual ya aplicado se puede quitar sin abrir el panel", async () => {
    const user = userEvent.setup();
    const onChangeManualDiscount = vi.fn();

    render(
      <PosSaleOptions
        {...baseProps}
        canDiscount
        manualDiscount={{
          kind: "percentage",
          value: 10,
          reason: "Cliente de siempre",
          amount: 10,
        }}
        onChangeManualDiscount={onChangeManualDiscount}
        holdsCount={0}
        holds={[]}
        holdsFull={false}
        saleInProgress
        onHold={() => {}}
        onResume={() => {}}
        onDiscard={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Quitar descuento manual" }));
    expect(onChangeManualDiscount).toHaveBeenCalledWith(null);
  });

  it("las ventas en espera se ven en su capa y no en la venta normal", async () => {
    const user = userEvent.setup();
    const onResume = vi.fn();

    render(
      <PosSaleOptions
        {...baseProps}
        holdsCount={1}
        holds={[
          {
            id: "hold_1",
            savedAt: new Date().toISOString(),
            lines: [{ productId: "prod_taco", name: "Taco de birria", unitPrice: 35, quantity: 1 }],
            customer: { name: "Cliente Espera", whatsapp: "88887777", email: "", fiscal: { wantsInvoice: false, taxId: "", legalName: "" } },
            payments: [],
            attemptKey: null,
          },
        ]}
        holdsFull={false}
        saleInProgress={false}
        onHold={() => {}}
        onResume={onResume}
        onDiscard={() => {}}
      />,
    );

    const disparador = screen.getByRole("button", { name: "En espera (1)" });
    expect(screen.queryByRole("list", { name: "Ventas en espera" })).toBeNull();

    await user.click(disparador);
    const lista = screen.getByRole("list", { name: "Ventas en espera" });
    expect(within(lista).getByText("Cliente Espera")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Retomar la venta de Cliente Espera" }));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("guarda en espera solo cuando hay una venta armada", async () => {
    const user = userEvent.setup();
    const onHold = vi.fn();

    const { rerender } = render(
      <PosSaleOptions
        {...baseProps}
        holdsCount={0}
        holds={[]}
        holdsFull={false}
        saleInProgress={false}
        onHold={onHold}
        onResume={() => {}}
        onDiscard={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "En espera (0)" }));
    expect(screen.getByRole("button", { name: "Guardar en espera" }).hasAttribute("disabled")).toBe(
      true,
    );
    expect(onHold).not.toHaveBeenCalled();

    rerender(
      <PosSaleOptions
        {...baseProps}
        holdsCount={0}
        holds={[]}
        holdsFull={false}
        saleInProgress
        onHold={onHold}
        onResume={() => {}}
        onDiscard={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Guardar en espera" }));
    expect(onHold).toHaveBeenCalledTimes(1);
  });
});
