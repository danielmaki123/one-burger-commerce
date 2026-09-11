import { describe, expect, it } from "vitest";

import type { BusinessHours } from "@/modules/business-settings/domain/business-settings.types";

import { resolveOrderAcceptance } from "./order-acceptance";

/** `-06:00` es la zona de Managua, sin horario de verano. 2026-09-11 es viernes. */
function managua(isoDay: string, hhmm: string): Date {
  return new Date(`${isoDay}T${hhmm}:00-06:00`);
}

function hoursWith(overrides: Partial<BusinessHours["fri"]> = {}): BusinessHours {
  const day = { closed: false, open: "12:00", close: "22:00", ...overrides };

  return {
    mon: { ...day },
    tue: { ...day },
    wed: { ...day },
    thu: { ...day },
    fri: { ...day },
    sat: { ...day },
    sun: { ...day },
  };
}

const base = {
  isAcceptingOrders: true,
  closedMessage: "Estamos cerrados. Podés mirar el menú y volver cuando abramos.",
  businessHours: hoursWith(),
  timezone: "America/Managua",
  pickupLeadMinutes: 25,
  now: managua("2026-09-11", "19:00"),
};

describe("resolveOrderAcceptance", () => {
  it("acepta un pedido dentro del horario", () => {
    expect(
      resolveOrderAcceptance({ ...base, pickupTime: managua("2026-09-11", "20:00") }),
    ).toEqual({ accepted: true });
  });

  it("acepta la hora exacta de cierre", () => {
    expect(
      resolveOrderAcceptance({ ...base, pickupTime: managua("2026-09-11", "22:00") }),
    ).toEqual({ accepted: true });
  });

  it("rechaza si el negocio no está aceptando pedidos", () => {
    const result = resolveOrderAcceptance({
      ...base,
      isAcceptingOrders: false,
      pickupTime: managua("2026-09-11", "20:00"),
    });

    expect(result).toEqual({
      accepted: false,
      reason: "not-accepting-orders",
      message: "Estamos cerrados. Podés mirar el menú y volver cuando abramos.",
    });
  });

  it("usa un mensaje de respaldo si el negocio no configuró uno", () => {
    const result = resolveOrderAcceptance({
      ...base,
      isAcceptingOrders: false,
      closedMessage: null,
      pickupTime: managua("2026-09-11", "20:00"),
    });

    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.message).toContain("no estamos aceptando pedidos");
  });

  it("rechaza una hora de retiro que ya pasó", () => {
    const result = resolveOrderAcceptance({
      ...base,
      pickupTime: managua("2026-09-11", "18:00"),
    });

    expect(result).toEqual({
      accepted: false,
      reason: "pickup-time-in-past",
      message: "La hora de retiro elegida ya pasó. Elegí una nueva.",
    });
  });

  it("rechaza una hora antes de abrir", () => {
    const result = resolveOrderAcceptance({
      ...base,
      now: managua("2026-09-11", "08:00"),
      pickupTime: managua("2026-09-11", "09:00"),
    });

    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.reason).toBe("closed");
    expect(result.message).toBe(base.closedMessage);
  });

  it("rechaza una hora después de cerrar", () => {
    const result = resolveOrderAcceptance({
      ...base,
      pickupTime: managua("2026-09-11", "23:00"),
    });

    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.reason).toBe("closed");
  });

  it("rechaza si el local está cerrado ese día", () => {
    const result = resolveOrderAcceptance({
      ...base,
      businessHours: hoursWith({ closed: true }),
      pickupTime: managua("2026-09-11", "20:00"),
    });

    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.reason).toBe("closed");
  });

  it("rechaza un horario incoherente en vez de aceptar cualquier cosa", () => {
    const result = resolveOrderAcceptance({
      ...base,
      businessHours: hoursWith({ open: "22:00", close: "02:00" }),
      pickupTime: managua("2026-09-11", "23:00"),
    });

    expect(result.accepted).toBe(false);
  });

  it("sin hora de retiro evalúa lo antes posible (ahora + preparación)", () => {
    // 21:50 + 25 min = 22:15, después del cierre.
    const result = resolveOrderAcceptance({
      ...base,
      now: managua("2026-09-11", "21:50"),
      pickupTime: null,
    });

    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.reason).toBe("closed");
  });

  it("evalúa el horario del día de retiro, no el de hoy", () => {
    const hours = hoursWith();
    // El sábado abre más tarde: 13:00 - 22:00.
    hours.sat = { closed: false, open: "13:00", close: "22:00" };

    // Son las 23:00 del viernes y el retiro es el sábado a las 13:00.
    const result = resolveOrderAcceptance({
      ...base,
      businessHours: hours,
      now: managua("2026-09-11", "23:00"),
      pickupTime: managua("2026-09-12", "13:00"),
    });

    expect(result).toEqual({ accepted: true });
  });

  it("rechaza el sábado a las 12:00 cuando el sábado abre a las 13:00", () => {
    const hours = hoursWith();
    hours.sat = { closed: false, open: "13:00", close: "22:00" };

    const result = resolveOrderAcceptance({
      ...base,
      businessHours: hours,
      now: managua("2026-09-11", "23:00"),
      pickupTime: managua("2026-09-12", "12:00"),
    });

    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.reason).toBe("closed");
  });
});
