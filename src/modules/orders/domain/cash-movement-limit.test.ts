import { describe, expect, it } from "vitest";

import { isOverWithdrawalLimit } from "./cash-movement-limit";

/**
 * Tarea 2 del brief (2026-09-17) — el **límite de retiro**.
 *
 * Decisión del owner: el límite se configura en Personalización y **no hay aprobación del supervisor**.
 * Entonces la regla no bloquea nada: marca el movimiento para que se vea. Eso deja tres cosas que fijar
 * acá: qué cuenta como «encima del límite» (solo los retiros, estrictamente mayor), qué pasa sin límite
 * (nada se marca) y que el límite que vale es el que estaba vigente al registrar (el guardado con el
 * movimiento), no el de hoy.
 */

describe("isOverWithdrawalLimit", () => {
  it("un retiro por encima del límite se marca", () => {
    expect(
      isOverWithdrawalLimit({ kind: "withdrawal", amount: 1500, withdrawalLimitAmount: 1000 }),
    ).toBe(true);
  });

  it("justo el límite no se marca: la regla es «mayor a»", () => {
    expect(
      isOverWithdrawalLimit({ kind: "withdrawal", amount: 1000, withdrawalLimitAmount: 1000 }),
    ).toBe(false);
  });

  it("un ingreso no se marca nunca, aunque sea grande", () => {
    // El límite es de **retiro**: el cambio que se trae o un aporte a la caja no son plata que se va.
    expect(
      isOverWithdrawalLimit({ kind: "deposit", amount: 5000, withdrawalLimitAmount: 1000 }),
    ).toBe(false);
  });

  it("sin límite configurado no se marca nada", () => {
    expect(
      isOverWithdrawalLimit({ kind: "withdrawal", amount: 9999, withdrawalLimitAmount: null }),
    ).toBe(false);
  });

  it("solo los retiros pueden estar sobre el límite (y un retiro chico no)", () => {
    expect(
      isOverWithdrawalLimit({ kind: "withdrawal", amount: 500, withdrawalLimitAmount: 1000 }),
    ).toBe(false);
  });
});
