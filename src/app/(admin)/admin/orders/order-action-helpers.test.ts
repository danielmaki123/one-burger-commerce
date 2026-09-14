import { describe, expect, it } from "vitest";

import {
  buildStatusUpdateBody,
  canRejectOrder,
  describeOrderActionFailure,
  isRejectNoteValid,
  resolvePrimaryOrderAction,
} from "./order-action-helpers";

/**
 * B2 — los botones del flujo en la propia comanda.
 *
 * La regla de qué se puede hacer con un pedido **no se escribe acá**: sale de `order-workflows.ts`,
 * que es la que ya valida el servidor. Lo que estos helpers deciden es cómo se le cuenta a la
 * persona: una sola acción primaria por etapa, rechazar solo cuando la cancelación es válida y el
 * motivo obligatorio antes de mandar nada.
 */
describe("acción primaria de una comanda", () => {
  it("un pedido nuevo se acepta", () => {
    expect(resolvePrimaryOrderAction({ type: "pickup", status: "new" })).toEqual({
      status: "confirmed",
      label: "Aceptar",
    });
  });

  it("uno confirmado pasa a preparación", () => {
    expect(resolvePrimaryOrderAction({ type: "pickup", status: "confirmed" })).toEqual({
      status: "preparing",
      label: "Preparando",
    });
  });

  it("uno en preparación se termina", () => {
    expect(resolvePrimaryOrderAction({ type: "pickup", status: "preparing" })).toEqual({
      status: "ready_for_pickup",
      label: "Terminado",
    });
  });

  it("una comanda lista la entrega el mostrador", () => {
    expect(resolvePrimaryOrderAction({ type: "pickup", status: "ready_for_pickup" })).toEqual({
      status: "picked_up",
      label: "Entregada",
    });
  });

  it("una entregada se cierra", () => {
    expect(resolvePrimaryOrderAction({ type: "pickup", status: "picked_up" })).toEqual({
      status: "closed",
      label: "Cerrar",
    });
  });

  it("un pedido cerrado o cancelado no tiene acción", () => {
    expect(resolvePrimaryOrderAction({ type: "pickup", status: "closed" })).toBeNull();
    expect(resolvePrimaryOrderAction({ type: "pickup", status: "cancelled" })).toBeNull();
  });

  it("nunca ofrece cancelar como acción primaria", () => {
    for (const status of ["new", "confirmed", "preparing"] as const) {
      expect(resolvePrimaryOrderAction({ type: "pickup", status })?.status).not.toBe("cancelled");
    }
  });

  it("sigue el flujo que define el dominio para cada tipo de pedido", () => {
    expect(resolvePrimaryOrderAction({ type: "delivery", status: "preparing" })).toEqual({
      status: "ready",
      label: "Terminado",
    });
    expect(resolvePrimaryOrderAction({ type: "table", status: "new" })).toEqual({
      status: "accepted",
      label: "Aceptar",
    });
  });
});

describe("rechazar una comanda", () => {
  it("solo mientras el pedido todavía no salió a cocina", () => {
    expect(canRejectOrder({ type: "pickup", status: "new" })).toBe(true);
    expect(canRejectOrder({ type: "pickup", status: "confirmed" })).toBe(true);
    expect(canRejectOrder({ type: "pickup", status: "preparing" })).toBe(true);
  });

  it("no se rechaza algo ya listo, entregado o cancelado", () => {
    expect(canRejectOrder({ type: "pickup", status: "ready_for_pickup" })).toBe(false);
    expect(canRejectOrder({ type: "pickup", status: "picked_up" })).toBe(false);
    expect(canRejectOrder({ type: "pickup", status: "closed" })).toBe(false);
    expect(canRejectOrder({ type: "pickup", status: "cancelled" })).toBe(false);
  });

  it("el motivo es obligatorio de verdad: espacios no cuentan", () => {
    expect(isRejectNoteValid("")).toBe(false);
    expect(isRejectNoteValid("   ")).toBe(false);
    expect(isRejectNoteValid("Se quedó sin pan")).toBe(true);
  });
});

describe("cuerpo y errores de la llamada", () => {
  it("manda el motivo sin espacios sobrantes, y `null` cuando no hay", () => {
    expect(buildStatusUpdateBody("cancelled", "  Se quedó sin pan  ")).toEqual({
      status: "cancelled",
      note: "Se quedó sin pan",
    });
    expect(buildStatusUpdateBody("confirmed")).toEqual({ status: "confirmed", note: null });
    expect(buildStatusUpdateBody("cancelled", "   ")).toEqual({ status: "cancelled", note: null });
  });

  it("explica en castellano por qué falló, sin culpar a nadie", () => {
    expect(describeOrderActionFailure(409)).toMatch(/ya cambió de estado/i);
    expect(describeOrderActionFailure(403)).toMatch(/otra sucursal/i);
    expect(describeOrderActionFailure(401)).toMatch(/sesión/i);
    expect(describeOrderActionFailure(500)).toMatch(/no se pudo/i);
  });

  it("sin respuesta del servidor habla de la conexión, no del pedido", () => {
    expect(describeOrderActionFailure(0)).toMatch(/conexión/i);
  });
});
