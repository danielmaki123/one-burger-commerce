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

  /**
   * Fase 4 del checkout (D1) — el pedido puede ser para otro día.
   *
   * En cocina no es lo mismo "hoy 8:00 p. m." que "mañana 8:00 p. m.": sin el día, un
   * pedido programado para mañana se leería como uno de hoy y se empezaría a cocinar.
   */
  it("dice el día cuando el retiro no es hoy", () => {
    const nowMs = new Date("2026-09-11T18:00:00-06:00").getTime();

    // 2026-09-13T02:00Z = sábado 12 de septiembre, 8:00 p. m. en Managua (UTC-6).
    expect(
      describeAdminPickup({
        pickupTime: "2026-09-13T02:00:00.000Z",
        pickupScheduled: true,
        timeZone: "America/Managua",
        nowMs,
      }),
    ).toBe("Retiro mañana 8:00 p. m. · Programado");

    // 2026-09-19T02:00Z = viernes 18 de septiembre por la noche en Managua.
    expect(
      describeAdminPickup({
        pickupTime: "2026-09-19T02:00:00.000Z",
        pickupScheduled: true,
        timeZone: "America/Managua",
        nowMs,
      }),
    ).toContain("viernes 18 de septiembre");

    // El mismo día sigue leyéndose como siempre, sin día de por medio.
    expect(
      describeAdminPickup({
        pickupTime: "2026-09-12T02:00:00.000Z",
        pickupScheduled: true,
        timeZone: "America/Managua",
        nowMs: new Date("2026-09-11T23:00:00-06:00").getTime(),
      }),
    ).toBe("Retiro 8:00 p. m. · Programado");
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

  /**
   * El semáforo es contra la hora prometida **de hoy**: para un pedido de otro día no hay
   * cuenta regresiva que valga (decir "en 1440 min" no le sirve a nadie), así que no se
   * muestra la píldora y el día lo dice la etiqueta del retiro.
   */
  it("no cuenta los minutos de un retiro de otro día", () => {
    const timing = resolveAdminPickupTiming({
      pickupTime: "2026-09-13T02:00:00.000Z",
      status: "new",
      nowMs: new Date("2026-09-11T18:00:00-06:00").getTime(),
      timeZone: "America/Managua",
    });

    expect(timing.state).toBe("unknown");
    expect(timing.deltaLabel).toBe("");
  });

  it("un retiro de hoy sí cuenta los minutos", () => {
    const timing = resolveAdminPickupTiming({
      pickupTime: due,
      status: "new",
      nowMs: atMinutes(-30),
      timeZone: "America/Managua",
    });

    expect(timing.deltaLabel).toBe("en 30 min");
  });
});
