// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import CashCloseModal from "./cash-close-modal";

/**
 * jsdom no implementa el modo modal del `<dialog>` (igual que en `modal.test.tsx`): se le agrega el mínimo
 * para poder verificar el contenido del cierre, que es lo que aporta esta pantalla.
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

/**
 * Fase 3 del rediseño de Caja (2026-09-23) — el **modal del cierre**: el conteo del cajón y el cuadre por
 * banco, con el consolidado y la diferencia.
 *
 * Lo que fijan estos casos:
 *
 * - El monto declarado de cada banco sale del formulario y viaja **como fila** (no como total): el
 *   servidor es el que suma.
 * - La diferencia se muestra **antes** de cerrar y **no bloquea**: cerrar una caja con el lote torcido
 *   tiene que ser posible (el aviso al dueño es lo que la hace visible).
 * - El arqueo ciego manda: quien no audita declara su lote pero no ve lo cobrado ni la diferencia.
 */

const countConfig = { currencies: ["NIO", "USD"], denominations: { NIO: [1000, 500], USD: [20] } };

const banks = [
  { id: "bank_bac", name: "BAC Credomatic", code: "BAC" },
  { id: "bank_banpro", name: "Banpro", code: null },
];

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response);
}

describe("CashCloseModal", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(() =>
      jsonResponse({
        data: {
          nonCashByCurrency: { NIO: 500 },
          expectedByCurrency: { NIO: 1500 },
          paymentMix: { cash: 1000, card: 500, transfer: 0, other: 0, total: 1500, tips: 0, orders: 3 },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function setup(overrides: Partial<React.ComponentProps<typeof CashCloseModal>> = {}) {
    const onClose = vi.fn();
    const onCancel = vi.fn();

    render(
      <CashCloseModal
        open
        locationId="loc_principal"
        countConfig={countConfig}
        banks={banks}
        canSeeDifference
        busy={false}
        onCancel={onCancel}
        onClose={onClose}
        {...overrides}
      />,
    );

    return { onClose, onCancel };
  }

  it("dibuja un bloque por banco con su monto, su lote y su terminal", async () => {
    setup();

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByLabelText("Monto declarado de BAC Credomatic")).toBeTruthy();
    expect(screen.getByLabelText("Lote de BAC Credomatic")).toBeTruthy();
    expect(screen.getByLabelText("Terminal de BAC Credomatic")).toBeTruthy();
    expect(screen.getByLabelText("Monto declarado de Banpro")).toBeTruthy();
    // La lectura de lo cobrado sale del corte X del local (la misma cuenta que el cierre).
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/admin/pos/shift/x?locationId=loc_principal");
  });

  it("cierra con el conteo y las filas de banco declaradas", async () => {
    const user = userEvent.setup();
    const { onClose } = setup();

    await waitFor(() => expect(screen.getByText(/Cobrado sin pasar por el cajón/)).toBeTruthy());
    await user.type(screen.getByLabelText("Cantidad de billetes de NIO 500"), "2");
    await user.type(screen.getByLabelText("Monto declarado de BAC Credomatic"), "600");
    await user.type(screen.getByLabelText("Lote de BAC Credomatic"), "0012");
    await user.type(screen.getByLabelText("Terminal de BAC Credomatic"), "Terminal 1");
    await user.click(screen.getByRole("button", { name: "Cerrar caja" }));

    expect(onClose).toHaveBeenCalledWith(
      [{ currency: "NIO", denomination: 500, quantity: 2 }],
      // El modal entrega las **filas del formulario** (el monto todavía es el texto del input): la
      // conversión a número y el `null` de lo vacío pasan en el borde de la API (`useCashShift`).
      [
        {
          key: "bank_bac",
          bankId: "bank_bac",
          currency: "NIO",
          declaredAmount: "600",
          lote: "0012",
          terminalLabel: "Terminal 1",
          notes: "",
        },
      ],
    );
  });

  it("muestra el consolidado y la diferencia con lo cobrado, sin bloquear el cierre", async () => {
    const user = userEvent.setup();
    setup();

    await waitFor(() => expect(screen.getByText(/Cobrado sin pasar por el cajón/)).toBeTruthy());
    await user.type(screen.getByLabelText("Monto declarado de BAC Credomatic"), "550");

    // Declarado 550 contra 500 cobrados: sobran C$50 y el modal lo dice, pero el botón sigue disponible.
    expect(screen.getByText(/Diferencia del cuadre/)).toBeTruthy();
    expect(screen.getByText(/\+C\$50\.00/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cerrar caja" })).toHaveProperty("disabled", false);
  });

  it("con arqueo ciego el cajero declara su lote sin ver lo cobrado ni la diferencia", async () => {
    const user = userEvent.setup();
    setup({ canSeeDifference: false });

    expect(screen.queryByText(/Cobrado sin pasar por el cajón/)).toBeNull();
    expect(screen.queryByText(/Diferencia del cuadre/)).toBeNull();
    // El bloque del banco sigue estando: el lote lo tiene que declarar quien cierra.
    await user.type(screen.getByLabelText("Monto declarado de BAC Credomatic"), "550");
    expect(screen.getByRole("button", { name: "Cerrar caja" })).toBeTruthy();
  });

  it("sin bancos asignados lo dice y deja cerrar solo con el conteo", async () => {
    const user = userEvent.setup();
    const { onClose } = setup({ banks: [] });

    expect(screen.getByText(/no tiene bancos asignados/i)).toBeTruthy();
    await user.type(screen.getByLabelText("Cantidad de billetes de NIO 500"), "1");
    await user.click(screen.getByRole("button", { name: "Cerrar caja" }));

    expect(onClose).toHaveBeenCalledWith(
      [{ currency: "NIO", denomination: 500, quantity: 1 }],
      [],
    );
  });

  it("cancelar no cierra nada", async () => {
    const user = userEvent.setup();
    const { onCancel, onClose } = setup();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onCancel).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
