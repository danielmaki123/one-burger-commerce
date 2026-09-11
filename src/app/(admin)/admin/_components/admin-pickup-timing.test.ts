import { describe, expect, it } from "vitest";

import { describeAdminPickup, resolveAdminPickupTiming } from "./admin-pickup-timing";

describe("describeAdminPickup", () => {
  const due = "2026-09-12T02:00:00.000Z"; // 8:00 p. m. en Managua

  it("distingue un pedido programado de uno lo antes posible", () => {
    expect(
      describeAdminPickup({ pickupTime: due, pickupScheduled: true, timeZone: "America/Managua" }),
    ).toBe("Retiro 8:00 p. m. · Programado");
    expect(
      describeAdminPickup({
        pickupTime: due,
        pickupScheduled: false,
        timeZone: "America/Managua",
      }),
    ).toBe("Retiro ~8:00 p. m. · Lo antes posible");
  });

  it("no inventa nada si el pedido no tiene hora", () => {
    expect(
      describeAdminPickup({ pickupTime: null, timeZone: "America/Managua" }),
    ).toBeNull();
    expect(
      describeAdminPickup({ pickupTime: "no-es-fecha", timeZone: "America/Managua" }),
    ).toBeNull();
  });
});

const due = "2026-09-11T20:00:00-06:00";

function atMinutes(offset: number): number {
  return new Date(due).getTime() + offset * 60_000;
}

describe("resolveAdminPickupTiming", () => {
  it("está en verde mientras falta para la hora prometida", () => {
    const timing = resolveAdminPickupTiming({
      pickupTime: due,
      status: "new",
      nowMs: atMinutes(-30),
    });

    expect(timing.state).toBe("on-time");
    expect(timing.deltaLabel).toBe("en 30 min");
  });

  it("a la hora exacta sigue en verde", () => {
    const timing = resolveAdminPickupTiming({
      pickupTime: due,
      status: "new",
      nowMs: atMinutes(0),
    });

    expect(timing.state).toBe("on-time");
    expect(timing.deltaLabel).toBe("ahora");
  });

  it("pasada la hora pasa a naranja", () => {
    const timing = resolveAdminPickupTiming({
      pickupTime: due,
      status: "new",
      nowMs: atMinutes(5),
    });

    expect(timing.state).toBe("past");
    expect(timing.deltaLabel).toBe("hace 5 min");
  });

  it("a los 15 minutos pasa a rojo", () => {
    const timing = resolveAdminPickupTiming({
      pickupTime: due,
      status: "preparing",
      nowMs: atMinutes(15),
    });

    expect(timing.state).toBe("late");
  });

  it("un pedido ya cerrado no alarma", () => {
    const timing = resolveAdminPickupTiming({
      pickupTime: due,
      status: "closed",
      nowMs: atMinutes(90),
    });

    expect(timing.state).toBe("done");
  });

  it("un pedido retirado tampoco alarma", () => {
    const timing = resolveAdminPickupTiming({
      pickupTime: due,
      status: "picked_up",
      nowMs: atMinutes(90),
    });

    expect(timing.state).toBe("done");
  });

  it("un pedido cancelado tampoco alarma", () => {
    const timing = resolveAdminPickupTiming({
      pickupTime: due,
      status: "cancelled",
      nowMs: atMinutes(90),
    });

    expect(timing.state).toBe("done");
  });

  it("sin hora de retiro no inventa una alarma", () => {
    const timing = resolveAdminPickupTiming({
      pickupTime: null,
      status: "new",
      nowMs: atMinutes(90),
    });

    expect(timing.state).toBe("unknown");
    expect(timing.deltaLabel).toBe("");
  });

  it("aguanta una hora inválida sin romper la bandeja", () => {
    const timing = resolveAdminPickupTiming({
      pickupTime: "no-es-una-fecha",
      status: "new",
      nowMs: atMinutes(0),
    });

    expect(timing.state).toBe("unknown");
  });
});
