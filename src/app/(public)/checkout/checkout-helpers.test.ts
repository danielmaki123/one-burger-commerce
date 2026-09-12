import { describe, expect, it } from "vitest";

import {
  extractCheckoutErrorMessage,
  formatPublicOrderStatus,
  readAcceptanceReason,
} from "./checkout-helpers";

describe("readAcceptanceReason", () => {
  it("lee el motivo del rechazo operativo", () => {
    expect(
      readAcceptanceReason({ error: { fields: { acceptance: "pickup-time-in-past" } } }),
    ).toBe("pickup-time-in-past");
  });

  it("devuelve null cuando no es un rechazo operativo", () => {
    expect(readAcceptanceReason({ error: { fields: { customerName: "x" } } })).toBeNull();
    expect(readAcceptanceReason(null)).toBeNull();
    expect(readAcceptanceReason("texto")).toBeNull();
  });
});

describe("extractCheckoutErrorMessage", () => {
  it("traduce los errores por campo que el checkout puede provocar", () => {
    expect(extractCheckoutErrorMessage({ error: { fields: { customerName: "x" } } })).toBe(
      "Falta completar nombre.",
    );
    expect(
      extractCheckoutErrorMessage({ error: { fields: { customerWhatsapp: "x" } } }),
    ).toBe("Falta completar WhatsApp.");
    expect(extractCheckoutErrorMessage({ error: { fields: { pickupTime: "x" } } })).toBe(
      "Revisá la hora de retiro.",
    );
    expect(extractCheckoutErrorMessage({ error: { fields: { items: "x" } } })).toBe(
      "El carrito está vacío o incompleto.",
    );
  });

  it("muestra el motivo configurado cuando el servidor rechaza por estado operativo", () => {
    expect(
      extractCheckoutErrorMessage({
        error: {
          code: "CONFLICT",
          message: "Estamos cerrados. Podés mirar el menú y volver cuando abramos.",
          fields: { acceptance: "closed" },
        },
      }),
    ).toBe("Estamos cerrados. Podés mirar el menú y volver cuando abramos.");
  });

  it("no menciona entrega ni mesa: fuera del MVP", () => {
    const message = extractCheckoutErrorMessage({
      error: { fields: { address: "x", deliveryZoneId: "x", tableId: "x" } },
    });

    expect(message).not.toContain("entrega");
    expect(message).not.toContain("mesa");
  });

  it("cae a un mensaje genérico", () => {
    expect(extractCheckoutErrorMessage(null)).toBe(
      "No pudimos confirmar el pedido. Intentá de nuevo.",
    );
    expect(extractCheckoutErrorMessage({ error: { message: "Invalid payload" } })).toBe(
      "Revisá los datos del pedido.",
    );
  });
});

describe("formatPublicOrderStatus", () => {
  it("traduce los estados que ve el cliente", () => {
    expect(formatPublicOrderStatus("new")).toBe("Recibida");
    expect(formatPublicOrderStatus("preparing")).toBe("En preparación");
    expect(formatPublicOrderStatus("ready_for_pickup")).toBe("Lista para retirar");
    expect(formatPublicOrderStatus("picked_up")).toBe("Retirada");
  });

  it("devuelve el estado crudo si no lo conoce", () => {
    expect(formatPublicOrderStatus("weird")).toBe("weird");
  });
});
