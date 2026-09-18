import { describe, expect, it } from "vitest";

import {
  INVOICE_VOID_REASONS,
  describeInvoiceVoidReason,
  validateInvoiceVoidReason,
} from "./invoice-void";

/**
 * Anular una factura (Punto 2 del roadmap, 2026-09-18).
 *
 * Un documento entregado no se borra: se anula, y **por qué** se anuló es la mitad del dato. El motivo
 * sale de una lista cerrada —un texto libre no se puede agrupar ni auditar después— y solo «Otro» pide
 * que alguien escriba el motivo con sus palabras.
 */

describe("motivos de anulación", () => {
  it("son los cinco acordados, con «Otro» al final", () => {
    expect(INVOICE_VOID_REASONS).toEqual([
      "error_emision",
      "devolucion_cliente",
      "cancelacion_pedido",
      "correccion_datos",
      "otro",
    ]);
  });

  it("cada motivo se lee en español y «Otro» no inventa una etiqueta", () => {
    expect(describeInvoiceVoidReason("error_emision")).toBe("Error de emisión");
    expect(describeInvoiceVoidReason("devolucion_cliente")).toBe("Devolución al cliente");
    expect(describeInvoiceVoidReason("cancelacion_pedido")).toBe("Cancelación del pedido");
    expect(describeInvoiceVoidReason("correccion_datos")).toBe("Corrección de datos");
    expect(describeInvoiceVoidReason("otro")).toBe("Otro");
  });
});

describe("validateInvoiceVoidReason", () => {
  it("acepta un motivo de la lista, sin nota", () => {
    expect(validateInvoiceVoidReason({ reason: "correccion_datos" })).toEqual({
      ok: true,
      reason: "correccion_datos",
      note: null,
    });
  });

  it("rechaza un motivo que no está en la lista", () => {
    const result = validateInvoiceVoidReason({ reason: "porque-si" });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toMatch(/motivo/i);
  });

  it("rechaza la anulación sin motivo", () => {
    const result = validateInvoiceVoidReason({});

    expect(result.ok).toBe(false);
  });

  it("«Otro» exige que alguien escriba el motivo", () => {
    const sinNota = validateInvoiceVoidReason({ reason: "otro" });
    expect(sinNota.ok).toBe(false);
    expect(sinNota.ok === false && sinNota.message).toMatch(/escribí el motivo/i);

    const enBlanco = validateInvoiceVoidReason({ reason: "otro", note: "   " });
    expect(enBlanco.ok).toBe(false);
  });

  it("«Otro» guarda el texto sin espacios de sobra", () => {
    expect(
      validateInvoiceVoidReason({ reason: "otro", note: "  el cliente se arrepintió  " }),
    ).toEqual({
      ok: true,
      reason: "otro",
      note: "el cliente se arrepintió",
    });
  });

  it("no deja que la nota se vuelva un párrafo", () => {
    const largo = "x".repeat(201);
    const result = validateInvoiceVoidReason({ reason: "otro", note: largo });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toMatch(/200/);
  });

  it("en los motivos de la lista, la nota no se guarda: el motivo ya dice qué pasó", () => {
    expect(
      validateInvoiceVoidReason({ reason: "devolucion_cliente", note: "texto suelto" }),
    ).toEqual({ ok: true, reason: "devolucion_cliente", note: null });
  });
});
