import { describe, expect, it } from "vitest";

import { DEFAULT_BUSINESS_HOURS } from "@/modules/business-settings/domain/business-settings-defaults";
import {
  LOCATION_STATUS_LABELS,
  WEEKDAY_LABELS,
  createEmptyLocationForm,
  describeLocationAddress,
  describeLocationHours,
  locationFormToInput,
  locationToForm,
} from "./location-helpers";

/**
 * T8 fase 3 — lo que la pantalla de locales muestra y manda.
 *
 * El formulario trabaja con strings (es lo que devuelve un `<input>`), así que hay dos
 * traducciones que se prueban: lo guardado → formulario y formulario → payload.
 */
const principal = {
  id: "loc_principal",
  name: "Principal",
  slug: "principal",
  isActive: true,
  sortOrder: 0,
  addressLine: "Frente al parque",
  city: "Jinotepe",
  addressReference: null,
  mapsUrl: null,
  latitude: null,
  longitude: null,
  phone: null,
  whatsapp: "50588770888",
  businessHours: DEFAULT_BUSINESS_HOURS,
  pickupLeadMinutes: 25,
  pickupMaxMinutes: 40,
  acceptAlertMinutes: 10,
  prepAlertMinutes: 15,
  isAcceptingOrders: true,
  closedMessage: null,
  createdAt: "2026-09-12T00:00:00.000Z",
  updatedAt: "2026-09-12T00:00:00.000Z",
};

describe("etiquetas", () => {
  it("los días y los estados tienen su nombre en español", () => {
    expect(WEEKDAY_LABELS.mon).toBe("Lunes");
    expect(WEEKDAY_LABELS.sun).toBe("Domingo");
    expect(LOCATION_STATUS_LABELS.active).toBe("Activo");
    expect(LOCATION_STATUS_LABELS.inactive).toBe("Apagado");
  });
});

describe("describeLocationAddress", () => {
  it("junta la dirección con la ciudad", () => {
    expect(describeLocationAddress(principal)).toBe("Frente al parque, Jinotepe");
  });

  it("sin dirección cargada lo dice, no deja el hueco", () => {
    expect(describeLocationAddress({ ...principal, addressLine: null, city: null })).toBe(
      "Sin dirección cargada",
    );
    expect(describeLocationAddress({ ...principal, addressLine: null })).toBe("Jinotepe");
  });
});

describe("describeLocationHours", () => {
  it("resume el horario de hoy y avisa si hoy no abre", () => {
    // Sábado 12/09/2026 a las 12:00 en Managua.
    const saturday = new Date("2026-09-12T18:00:00.000Z");

    expect(describeLocationHours(principal, "America/Managua", saturday)).toBe(
      "Hoy 12:00 a 22:00",
    );

    expect(
      describeLocationHours(
        { ...principal, businessHours: { ...DEFAULT_BUSINESS_HOURS, sat: { open: "12:00", close: "22:00", closed: true } } },
        "America/Managua",
        saturday,
      ),
    ).toBe("Hoy cerrado");
  });
});

describe("locationFormToInput", () => {
  it("manda los números como números y los textos vacíos como null", () => {
    const input = locationFormToInput({
      ...createEmptyLocationForm(),
      name: "  Sucursal Norte  ",
      slug: "sucursal-norte",
      addressLine: "  ",
      city: "Jinotepe",
      latitude: "11.85",
      longitude: "-86.2",
      pickupLeadMinutes: "30",
      pickupMaxMinutes: "45",
      acceptAlertMinutes: "12",
      prepAlertMinutes: "18",
      whatsapp: "50588887777",
    });

    expect(input).toMatchObject({
      name: "Sucursal Norte",
      slug: "sucursal-norte",
      addressLine: null,
      city: "Jinotepe",
      latitude: 11.85,
      longitude: -86.2,
      pickupLeadMinutes: 30,
      pickupMaxMinutes: 45,
      acceptAlertMinutes: 12,
      prepAlertMinutes: 18,
      whatsapp: "50588887777",
    });
    // El horario viaja completo, día por día, como lo espera la API.
    expect(Object.keys(input.businessHours)).toHaveLength(7);
  });

  it("un rango vacío va como null, no como 0", () => {
    const input = locationFormToInput({ ...createEmptyLocationForm(), pickupMaxMinutes: "" });

    expect(input.pickupMaxMinutes).toBeNull();
  });
});

describe("locationToForm", () => {
  it("abre el formulario con lo guardado y vuelve igual", () => {
    const form = locationToForm(principal);

    expect(form).toMatchObject({
      name: "Principal",
      slug: "principal",
      pickupLeadMinutes: "25",
      pickupMaxMinutes: "40",
      acceptAlertMinutes: "10",
      prepAlertMinutes: "15",
      isActive: true,
      isAcceptingOrders: true,
    });

    const roundTrip = locationFormToInput(form);
    expect(roundTrip.name).toBe(principal.name);
    expect(roundTrip.slug).toBe(principal.slug);
    expect(roundTrip.pickupMaxMinutes).toBe(principal.pickupMaxMinutes);
    expect(roundTrip.businessHours).toEqual(principal.businessHours);
  });
});


