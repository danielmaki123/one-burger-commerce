import { describe, expect, it } from "vitest";

import {
  PAYMENT_VOID_REASON_MAX_LENGTH,
  validatePaymentVoidReason,
} from "@/modules/orders/domain/payment-void";

/**
 * TASK-AUD-059 — el motivo con el que se **anula un cobro**.
 *
 * Anular un cobro es una decisión sobre plata: la fila no se borra, se marca con quién, cuándo y **por
 * qué**. Por eso el motivo es obligatorio y tiene que ser algo que se pueda leer seis meses después: una
 * frase, no una letra ni un párrafo pegado de otro lado. La anulación de una factura usa una lista
 * cerrada de motivos porque el negocio los definió; acá no hay lista, así que el único control posible
 * es que el motivo exista y tenga forma de explicación.
 */
describe("validatePaymentVoidReason", () => {
  it("rechaza el motivo vacío: la anulación no se puede firmar sin decir por qué", () => {
    const check = validatePaymentVoidReason({});

    expect(check.ok).toBe(false);
    expect(check.ok === false && check.message).toContain("por qué");
  });

  it("rechaza un motivo que solo tiene espacios", () => {
    expect(validatePaymentVoidReason({ reason: "    " }).ok).toBe(false);
  });

  it("rechaza un motivo demasiado corto para explicar nada", () => {
    const check = validatePaymentVoidReason({ reason: "ok" });

    expect(check.ok).toBe(false);
    expect(check.ok === false && check.message).toContain("corto");
  });

  it("rechaza lo que no es texto", () => {
    expect(validatePaymentVoidReason({ reason: 12345 }).ok).toBe(false);
    expect(validatePaymentVoidReason({ reason: null }).ok).toBe(false);
  });

  it("acepta un motivo con forma de explicación y lo guarda recortado", () => {
    const check = validatePaymentVoidReason({ reason: "  cobro duplicado de la mesa 4  " });

    expect(check).toEqual({ ok: true, reason: "cobro duplicado de la mesa 4" });
  });

  it("rechaza un motivo que no entra en el registro", () => {
    expect(
      validatePaymentVoidReason({ reason: "x".repeat(PAYMENT_VOID_REASON_MAX_LENGTH + 1) }).ok,
    ).toBe(false);
    expect(
      validatePaymentVoidReason({ reason: "x".repeat(PAYMENT_VOID_REASON_MAX_LENGTH) }).ok,
    ).toBe(true);
  });
});
