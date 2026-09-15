import { describe, expect, it } from "vitest";

import type { BusinessHours } from "@/modules/business-settings/domain/business-settings.types";
import {
  LOCATION_SLUG_PATTERN,
  normalizeLocationSlug,
  validateLocationInput,
  type LocationInput,
} from "@/modules/locations/domain/location-rules";

/**
 * T8 fase 2 — lo que el admin puede guardar de un local.
 *
 * El formulario muestra estos mensajes antes de guardar y el caso de uso los vuelve a
 * aplicar: si algo entra por la API sin pasar por la pantalla, se rechaza igual.
 */
const HOURS: BusinessHours = {
  mon: { open: "12:00", close: "22:00", closed: false },
  tue: { open: "12:00", close: "22:00", closed: false },
  wed: { open: "12:00", close: "22:00", closed: false },
  thu: { open: "12:00", close: "22:00", closed: false },
  fri: { open: "12:00", close: "22:00", closed: false },
  sat: { open: "12:00", close: "22:00", closed: false },
  sun: { open: "12:00", close: "22:00", closed: false },
};

function input(overrides: Partial<LocationInput> = {}): LocationInput {
  return {
    name: "Sucursal Norte",
    slug: "sucursal-norte",
    isActive: true,
    sortOrder: 1,
    addressLine: "Frente al parque",
    city: "Jinotepe",
    addressReference: null,
    mapsUrl: null,
    latitude: null,
    longitude: null,
    phone: null,
    whatsapp: "50588770888",
    businessHours: HOURS,
    pickupLeadMinutes: 25,
    pickupMaxMinutes: null,
    acceptAlertMinutes: 10,
    prepAlertMinutes: 15,
    isAcceptingOrders: true,
    posEnabled: true,
    closedMessage: null,
    ...overrides,
  };
}

describe("normalizeLocationSlug", () => {
  it("deja un slug prolijo a partir de lo que escriba el owner", () => {
    expect(normalizeLocationSlug("  Sucursal Norte  ")).toBe("sucursal-norte");
    expect(normalizeLocationSlug("Frente al Parque")).toBe("frente-al-parque");
    expect(normalizeLocationSlug("Sucursal--Norte")).toBe("sucursal-norte");
  });

  it("el patrón acepta lo que produce", () => {
    for (const value of ["norte", "sucursal-norte", "local-2", "a1"]) {
      expect(LOCATION_SLUG_PATTERN.test(value)).toBe(true);
    }
    for (const value of ["-norte", "norte-", "Norte", "con espacio", ""]) {
      expect(LOCATION_SLUG_PATTERN.test(value)).toBe(false);
    }
  });
});

describe("validateLocationInput", () => {
  it("acepta un local bien cargado", () => {
    expect(validateLocationInput(input())).toEqual({});
  });

  it("exige el nombre", () => {
    expect(validateLocationInput(input({ name: "" })).name).toContain("nombre");
    expect(validateLocationInput(input({ name: "  " })).name).toBeDefined();
    expect(validateLocationInput(input({ name: "A" })).name).toBeDefined();
  });

  it("exige un slug usable en una URL", () => {
    expect(validateLocationInput(input({ slug: "" })).slug).toBeDefined();
    // Con espacios o mayúsculas se **normaliza**, no se rechaza: el owner no tiene por
    // qué saber cómo se escribe un slug.
    expect(validateLocationInput(input({ slug: "Sucursal Norte" })).slug).toBeUndefined();
    // Lo que no se puede normalizar a nada sí es un error.
    expect(validateLocationInput(input({ slug: "-" })).slug).toBeDefined();
  });

  it("los minutos de preparación son los mismos que en la configuración", () => {
    expect(validateLocationInput(input({ pickupLeadMinutes: -1 })).pickupLeadMinutes).toBeDefined();
    expect(validateLocationInput(input({ pickupLeadMinutes: 181 })).pickupLeadMinutes).toContain(
      "180",
    );
    expect(validateLocationInput(input({ pickupLeadMinutes: 12.5 })).pickupLeadMinutes).toBeDefined();
  });

  /**
   * B5 — los umbrales con los que avisa el tablero de comandas de este local.
   *
   * Con límites: un aviso de 0 minutos marcaría todo atrasado desde el primer segundo, y uno de tres
   * horas no avisaría nunca dentro de un turno.
   */
  it("los avisos del tablero van de 1 a 120 minutos", () => {
    expect(
      validateLocationInput(input({ acceptAlertMinutes: 5, prepAlertMinutes: 30 })),
    ).toEqual({});

    expect(validateLocationInput(input({ acceptAlertMinutes: 0 })).acceptAlertMinutes).toBeDefined();
    expect(validateLocationInput(input({ prepAlertMinutes: 0 })).prepAlertMinutes).toBeDefined();
    expect(validateLocationInput(input({ acceptAlertMinutes: -5 })).acceptAlertMinutes).toBeDefined();
    expect(validateLocationInput(input({ prepAlertMinutes: 121 })).prepAlertMinutes).toContain("120");
    expect(validateLocationInput(input({ acceptAlertMinutes: 999 })).acceptAlertMinutes).toContain(
      "120",
    );
    expect(validateLocationInput(input({ acceptAlertMinutes: 7.5 })).acceptAlertMinutes).toBeDefined();
  });

  it("el rango no puede terminar antes de empezar", () => {    expect(
      validateLocationInput(input({ pickupLeadMinutes: 30, pickupMaxMinutes: 20 })).pickupMaxMinutes,
    ).toContain("mayor o igual");
    expect(
      validateLocationInput(input({ pickupLeadMinutes: 30, pickupMaxMinutes: 40 })).pickupMaxMinutes,
    ).toBeUndefined();
  });

  it("un horario incoherente se rechaza con el día señalado", () => {
    const errors = validateLocationInput(
      input({
        businessHours: { ...HOURS, wed: { open: "22:00", close: "12:00", closed: false } },
      }),
    );

    expect(errors.businessHours).toContain("miércoles");
  });

  it("un día cerrado no necesita horario coherente", () => {
    expect(
      validateLocationInput(
        input({
          businessHours: { ...HOURS, sun: { open: "00:00", close: "00:00", closed: true } },
        }),
      ).businessHours,
    ).toBeUndefined();
  });

  it("el WhatsApp es un dato del local y tiene que ser válido", () => {
    expect(validateLocationInput(input({ whatsapp: "abc" })).whatsapp).toContain("código de país");
    expect(validateLocationInput(input({ whatsapp: "50588770888" })).whatsapp).toBeUndefined();
    // Con espacios o con + se acepta: se normaliza al guardar.
    expect(validateLocationInput(input({ whatsapp: "+505 8877 0888" })).whatsapp).toBeUndefined();
    expect(validateLocationInput(input({ whatsapp: null })).whatsapp).toBeUndefined();
  });

  it("las coordenadas, si vienen, caen en el planeta", () => {
    expect(validateLocationInput(input({ latitude: 91 })).latitude).toBeDefined();
    expect(validateLocationInput(input({ longitude: -181 })).longitude).toBeDefined();
    expect(
      validateLocationInput(input({ latitude: 11.85, longitude: -86.2 })).latitude,
    ).toBeUndefined();
  });

  it("el orden de la lista no puede ser negativo", () => {
    expect(validateLocationInput(input({ sortOrder: -1 })).sortOrder).toBeDefined();
  });
});
