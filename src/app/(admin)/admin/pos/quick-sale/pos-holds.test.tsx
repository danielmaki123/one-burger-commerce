// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { MAX_POS_HELDS, type PosHeldSale } from "@/modules/pos/domain/pos-holds";
import { DEFAULT_CURRENCY_FORMAT } from "@/shared/lib/format-currency";

import PosHoldsPanel from "./pos-holds";

/**
 * Tareas 9.4 y 9.5 del roadmap del POS (Fase 2) — «En espera» en la venta rápida.
 *
 * El mostrador atiende de a uno: cuando el cliente no está listo, el cajero deja la venta a un lado y sigue
 * con el próximo. La pieza tiene que decir tres cosas sin que nadie las adivine: **cómo** dejar la venta en
 * espera, **cuál** se puede retomar (y por qué no, si hay una venta en curso) y que descartar una espera
 * **no se deshace**.
 *
 * Lo que cambia en la Fase 1 es dónde vive: el bloque permanente se fue y quedó **una capa secundaria** que
 * se abre desde `En espera (N)` — sin nada que revisar no ocupa la venta.
 *
 * jsdom no implementa el modo modal del `<dialog>` (igual que en `modal.test.tsx`): se le agrega el mínimo
 * para poder verificar la confirmación, que es del navegador cuando corre de verdad.
 */

beforeAll(() => {
  const proto = window.HTMLDialogElement.prototype as HTMLDialogElement & {
    showModal?: () => void;
    close?: () => void;
  };

  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
});

afterEach(cleanup);

const currency = DEFAULT_CURRENCY_FORMAT;

const attemptKey = "ce9b1f5e-1a2b-4c3d-8e4f-5a6b7c8d9e0f";

function heldSale(overrides: Partial<PosHeldSale> = {}): PosHeldSale {
  return {
    id: "hold_1",
    savedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    lines: [
      { productId: "seed-prod-01", name: "Taco de Birria", unitPrice: 30, quantity: 2 },
      { productId: "seed-prod-02", name: "Agua de Jamaica", unitPrice: 10, quantity: 1 },
    ],
    customer: { name: "Ana", whatsapp: "+50588888888", email: "" },
    payments: [{ method: "cash", currency: "NIO", amount: "100" }],
    attemptKey,
    ...overrides,
  };
}

function renderPanel(props: {
  holds?: PosHeldSale[];
  saleInProgress?: boolean;
  full?: boolean;
  onHold?: () => void;
  onResume?: (hold: PosHeldSale) => void;
  onDiscard?: (hold: PosHeldSale) => void;
}) {
  return render(
    <PosHoldsPanel
      locationId="loc_centro"
      holds={props.holds ?? []}
      full={props.full ?? false}
      saleInProgress={props.saleInProgress ?? true}
      currency={currency}
      onHold={props.onHold ?? (() => {})}
      onResume={props.onResume ?? (() => {})}
      onDiscard={props.onDiscard ?? (() => {})}
    />,
  );
}

describe("PosHoldsPanel", () => {
  it("sin esperas lo dice y no deja guardar una venta vacía", () => {
    renderPanel({ saleInProgress: false });

    expect(screen.getByText("No hay ventas en espera.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Guardar en espera" }).hasAttribute("disabled")).toBe(
      true,
    );
    expect(screen.getByText("Agregá productos para dejar la venta en espera.")).toBeTruthy();
  });

  it("con la venta armada, guardarla en espera es un toque", async () => {
    const user = userEvent.setup();
    const onHold = vi.fn();
    renderPanel({ onHold });

    await user.click(screen.getByRole("button", { name: "Guardar en espera" }));

    expect(onHold).toHaveBeenCalledTimes(1);
  });

  it("cada espera dice de quién es, cuánto lleva y desde cuándo", () => {
    renderPanel({ holds: [heldSale()] });

    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText(/3 productos · Hace 2 h/)).toBeTruthy();
    // 2 × C$ 30 + C$ 10, con la misma cuenta que el cobro (posDraftTotals).
    expect(screen.getByText(/70\.00/)).toBeTruthy();
  });

  it("una espera sin nombre se puede retomar igual", () => {
    renderPanel({
      holds: [heldSale({ customer: { name: "  ", whatsapp: "", email: "" } })],
    });

    expect(screen.getByText("Sin nombre")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retomar la venta de Sin nombre" })).toBeTruthy();
  });

  it("con una venta en curso no se retoma otra: primero hay que resolverla", () => {
    renderPanel({ holds: [heldSale()], saleInProgress: true });

    expect(
      screen.getByRole("button", { name: "Retomar la venta de Ana" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByText("Para retomar otra venta, cobrá o dejá en espera la que está en curso."),
    ).toBeTruthy();
  });

  it("retomar devuelve la espera que se eligió", async () => {
    const user = userEvent.setup();
    const onResume = vi.fn();
    const sale = heldSale();
    renderPanel({ holds: [sale], saleInProgress: false, onResume });

    await user.click(screen.getByRole("button", { name: "Retomar la venta de Ana" }));

    expect(onResume).toHaveBeenCalledWith(sale);
  });

  it("descartar pregunta antes: la venta del cliente no se pierde de un toque", async () => {
    const user = userEvent.setup();
    const onDiscard = vi.fn();
    const sale = heldSale();
    renderPanel({ holds: [sale], saleInProgress: false, onDiscard });

    await user.click(screen.getByRole("button", { name: "Descartar la venta de Ana" }));
    expect(onDiscard).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Sí, descartar" }));
    expect(onDiscard).toHaveBeenCalledWith(sale);
  });

  it("cancelar la confirmación no descarta nada", async () => {
    const user = userEvent.setup();
    const onDiscard = vi.fn();
    renderPanel({ holds: [heldSale()], saleInProgress: false, onDiscard });

    await user.click(screen.getByRole("button", { name: "Descartar la venta de Ana" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onDiscard).not.toHaveBeenCalled();
  });

  it("con la lista llena lo dice y no deja guardar otra", () => {
    const full = Array.from({ length: MAX_POS_HELDS }, (_, index) =>
      heldSale({ id: `hold_${index + 1}` }),
    );
    renderPanel({ holds: full, full: true });

    expect(screen.getByRole("button", { name: "Guardar en espera" }).hasAttribute("disabled")).toBe(
      true,
    );
    expect(
      screen.getByText(
        `Ya hay ${MAX_POS_HELDS} ventas en espera. Retomá o descartá una para dejar otra.`,
      ),
    ).toBeTruthy();
  });

  it("la lista vive en una región propia, con las esperas que se le pasan", () => {
    renderPanel({ holds: [heldSale()] });

    const region = screen.getByRole("region", { name: "Ventas en espera" });
    expect(region).toBeTruthy();
    expect(screen.getByRole("list", { name: "Ventas en espera" })).toBeTruthy();
  });
});
