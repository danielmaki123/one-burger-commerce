import { describe, expect, it } from "vitest";

import {
  DEFAULT_LATE_MINUTES,
  DEFAULT_WARNING_MINUTES,
  LATE_EXTRA_MINUTES,
  resolveLocationThresholds,
  resolvePrepTargetMinutes,
} from "./order-location-thresholds";

/**
 * Los umbrales de un local, **una sola vez** (A-64).
 *
 * Es una regla de negocio del pedido —cuántos minutos puede esperar una comanda en cada familia de
 * etapas antes de avisar y de considerarse atrasada—, no una decisión de presentación: por eso vive en
 * `orders/domain` y la consumen la pantalla de Cocina, la de Pedidos y la proyección de la API.
 */

describe("umbrales por local", () => {
  it("sin configuración rigen los valores por defecto: 10 en la entrada, 15 en cocina", () => {
    expect(resolveLocationThresholds({})).toEqual({
      entry: { warningMinutes: DEFAULT_WARNING_MINUTES, lateMinutes: DEFAULT_WARNING_MINUTES + LATE_EXTRA_MINUTES },
      kitchen: { warningMinutes: DEFAULT_LATE_MINUTES, lateMinutes: DEFAULT_LATE_MINUTES + LATE_EXTRA_MINUTES },
    });
  });

  it("un local más lento mueve sus dos umbrales", () => {
    expect(
      resolveLocationThresholds({ acceptAlertMinutes: 5, prepAlertMinutes: 25 }),
    ).toEqual({
      entry: { warningMinutes: 5, lateMinutes: 10 },
      kitchen: { warningMinutes: 25, lateMinutes: 30 },
    });
  });

  it("un valor inservible no deja la pantalla sin umbral", () => {
    for (const accept of [null, undefined, 0, -3, Number.NaN]) {
      expect(
        resolveLocationThresholds({ acceptAlertMinutes: accept }).entry.warningMinutes,
        String(accept),
      ).toBe(DEFAULT_WARNING_MINUTES);
    }
    for (const prep of [null, undefined, 0, -3, Number.NaN]) {
      expect(
        resolveLocationThresholds({ prepAlertMinutes: prep }).kitchen.warningMinutes,
        String(prep),
      ).toBe(DEFAULT_LATE_MINUTES);
    }
  });

  it("el umbral de cocina es el «objetivo» de la cabecera de Cocina", () => {
    expect(resolvePrepTargetMinutes({ prepAlertMinutes: 18 })).toBe(18);
    // Sin local resoluble no se inventa un objetivo: rige el default del sistema.
    expect(resolvePrepTargetMinutes(null)).toBe(DEFAULT_LATE_MINUTES);
    expect(resolvePrepTargetMinutes(undefined)).toBe(DEFAULT_LATE_MINUTES);
    expect(resolvePrepTargetMinutes({ prepAlertMinutes: 0 })).toBe(DEFAULT_LATE_MINUTES);
  });
});
