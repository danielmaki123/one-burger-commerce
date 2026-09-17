import { describe, expect, it } from "vitest";

import { WEEKDAY_KEYS } from "@/modules/business-settings/domain/business-settings.types";
import type { LocationRecord } from "@/modules/locations/domain/location.types";

import { listCashLocations, resolveCashLocationId } from "./cash-locations";

const BUSINESS_HOURS = Object.fromEntries(
  WEEKDAY_KEYS.map((day) => [day, { closed: false, open: "12:00", close: "22:00" }]),
) as LocationRecord["businessHours"];

function location(overrides: Partial<LocationRecord> & { id: string; name: string }): LocationRecord {
  return {
    slug: overrides.id,
    isActive: true,
    sortOrder: 0,
    addressLine: null,
    city: null,
    addressReference: null,
    mapsUrl: null,
    latitude: null,
    longitude: null,
    phone: null,
    whatsapp: null,
    businessHours: BUSINESS_HOURS,
    pickupLeadMinutes: 20,
    pickupMaxMinutes: 40,
    acceptAlertMinutes: 5,
    prepAlertMinutes: 15,
    isAcceptingOrders: true,
    posEnabled: true,
    requireShiftClose: false,
    closedMessage: null,
    createdAt: "2026-09-12T00:00:00.000Z",
    updatedAt: "2026-09-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("cash locations", () => {
  /**
   * Bloque 1.3 del roadmap del POS (Fase 2).
   *
   * El historial de caja no puede filtrar por "local activo con POS prendido" como el mostrador: un
   * turno de ayer en una sucursal que hoy está apagada **se contó igual**, y esconderlo borraría plata
   * del historial. Lo que sí manda es el alcance por sucursal.
   */
  it("incluye locales apagados o con el POS apagado: su historial existe igual", () => {
    const locations = [
      location({ id: "loc_principal", name: "Principal" }),
      location({ id: "loc_masaya", name: "Masaya", isActive: false }),
      location({ id: "loc_casa", name: "Casa Antigua", posEnabled: false }),
    ];

    expect(listCashLocations(locations, { kind: "all" }).map((item) => item.id)).toEqual([
      "loc_principal",
      "loc_masaya",
      "loc_casa",
    ]);
  });

  it("respeta el alcance por sucursal del staff", () => {
    const locations = [
      location({ id: "loc_principal", name: "Principal" }),
      location({ id: "loc_masaya", name: "Masaya" }),
    ];

    expect(
      listCashLocations(locations, { kind: "restricted", locationIds: ["loc_masaya"] }).map(
        (item) => item.id,
      ),
    ).toEqual(["loc_masaya"]);
  });

  it("el local pedido solo vale si está en el alcance; si no, cae al primero", () => {
    const locations = [
      location({ id: "loc_principal", name: "Principal" }),
      location({ id: "loc_masaya", name: "Masaya" }),
    ];

    expect(resolveCashLocationId(locations, "loc_masaya")).toBe("loc_masaya");
    // Pedir una sucursal ajena no es un error: se muestra la primera a la que sí tiene acceso.
    expect(resolveCashLocationId(locations, "loc_ajena")).toBe("loc_principal");
    expect(resolveCashLocationId(locations, "  ")).toBe("loc_principal");
    expect(resolveCashLocationId([], "loc_principal")).toBeNull();
  });
});
