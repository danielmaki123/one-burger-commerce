import { describe, expect, it } from "vitest";

import { WEEKDAY_KEYS } from "@/modules/business-settings/domain/business-settings.types";
import type { LocationRecord } from "@/modules/locations/domain/location.types";

import { requireCashScope } from "./cash-route-helpers";

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

const repository = {
  async listLocations() {
    return [
      location({ id: "loc_principal", name: "Principal" }),
      location({ id: "loc_masaya", name: "Masaya" }),
    ];
  },
};

describe("cash route helpers", () => {
  /**
   * Bloque 7 del roadmap del POS (Fase 2) — ver la caja no es cobrar en ella.
   *
   * El cajero tiene `canUsePOS` (abre, cobra y cierra su turno) pero no `canManageCash`: el historial
   * de cierres lo mira quien audita. Cocina queda afuera por la misma razón que en el POS.
   */
  it.each(["cashier", "kitchen"] as const)("rechaza a %s con 403", async (role) => {
    await expect(
      requireCashScope({ role, assignedLocationIds: null }, { repository }),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("el dueño ve todos los locales, incluidos los que hoy no están activos", async () => {
    const locations = await requireCashScope({ role: "owner" }, { repository });

    expect(locations.map((item) => item.id)).toEqual(["loc_principal", "loc_masaya"]);
  });

  it("un manager con sucursales asignadas solo ve las suyas", async () => {
    const locations = await requireCashScope(
      { role: "manager", assignedLocationIds: ["loc_masaya"] },
      { repository },
    );

    expect(locations.map((item) => item.id)).toEqual(["loc_masaya"]);
  });
});
