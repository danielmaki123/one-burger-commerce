import { describe, expect, it } from "vitest";

import {
  extractCheckoutErrorMessage,
  formatPickupTimeIso,
  formatPublicOrderStatus,
} from "./checkout-helpers";

describe("formatPickupTimeIso", () => {
  it("convierte HH:mm a un ISO válido de hoy", () => {
    const iso = formatPickupTimeIso("19:30");

    expect(iso).not.toBeNull();
    const date = new Date(iso as string);
    expect(Number.isNaN(date.getTime())).toBe(false);
    expect(date.getHours()).toBe(19);
    expect(date.getMinutes()).toBe(30);
  });

  it("devuelve null con una hora inválida", () => {
    expect(formatPickupTimeIso("")).toBeNull();
    expect(formatPickupTimeIso("25:00")).toBeNull();
    expect(formatPickupTimeIso("19:70")).toBeNull();
    expect(formatPickupTimeIso("mediodía")).toBeNull();
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
