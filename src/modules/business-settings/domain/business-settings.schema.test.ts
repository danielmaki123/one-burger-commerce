import { describe, expect, it } from "vitest";

import { BusinessSettingsError } from "@/modules/business-settings/domain/business-settings-errors";
import { parseBusinessSettingsPatch } from "@/modules/business-settings/domain/business-settings.schema";

function expectFieldError(input: unknown, field: string) {
  try {
    parseBusinessSettingsPatch(input);
  } catch (error) {
    expect(error).toBeInstanceOf(BusinessSettingsError);
    const settingsError = error as BusinessSettingsError;
    expect(settingsError.status).toBe(422);
    expect(settingsError.code).toBe("VALIDATION_ERROR");
    const keys = Object.keys(settingsError.fields ?? {});
    expect(
      keys.some((key) => key === field || key.startsWith(`${field}.`)),
      `se esperaba un error en "${field}" pero llegaron: ${keys.join(", ") || "(ninguno)"}`,
    ).toBe(true);
    return;
  }

  throw new Error(`se esperaba un error de validación en "${field}"`);
}

describe("validación de la configuración del negocio", () => {
  it("acepta un parche vacío y devuelve un objeto vacío", () => {
    expect(parseBusinessSettingsPatch({})).toEqual({});
  });

  it("rechaza payloads que no son objetos", () => {
    expectFieldError("no soy un objeto", "form");
    expectFieldError(null, "form");
  });

  it("exige hex de 6 dígitos en los colores", () => {
    expect(parseBusinessSettingsPatch({ primaryColor: "#2B6C96" })).toEqual({
      primaryColor: "#2b6c96",
    });
    expectFieldError({ primaryColor: "azul" }, "primaryColor");
    expectFieldError({ primaryColor: "#12345" }, "primaryColor");
    expectFieldError({ primaryColor: "#12345g" }, "primaryColor");
    expectFieldError({ accentColor: "#abc" }, "accentColor");
  });

  it("exige E.164 con + en el teléfono y sin + en el WhatsApp", () => {
    expect(parseBusinessSettingsPatch({ phone: "+50588770888" })).toEqual({
      phone: "+50588770888",
    });
    expect(parseBusinessSettingsPatch({ whatsapp: "50588770888" })).toEqual({
      whatsapp: "50588770888",
    });
    expectFieldError({ phone: "50588770888" }, "phone");
    expectFieldError({ phone: "+505 8877 0888" }, "phone");
    expectFieldError({ whatsapp: "+50588770888" }, "whatsapp");
  });

  it("acepta URLs https o rutas relativas del sitio y rechaza http", () => {
    expect(parseBusinessSettingsPatch({ logoUrl: "https://cdn.test/logo.svg" })).toEqual({
      logoUrl: "https://cdn.test/logo.svg",
    });
    expect(parseBusinessSettingsPatch({ logoUrl: "/brand/one-burger-mark.svg" })).toEqual({
      logoUrl: "/brand/one-burger-mark.svg",
    });
    expectFieldError({ logoUrl: "http://cdn.test/logo.svg" }, "logoUrl");
    expectFieldError({ ogImageUrl: "ftp://cdn.test/og.png" }, "ogImageUrl");
    expectFieldError({ mapsUrl: "no-es-una-url" }, "mapsUrl");
  });

  it("valida las horas y acepta parches parciales de un día", () => {
    expect(
      parseBusinessSettingsPatch({
        businessHours: { mon: { closed: true, open: "22:00", close: "12:00" } },
      }),
    ).toEqual({ businessHours: { mon: { closed: true, open: "22:00", close: "12:00" } } });

    expectFieldError(
      { businessHours: { mon: { closed: false, open: "22:00", close: "12:00" } } },
      "businessHours",
    );
    expectFieldError({ businessHours: { mon: { closed: false, open: "12:00" } } }, "businessHours");
    expectFieldError(
      { businessHours: { mon: { closed: false, open: "25:00", close: "26:00" } } },
      "businessHours",
    );
    expectFieldError({ businessHours: {} }, "businessHours");
    expectFieldError(
      { businessHours: { lunes: { closed: false, open: "12:00", close: "22:00" } } },
      "businessHours",
    );
  });

  it("acota la anticipación del retiro entre 0 y 180 minutos", () => {
    expect(parseBusinessSettingsPatch({ pickupLeadMinutes: 0 })).toEqual({ pickupLeadMinutes: 0 });
    expect(parseBusinessSettingsPatch({ pickupLeadMinutes: 180 })).toEqual({ pickupLeadMinutes: 180 });
    expectFieldError({ pickupLeadMinutes: -1 }, "pickupLeadMinutes");
    expectFieldError({ pickupLeadMinutes: 181 }, "pickupLeadMinutes");
    expectFieldError({ pickupLeadMinutes: 12.5 }, "pickupLeadMinutes");
  });

  it("acota el rango de preparación y no acepta un máximo menor que el mínimo (T5)", () => {
    expect(parseBusinessSettingsPatch({ pickupMaxMinutes: 40 })).toEqual({
      pickupMaxMinutes: 40,
    });
    expect(
      parseBusinessSettingsPatch({ pickupLeadMinutes: 20, pickupMaxMinutes: 20 }),
    ).toEqual({ pickupLeadMinutes: 20, pickupMaxMinutes: 20 });
    // Vacío = sin rango: vuelve al comportamiento de un solo instante.
    expect(parseBusinessSettingsPatch({ pickupMaxMinutes: null })).toEqual({
      pickupMaxMinutes: null,
    });
    expectFieldError({ pickupMaxMinutes: 241 }, "pickupMaxMinutes");
    expectFieldError({ pickupMaxMinutes: -1 }, "pickupMaxMinutes");
    expectFieldError({ pickupMaxMinutes: 12.5 }, "pickupMaxMinutes");
    // Comparado contra el mínimo que viene en el mismo payload.
    expectFieldError({ pickupLeadMinutes: 30, pickupMaxMinutes: 20 }, "pickupMaxMinutes");
  });

  it("acota la propina entre 0 y 100 y exige entero", () => {
    expect(parseBusinessSettingsPatch({ tipRate: 0, tipEnabled: false })).toEqual({
      tipRate: 0,
      tipEnabled: false,
    });
    expectFieldError({ tipRate: 101 }, "tipRate");
    expectFieldError({ tipRate: 7.5 }, "tipRate");
  });

  /**
   * Tarea 2 del brief (2026-09-17) — el límite de retiro. Es un monto (no un porcentaje), vacío = sin
   * límite, y no puede ser negativo: un límite negativo marcaría todos los retiros.
   */
  it("valida el límite de retiro de caja", () => {
    expect(parseBusinessSettingsPatch({ withdrawalLimit: 1500 })).toEqual({ withdrawalLimit: 1500 });
    expect(parseBusinessSettingsPatch({ withdrawalLimit: null })).toEqual({ withdrawalLimit: null });
    expectFieldError({ withdrawalLimit: -1 }, "withdrawalLimit");
  });

  it("valida el tipo de cambio del dólar (TASK-303a)", () => {    // Es la casilla que el owner ajusta cuando se mueve el mercado; vacía = sin tasa cargada, y
    // entonces un cobro en dólares se rechaza en vez de convertir con un número inventado.
    expect(parseBusinessSettingsPatch({ usdExchangeRate: 36.5 })).toEqual({ usdExchangeRate: 36.5 });
    expect(parseBusinessSettingsPatch({ usdExchangeRate: null })).toEqual({ usdExchangeRate: null });
    expectFieldError({ usdExchangeRate: 0 }, "usdExchangeRate");
    expectFieldError({ usdExchangeRate: -1 }, "usdExchangeRate");
    expectFieldError({ usdExchangeRate: 100001 }, "usdExchangeRate");
  });

  it("valida moneda, locale y coordenadas", () => {
    expect(parseBusinessSettingsPatch({ currencyCode: "NIO", locale: "es-NI" })).toEqual({
      currencyCode: "NIO",
      locale: "es-NI",
    });
    expectFieldError({ currencyCode: "nio" }, "currencyCode");
    expectFieldError({ locale: "es_NI" }, "locale");
    expectFieldError({ latitude: 91 }, "latitude");
    expectFieldError({ longitude: -181 }, "longitude");
  });

  it("normaliza texto: recorta espacios, vacía a null y quita la arroba de las redes", () => {
    expect(
      parseBusinessSettingsPatch({
        name: "  One Burger  ",
        tagline: "   ",
        instagram: "@oneburger",
        facebook: "https://facebook.com/oneburger",
        tiktok: "  oneburger  ",
        phone: "  +50588770888  ",
      }),
    ).toEqual({
      name: "One Burger",
      tagline: null,
      instagram: "oneburger",
      facebook: "oneburger",
      tiktok: "oneburger",
      phone: "+50588770888",
    });
  });

  it("acepta las tres tipografías del build y rechaza una que no existe", () => {
    // T1.2: Plus Jakarta Sans entra como tercera opción (decisión D-A), sin
    // reemplazar a las dos que ya estaban.
    expect(parseBusinessSettingsPatch({ headingFont: "jakarta" })).toEqual({
      headingFont: "jakarta",
    });
    expect(parseBusinessSettingsPatch({ bodyFont: "jakarta" })).toEqual({ bodyFont: "jakarta" });
    expect(parseBusinessSettingsPatch({ headingFont: "fraunces", bodyFont: "inter" })).toEqual({
      headingFont: "fraunces",
      bodyFont: "inter",
    });
    expectFieldError({ headingFont: "comic-sans" }, "headingFont");
    expectFieldError({ bodyFont: "plus-jakarta-sans" }, "bodyFont");
  });

  it("exige un nombre no vacío y descarta claves desconocidas", () => {
    expectFieldError({ name: "   " }, "name");
    expect(parseBusinessSettingsPatch({ name: "One Burger", id: "otro", hackeado: true })).toEqual({
      name: "One Burger",
    });
  });

  /**
   * Factura simple (2026-09-18) — los **datos fiscales del negocio** (Personalización → «Datos fiscales»).
   *
   * Son opcionales y se guardan como los demás textos: un campo vacío se limpia (la factura no imprime esa
   * línea) y un dato que no sea texto no se cuela.
   */
  it("acepta los datos fiscales y limpia los vacíos", () => {
    expect(
      parseBusinessSettingsPatch({
        legalName: "One Burger S.A.",
        taxId: "J0310000123456",
        taxAddress: "Camino de Oriente, Managua",
        taxPhone: "+50588887777",
      }),
    ).toEqual({
      legalName: "One Burger S.A.",
      taxId: "J0310000123456",
      taxAddress: "Camino de Oriente, Managua",
      taxPhone: "+50588887777",
    });

    // Vacíos: se guardan como `null` (la línea no se imprime), no como cadena vacía.
    expect(
      parseBusinessSettingsPatch({ legalName: "", taxId: "   ", taxAddress: "", taxPhone: "" }),
    ).toEqual({ legalName: null, taxId: null, taxAddress: null, taxPhone: null });
  });
});
