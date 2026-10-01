import { describe, expect, it } from "vitest";

import {
  SETTLEMENT_TOLERANCE,
  validateExactSettlement,
  type SettlementPayment,
} from "@/modules/payments/domain/order-settlement";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §29, §30, §31, §34, §35) — **la liquidación exacta del saldo**.
 *
 * La regla operacional que el brief fija, y que reemplaza cualquier idea de «abono»:
 *
 * ```text
 * Σ monto aplicado == outstandingAmount
 * ```
 *
 * Ni menos —**no existe el abono comercial**: el POS no ofrece «cobrá C$300 y dejá C$700 para después»— ni
 * más —el **overpayment** de un cobro partido se registra hoy sin explicar el excedente, que es el hallazgo
 * nuevo de esta TASK—. Los `expected` de acá se derivan de esa igualdad escrita a mano, **nunca** del
 * helper de producción.
 *
 * El monto que se aplica es el **equivalente en moneda base** que el cobro congeló en su snapshot
 * (`baseAmount`): la conversión es de `money` y el hecho ya la tiene. Por eso el validador no multiplica
 * nada por una tasa — el POS no inventa FX (brief §41).
 */

function payment(baseAmount: number, changeAmount = 0): SettlementPayment {
  return { baseAmount, changeAmount };
}

describe("order-settlement · liquidación exacta", () => {
  it("un medio que cubre todo el saldo liquida exacto", () => {
    const result = validateExactSettlement({
      outstandingAmount: 380,
      payments: [payment(380)],
    });

    expect(result).toEqual({ ok: true, appliedAmount: 380, difference: 0 });
  });

  it("dos medios que suman el saldo liquidan exacto", () => {
    // El caso del brief §28: Total C$800 = efectivo C$300 + tarjeta C$500.
    const result = validateExactSettlement({
      outstandingAmount: 800,
      payments: [payment(300), payment(500)],
    });

    expect(result.ok).toBe(true);
    expect(result.appliedAmount).toBe(800);
  });

  it("el mismo medio repetido en dos filas también suma", () => {
    // El brief §48 pide cubrir «mismo método en dos filas si el producto lo permite»: la regla es sobre la
    // suma, no sobre la unicidad del medio.
    const result = validateExactSettlement({
      outstandingAmount: 500,
      payments: [payment(200), payment(300)],
    });

    expect(result.ok).toBe(true);
    expect(result.appliedAmount).toBe(500);
  });

  it("monedas múltiples: se suma el equivalente ya congelado, sin reconvertir", () => {
    // 10 USD a tasa 36.5 son C$365 de equivalente. El dominio **no** vuelve a multiplicar: recibe el
    // `baseAmount` que `money` ya produjo y sumó el snapshot.
    const result = validateExactSettlement({
      outstandingAmount: 465,
      payments: [payment(365), payment(100)],
    });

    expect(result.ok).toBe(true);
    expect(result.appliedAmount).toBe(465);
  });
});

describe("order-settlement · underpayment", () => {
  it("menos que el saldo se rechaza con lo que falta", () => {
    const result = validateExactSettlement({
      outstandingAmount: 800,
      payments: [payment(300)],
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toBe("underpayment");
    expect(result.difference).toBe(500);
    expect(result.appliedAmount).toBe(300);
  });

  it("un cobro partido que no llega al saldo también se rechaza", () => {
    const result = validateExactSettlement({
      outstandingAmount: 800,
      payments: [payment(300), payment(400)],
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toBe("underpayment");
    expect(result.difference).toBe(100);
  });
});

describe("order-settlement · overpayment partido", () => {
  it("más que el saldo se rechaza con el excedente (el caso auditado 80 / 50 + 50)", () => {
    // Hallazgo nuevo de esta TASK: una venta de C$80 cobrada con C$50 en efectivo + C$50 con tarjeta
    // termina sin explicar los C$20 extra. Acá se reproduce como expectativa correcta: **rechazo**.
    const result = validateExactSettlement({
      outstandingAmount: 80,
      payments: [payment(50), payment(50)],
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toBe("overpayment");
    expect(result.difference).toBe(20);
    expect(result.appliedAmount).toBe(100);
  });

  it("un solo medio por encima del saldo también se rechaza", () => {
    const result = validateExactSettlement({
      outstandingAmount: 80,
      payments: [payment(100)],
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toBe("overpayment");
    expect(result.difference).toBe(20);
  });
});

describe("order-settlement · vuelto sin cambiar la deuda liquidada", () => {
  it("el vuelto no se suma: la deuda liquidada es el monto aplicado, no el efectivo recibido", () => {
    // Brief §35: el cliente entrega C$500 por un saldo de C$380 y se le devuelven C$120. Lo que liquida la
    // deuda son C$380. Si el vuelto contara como aplicado, el pedido quedaría sobrecobrado por C$120.
    const sinVuelto = validateExactSettlement({
      outstandingAmount: 380,
      payments: [payment(380)],
    });
    const conVuelto = validateExactSettlement({
      outstandingAmount: 380,
      payments: [payment(380, 120)],
    });

    expect(conVuelto).toEqual(sinVuelto);
    expect(conVuelto.ok).toBe(true);
  });
});

describe("order-settlement · saldo no liquidable", () => {
  it("un saldo de cero no se cobra: no hay nada que liquidar", () => {
    const result = validateExactSettlement({ outstandingAmount: 0, payments: [payment(100)] });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toBe("nothing-outstanding");
  });

  it("sin cobros no hay liquidación (y no es un underpayment)", () => {
    const result = validateExactSettlement({ outstandingAmount: 380, payments: [] });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toBe("no-payments");
  });

  it("un saldo negativo no se interpreta como a favor del cliente", () => {
    // `outstandingAmount` nunca debería ser negativo —lo garantiza `payments`—, pero si llegara, sumar
    // cobros contra él liquidaría una deuda inexistente.
    const result = validateExactSettlement({ outstandingAmount: -50, payments: [payment(0)] });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toBe("nothing-outstanding");
  });
});

describe("order-settlement · tolerancia de redondeo", () => {
  it("la tolerancia es un centavo y está declarada, no escondida", () => {
    // Un centavo: es la unidad mínima de las monedas de 2 decimales. La igualdad es exacta a nivel de
    // negocio; el margen existe sólo para el error de representación binaria de la suma.
    expect(SETTLEMENT_TOLERANCE).toBe(0.01);
  });

  it("una diferencia de un centavo se acepta; dos centavos no", () => {
    const unCentavo = validateExactSettlement({
      outstandingAmount: 380,
      payments: [payment(379.99)],
    });
    expect(unCentavo.ok).toBe(true);

    const dosCentavos = validateExactSettlement({
      outstandingAmount: 380,
      payments: [payment(379.98)],
    });
    expect(dosCentavos.ok).toBe(false);
    if (dosCentavos.ok) throw new Error("unreachable");
    expect(dosCentavos.reason).toBe("underpayment");
  });

  it("la suma con error de punto flotante no rompe la igualdad exacta", () => {
    // `0.1 + 0.2 !== 0.3` en binario: la suma se redondea antes de comparar, y el caso legítimo pasa.
    const result = validateExactSettlement({
      outstandingAmount: 0.3,
      payments: [payment(0.1), payment(0.2)],
    });

    expect(result.ok).toBe(true);
  });
});
