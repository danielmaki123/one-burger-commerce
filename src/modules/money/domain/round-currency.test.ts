import { describe, expect, it } from "vitest";

import { roundCurrency } from "@/modules/money/domain/round-currency";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-69`) — **el único redondeo de dinero del sistema**.
 *
 * La auditoría de la fundación midió que había dos algoritmos redondeando el **mismo número** del arqueo:
 * `roundCurrency` (el dominante, 109 usos) y `Number(x.toFixed(2))` en `shift-refund.ts`. Los valores de
 * abajo salen de correr los dos en Node: `2.675 → roundCurrency 2.68` contra `toFixed(2) 2.67`. El
 * `expected` está derivado de la **regla del negocio** —«medio centavo hacia arriba, en binario seguro»—,
 * no de la implementación bajo prueba.
 */
describe("roundCurrency", () => {
  it("redondea al centavo más cercano", () => {
    expect(roundCurrency(1.004)).toBe(1);
    expect(roundCurrency(1.005)).toBe(1.01);
    expect(roundCurrency(1.006)).toBe(1.01);
    expect(roundCurrency(2.675)).toBe(2.68);
    expect(roundCurrency(36.5)).toBe(36.5);
    expect(roundCurrency(0)).toBe(0);
  });

  it("respeta el medio centavo hacia arriba también en negativos", () => {
    // El arqueo usa el signo para decir «faltó» o «sobró plata»: -0.125 tiene que caer del lado del
    // centavo mayor en magnitud, no del lado del cero.
    expect(roundCurrency(-0.125)).toBe(-0.13);
    expect(roundCurrency(-1.005)).toBe(-1.01);
    expect(roundCurrency(-2.5)).toBe(-2.5);
  });

  it("devuelve 0 ante un valor no finito (nunca NaN en un número de plata)", () => {
    expect(roundCurrency(Number.NaN)).toBe(0);
    expect(roundCurrency(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
