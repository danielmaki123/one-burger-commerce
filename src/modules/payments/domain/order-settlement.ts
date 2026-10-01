import { roundCurrency } from "@/modules/money/domain/round-currency";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §29, §31, §34, §35) — **la liquidación comercial del saldo**.
 *
 * Es la regla de dinero que el checkout del POS tiene que cumplir, y vive en `payments` porque es el módulo
 * dueño de lo financiero. El POS la **consume**; no la reimplementa ni decide «pagado» con lo que tiene a
 * mano.
 *
 * Una sola igualdad, y no se negocia:
 *
 * ```text
 * Σ monto aplicado == outstandingAmount
 * ```
 *
 * De ahí salen las dos prohibiciones que el brief subraya:
 *
 * 1. **No existe el abono comercial.** El POS no ofrece «debe C$1000, cobrá C$300 y dejá C$700 para
 *    después» (brief §31). Una liquidación parcial no es una operación del mostrador: el saldo se liquida o
 *    no se toca. `partial` sigue existiendo en `payments` —legacy, anulación, devolución, datos anómalos—,
 *    pero no se produce desde acá.
 * 2. **No hay sobrecobro.** Hoy un cobro partido acepta un caso equivalente a «venta C$80, efectivo C$50,
 *    tarjeta C$50» y termina sin explicar los C$20 extra (`A-93`). Con esta regla ese checkout se rechaza
 *    **antes de persistir**: cero cambios financieros.
 *
 * El monto que se suma es el **equivalente en moneda base ya congelado** (`baseAmount` del snapshot). El
 * dominio no convierte nada: multiplicar por una tasa acá sería inventar FX y duplicar la autoridad de
 * `money` (brief §41). Y el **vuelto no se suma** (brief §35): lo que liquida la deuda es lo aplicado, no
 * el efectivo que el cliente puso sobre el mostrador.
 */

/**
 * El margen de comparación, en moneda base: **un centavo**, la unidad mínima de las monedas de 2 decimales.
 *
 * Existe sólo para el error de representación binaria de una suma (`0.1 + 0.2` no es `0.3` exactamente);
 * **no** es una licencia para dejar un saldo vivo. La igualdad de negocio es exacta y así la fija el test.
 */
export const SETTLEMENT_TOLERANCE = 0.01;

/** Lo mínimo que un cobro tiene que aportar para poder liquidar: su equivalente ya congelado. */
export type SettlementPayment = {
  /** El equivalente en moneda base del snapshot (`D-020`). */
  baseAmount: number;
  /** El vuelto que salió del cajón con este cobro. **No** se suma: se conserva para el arqueo. */
  changeAmount?: number;
};

export type ExactSettlementInput = {
  /** Lo que falta cubrir, en moneda base: `max(0, total − paidAmount)` de `payments`. */
  outstandingAmount: number;
  payments: readonly SettlementPayment[];
};

export type ExactSettlementFailureReason =
  | "nothing-outstanding"
  | "no-payments"
  | "underpayment"
  | "overpayment";

export type ExactSettlementResult =
  | {
      ok: true;
      /** El total aplicado, en moneda base. Es igual al saldo. */
      appliedAmount: number;
      difference: 0;
    }
  | {
      ok: false;
      reason: ExactSettlementFailureReason;
      appliedAmount: number;
      /**
       * La distancia al saldo, **siempre positiva**: lo que falta (`underpayment`) o lo que sobra
       * (`overpayment`). En los otros motivos es la distancia al cero.
       */
      difference: number;
    };

/**
 * Valida que un conjunto de cobros liquide **exactamente** el saldo.
 *
 * Devuelve el motivo cuando no liquida, para que la superficie pueda decir **qué** arreglar («faltan
 * C$500» / «se pasa por C$20») en vez de un «monto inválido» que deja al cajero sin saber qué hacer.
 */
export function validateExactSettlement(input: ExactSettlementInput): ExactSettlementResult {
  const outstanding = roundCurrency(input.outstandingAmount);

  if (outstanding <= SETTLEMENT_TOLERANCE) {
    return {
      ok: false,
      reason: "nothing-outstanding",
      appliedAmount: 0,
      difference: roundCurrency(Math.abs(outstanding)),
    };
  }

  if (input.payments.length === 0) {
    return {
      ok: false,
      reason: "no-payments",
      appliedAmount: 0,
      difference: outstanding,
    };
  }

  const appliedAmount = roundCurrency(
    input.payments.reduce((sum, payment) => sum + payment.baseAmount, 0),
  );

  const rawDifference = appliedAmount - outstanding;

  // Dentro del centavo es una liquidación exacta: la igualdad de negocio se cumple.
  if (Math.abs(rawDifference) <= SETTLEMENT_TOLERANCE) {
    return { ok: true, appliedAmount, difference: 0 };
  }

  return rawDifference < 0
    ? {
        ok: false,
        reason: "underpayment",
        appliedAmount,
        difference: roundCurrency(Math.abs(rawDifference)),
      }
    : {
        ok: false,
        reason: "overpayment",
        appliedAmount,
        difference: roundCurrency(rawDifference),
      };
}
