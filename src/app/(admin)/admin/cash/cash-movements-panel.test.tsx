// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CashMovementsPanel from "./cash-movements-panel";

/**
 * Tarea 2 del brief (2026-09-17) — el movimiento que supera el **límite de retiro** queda a la vista.
 *
 * Lo que se fija acá es lo que el owner pidió: el límite **avisa, no bloquea** (no hay aprobación del
 * supervisor, así que el retiro se registra igual) y la marca dice contra qué monto se comparó, para no
 * tener que ir a Personalización a entenderla.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const movement = (overrides: Record<string, unknown> = {}) => ({
  id: "mov_01",
  kind: "withdrawal" as const,
  category: "supplier",
  amount: 1500,
  currency: "NIO",
  reason: "Pago al proveedor",
  userId: "user_01",
  createdAt: "2026-09-17T18:00:00.000Z",
  withdrawalLimitAmount: 1000,
  ...overrides,
});

function renderPanel(movements: ReturnType<typeof movement>[]) {
  return render(
    <CashMovementsPanel
      shiftId="shift_01"
      initialMovements={movements}
      currencies={["NIO"]}
      shiftIsOpen={false}
      currency={{ symbol: "C$", locale: "es-NI" }}
      timezone="America/Managua"
      locale="es-NI"
    />,
  );
}

describe("CashMovementsPanel — límite de retiro", () => {
  afterEach(() => {
    cleanup();
  });

  it("marca el retiro por encima del límite y dice contra qué monto", () => {
    renderPanel([movement()]);

    expect(screen.getByText(/Sobre el límite de/)).toBeTruthy();
    expect(screen.getByText(/C\$1,000\.00/)).toBeTruthy();
  });

  it("un retiro dentro del límite no se marca", () => {
    renderPanel([movement({ amount: 500 })]);

    expect(screen.queryByText(/Sobre el límite de/)).toBeNull();
  });

  it("sin límite guardado (retiro viejo o sin configurar) no se marca", () => {
    renderPanel([movement({ withdrawalLimitAmount: null })]);

    expect(screen.queryByText(/Sobre el límite de/)).toBeNull();
  });

  it("un ingreso grande no se marca: el límite es de retiro", () => {
    renderPanel([movement({ kind: "deposit", amount: 9000, withdrawalLimitAmount: 1000 })]);

    expect(screen.queryByText(/Sobre el límite de/)).toBeNull();
  });
});
