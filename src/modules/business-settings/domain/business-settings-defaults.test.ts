import { describe, expect, it } from "vitest";

import {
  createDefaultBusinessSettingsRecord,
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_BUSINESS_SETTINGS,
} from "@/modules/business-settings/domain/business-settings-defaults";
import { WEEKDAY_KEYS } from "@/modules/business-settings/domain/business-settings.types";

describe("defaults de la configuración del negocio", () => {
  it("reproduce los valores que hoy están hardcodeados en el sitio público", () => {
    expect(DEFAULT_BUSINESS_SETTINGS.id).toBe("default");
    expect(DEFAULT_BUSINESS_SETTINGS.name).toBe("One Burger");
    expect(DEFAULT_BUSINESS_SETTINGS.phone).toBe("+50588770888");
    expect(DEFAULT_BUSINESS_SETTINGS.whatsapp).toBe("50588770888");
    expect(DEFAULT_BUSINESS_SETTINGS.instagram).toBe("oneburger");
    expect(DEFAULT_BUSINESS_SETTINGS.currencyCode).toBe("NIO");
    expect(DEFAULT_BUSINESS_SETTINGS.currencySymbol).toBe("C$");
    expect(DEFAULT_BUSINESS_SETTINGS.locale).toBe("es-NI");
    expect(DEFAULT_BUSINESS_SETTINGS.timezone).toBe("America/Managua");
  });

  it("reproduce los colores y las tipografías del sistema visual actual", () => {
    expect(DEFAULT_BUSINESS_SETTINGS.primaryColor).toBe("#2b6c96");
    expect(DEFAULT_BUSINESS_SETTINGS.accentColor).toBe("#eaf1f6");
    expect(DEFAULT_BUSINESS_SETTINGS.backgroundColor).toBe("#fbf9f5");
    expect(DEFAULT_BUSINESS_SETTINGS.foregroundColor).toBe("#23303a");
    expect(DEFAULT_BUSINESS_SETTINGS.surfaceColor).toBe("#ffffff");
    expect(DEFAULT_BUSINESS_SETTINGS.headingFont).toBe("fraunces");
    expect(DEFAULT_BUSINESS_SETTINGS.bodyFont).toBe("inter");
  });

  it("reproduce la propina opt-in del 10 % y el copy de pago actual", () => {
    expect(DEFAULT_BUSINESS_SETTINGS.tipEnabled).toBe(true);
    expect(DEFAULT_BUSINESS_SETTINGS.tipRate).toBe(10);
    expect(DEFAULT_BUSINESS_SETTINGS.isAcceptingOrders).toBe(true);
    expect(DEFAULT_BUSINESS_SETTINGS.paymentInstructions).toBe(
      "Pagás en el local al retirar tu pedido. No se cobra nada online.",
    );
  });

  it("abre todos los días de 12:00 a 22:00 como el horario que hoy muestra el sitio", () => {
    expect(Object.keys(DEFAULT_BUSINESS_HOURS).sort()).toEqual([...WEEKDAY_KEYS].sort());

    for (const weekday of WEEKDAY_KEYS) {
      expect(DEFAULT_BUSINESS_HOURS[weekday]).toEqual({
        closed: false,
        open: "12:00",
        close: "22:00",
      });
    }
  });

  it("crea una fila completa a partir de los defaults sin compartir los horarios", () => {
    const record = createDefaultBusinessSettingsRecord({ name: "Burger Nick" });

    expect(record).toMatchObject({
      id: "default",
      name: "Burger Nick",
      currencySymbol: "C$",
      updatedByUserId: null,
    });
    expect(record.updatedAt).toBeInstanceOf(Date);

    record.businessHours.mon.closed = true;
    expect(DEFAULT_BUSINESS_HOURS.mon.closed).toBe(false);
  });
});
