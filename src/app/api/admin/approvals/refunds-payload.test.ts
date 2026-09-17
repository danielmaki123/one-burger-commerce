import { describe, expect, it } from "vitest";

import { OrderError } from "@/modules/orders/domain/order-errors";

import { parseRefundRequestPayload, parseRefundReviewPayload } from "./refunds-payload";

/**
 * Bloque 3 del roadmap del POS (Fase 2) — los payloads de devoluciones.
 *
 * El pedido de devolución necesita el cobro, el tipo (total o parcial), el monto y **el motivo**; la
 * revisión necesita la decisión y, si es un rechazo, también el motivo. La validación de forma vive
 * acá (el `route.ts` tiene tope de 50 líneas); las reglas de plata viven en los casos de uso.
 */
describe("refunds payload", () => {
  it("acepta un pedido de devolución completo", () => {
    expect(
      parseRefundRequestPayload({
        paymentId: "pay_01",
        kind: "partial",
        amount: 200,
        reason: "Faltaba una bebida",
      }),
    ).toEqual({
      paymentId: "pay_01",
      kind: "partial",
      amount: 200,
      reason: "Faltaba una bebida",
    });
  });

  it.each([
    [{ kind: "partial", amount: 200, reason: "x" }, "sin cobro"],
    [{ paymentId: "pay_01", kind: "todo", amount: 200, reason: "x" }, "tipo inválido"],
    [{ paymentId: "pay_01", kind: "partial", amount: 0, reason: "x" }, "monto cero"],
    [{ paymentId: "pay_01", kind: "partial", amount: 200, reason: "  " }, "sin motivo"],
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
