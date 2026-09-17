import { describe, expect, it } from "vitest";

import type { BusinessHours } from "@/modules/business-settings/domain/business-settings.types";
import type { LocationRecord } from "@/modules/locations/domain/location.types";

import { buildApplyHoursRequests } from "./apply-hours-helpers";

const HOURS: BusinessHours = {
  mon: { open: "12:00", close: "22:00", closed: false },
  tue: { open: "12:00", close: "22:00", closed: false },
  wed: { open: "12:00", close: "22:00", closed: false },
  thu: { open: "12:00", close: "22:00", closed: false },
  fri: { open: "12:00", close: "22:00", closed: false },
  sat: { open: "12:00", close: "22:00", closed: false },
  sun: { open: "12:00", close: "22:00", closed: true },
};

const NEW_HOURS: BusinessHours = {
  ...HOURS,
  mon: { open: "10:00", close: "20:00", closed: false },
};

function location(id: string, name: string, city: string): LocationRecord {
  return {
    id,
    name,
    slug: id,
    city,
    addressLine: `Calle ${name}`,
    addressReference: null,
    mapsUrl: null,
    latitude: null,
    longitude: null,
    phone: null,
    whatsapp: null,
    isActive: true,
    isAcceptingOrders: true,
    posEnabled: true,
    closedMessage: null,
    sortOrder: 0,
    pickupLeadMinutes: 25,
    pickupMaxMinutes: null,
    acceptAlertMinutes: 10,
    prepAlertMinutes: 15,
    businessHours: HOURS,
  } as LocationRecord;
}

describe("buildApplyHoursRequests", () => {
  it("deja afuera la sucursal que se está editando", () => {
    const requests = buildApplyHoursRequests(
      [location("a", "Principal", "Jinotepe"), location("b", "Norte", "Diriamba")],
      "a",
      NEW_HOURS,
    );

    expect(requests.map((request) => request.id)).toEqual(["b"]);
  });

  it("manda el local completo con el horario nuevo y sin tocar lo demás", () => {
    const requests = buildApplyHoursRequests(
      [location("a", "Principal", "Jinotepe"), location("b", "Norte", "Diriamba")],
      "a",
      NEW_HOURS,
    );

    const payload = requests[0]!.payload as Record<string, unknown>;

    expect(payload.businessHours).toEqual(NEW_HOURS);
    expect(payload.name).toBe("Norte");
    expect(payload.city).toBe("Diriamba");
    expect(payload.pickupLeadMinutes).toBe(25);
  });

  it("con una sola sucursal no hay nada que aplicar", () => {
    expect(buildApplyHoursRequests([location("a", "Principal", "Jinotepe")], "a", NEW_HOURS)).toEqual(
      [],
    );
  });
});
