import { describe, expect, it } from "vitest";

import { mustCloseShiftBeforeCharging } from "./shift-close-policy";

/**
 * Tarea 3 del brief (2026-09-17) — **cierre obligatorio por sucursal** (1.7).
 *
 * La decisión del owner fue que el cierre obligatorio se configure **por sucursal**. Lo que hace la regla:
 * si el local lo pide y la caja quedó abierta con fecha de **otro día del negocio**, el POS no deja cobrar
 * hasta cerrarla. No al revés: con la caja de hoy se cobra normal, y sin caja abierta el bloqueo que ya
 * existe (Bloque 9.2) sigue diciendo «abrí la caja».
 *
 * El día es el del **negocio**, no el de UTC: un turno abierto a las 23:00 en Managua es del día anterior
 * aunque en UTC ya sea el día siguiente, y con la comparación ingenua el POS se bloquearía a la medianoche.
 */

const now = new Date("2026-09-17T14:00:00.000Z"); // 08:00 en Managua (UTC−6)

function check(overrides: Partial<Parameters<typeof mustCloseShiftBeforeCharging>[0]> = {}) {
  return mustCloseShiftBeforeCharging({
    requireShiftClose: true,
    openedAt: "2026-09-17T13:00:00.000Z",
    now,
    timezone: "America/Managua",
    ...overrides,
  });
}

describe("mustCloseShiftBeforeCharging", () => {
  it("una caja abierta hoy no bloquea nada", () => {
    expect(check()).toBe(false);
  });

  it("una caja que quedó abierta de otro día bloquea", () => {
    expect(check({ openedAt: "2026-09-16T13:00:00.000Z" })).toBe(true);
  });

  it("si el local no exige cierre, no bloquea aunque la caja sea vieja", () => {
    expect(check({ requireShiftClose: false, openedAt: "2026-09-01T13:00:00.000Z" })).toBe(false);
  });

  it("sin caja abierta no bloquea: de eso se encarga el aviso de «abrí la caja»", () => {
    expect(check({ openedAt: null })).toBe(false);
  });

  it("el día que cuenta es el del negocio: 23:00 en Managua sigue siendo hoy", () => {
    // 2026-09-18T05:00Z = 2026-09-17 23:00 en Managua: es del mismo día del negocio que `now`.
    expect(check({ openedAt: "2026-09-18T05:00:00.000Z" })).toBe(false);
  });

  it("una fecha ilegible no rompe el cobro", () => {
    expect(check({ openedAt: "no-es-fecha" })).toBe(false);
  });
});
