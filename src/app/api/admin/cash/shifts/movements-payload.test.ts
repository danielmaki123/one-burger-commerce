import { describe, expect, it } from "vitest";

import { ShiftError } from "@/modules/orders/domain/shift-errors";

import { parseCashMovementPayload } from "./movements-payload";

/**
 * Bloque 2.2/2.4 del roadmap del POS (Fase 2) — el payload de un movimiento de caja.
 *
 * El monto es **positivo** y el signo lo da el tipo: un retiro no puede llegar con −500 ni con 0
 * (sumaría o no movería nada). La moneda son 3 letras y el motivo es obligatorio.
 */
const valid = {
  kind: "withdrawal",
  category: "supplier",
  amount: 500,
  currency: "nio",
  reason: "Pago al proveedor",
};

describe("parseCashMovementPayload", () => {
  it("acepta un movimiento válido y normaliza la moneda a mayúsculas", () => {
    expect(parseCashMovementPayload(valid)).toEqual({ ...valid, currency: "nio" });
  });

  it.each([
    [{ ...valid, kind: "transfer" }, "tipo inválido"],
    [{ ...valid, category: "otros" }, "categoría inventada"],
    [{ ...valid, amount: 0 }, "monto cero"],
    [{ ...valid, amount: -500 }, "monto negativo"],
    [{ ...valid, currency: "NI" }, "moneda corta"],
    [{ ...valid, reason: "   " }, "motivo vacío"],
    [{ ...valid, reason: "x".repeat(301) }, "motivo larguísimo"],
  ])("rechaza %j (%s) con 422", (body) => {
    expect(() => parseCashMovementPayload(body)).toThrow(ShiftError);
  });
});
