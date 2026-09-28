import { describe, expect, it } from "vitest";

import { OrderError } from "@/modules/orders/domain/order-errors";

import { parseRefundRequestPayload, parseRefundReviewPayload } from "./refunds-payload";

/**
 * Bloque 3 del roadmap del POS (Fase 2) — los payloads de devoluciones.
 *
 * El pedido de devolución necesita el cobro, el tipo (total o parcial), el monto, **el motivo** y —desde
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-73`)— la **clave de idempotencia**; la revisión necesita la decisión
 * y, si es un rechazo, también el motivo. La validación de forma vive acá (el `route.ts` tiene tope de 50
 * líneas); las reglas de plata viven en los casos de uso.
 */
describe("refunds payload", () => {
  it("acepta un pedido de devolución completo", () => {
    expect(
      parseRefundRequestPayload({
        paymentId: "pay_01",
        kind: "partial",
        amount: 200,
        reason: "Faltaba una bebida",
        idempotencyKey: "key_refund_1",
      }),
    ).toEqual({
      paymentId: "pay_01",
      kind: "partial",
      amount: 200,
      reason: "Faltaba una bebida",
      idempotencyKey: "key_refund_1",
    });
  });

  /**
   * `A-73` — sin clave, un reintento es indistinguible de una segunda devolución legítima y el sistema no
   * puede saber cuál es cuál: el cupo del cobro se consumiría dos veces. Por eso la clave es obligatoria.
   */
  it("rechaza un pedido de devolución sin clave de idempotencia", () => {
    expect(() =>
      parseRefundRequestPayload({
        paymentId: "pay_01",
        kind: "partial",
        amount: 200,
        reason: "Faltaba una bebida",
      }),
    ).toThrow(OrderError);
  });

  it.each([
    [{ kind: "partial", amount: 200, reason: "x", idempotencyKey: "k" }, "sin cobro"],
    [{ paymentId: "pay_01", kind: "todo", amount: 200, reason: "x", idempotencyKey: "k" }, "tipo inválido"],
    [{ paymentId: "pay_01", kind: "partial", amount: 0, reason: "x", idempotencyKey: "k" }, "monto cero"],
    [{ paymentId: "pay_01", kind: "partial", amount: 200, reason: "  ", idempotencyKey: "k" }, "sin motivo"],
    [{ paymentId: "pay_01", kind: "partial", amount: 200, reason: "x", idempotencyKey: "" }, "sin clave"],
  ])("rechaza %j (%s) con 422", (body: unknown, _motivo: string) => {
    expect(() => parseRefundRequestPayload(body)).toThrow(OrderError);
  });

  it("la revisión acepta aprobar sin nota y rechazar con motivo", () => {
    expect(parseRefundReviewPayload({ decision: "approved" })).toEqual({
      decision: "approved",
      note: null,
    });
    expect(
      parseRefundReviewPayload({ decision: "rejected", note: "No corresponde" }),
    ).toEqual({ decision: "rejected", note: "No corresponde" });
  });

  it.each([
    [{}, "sin decisión"],
    [{ decision: "maybe" }, "decisión inventada"],
    [{ decision: "rejected", note: "   " }, "rechazo sin motivo"],
  ])("rechaza %j (%s) con 422", (body: unknown, _motivo: string) => {
    expect(() => parseRefundReviewPayload(body)).toThrow(OrderError);
  });
});
