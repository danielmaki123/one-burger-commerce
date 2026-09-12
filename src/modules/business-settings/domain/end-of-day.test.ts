import { describe, expect, it } from "vitest";

import {
  dateOnlyInTimeZone,
  endOfDayInTimeZone,
} from "@/modules/business-settings/domain/end-of-day";

/**
 * El admin elige "vence el 31/12" con un `<input type="date">`, que manda solo la
 * fecha. Guardar eso como 31/12 00:00 UTC haría que la promo dejara de servir a las
 * 18:00 del 30 en Nicaragua. Acá la fecha se convierte al **final del día en la zona
 * del negocio**, que es lo que el owner quiso decir.
 */
describe("endOfDayInTimeZone", () => {
  it("una fecha sin hora termina al final de ese día en la zona del negocio", () => {
    // Managua es UTC-6 todo el año: el día 31 termina a las 05:59:59.999 UTC del 1.
    expect(endOfDayInTimeZone("2026-12-31", "America/Managua")).toBe("2027-01-01T05:59:59.999Z");
    expect(endOfDayInTimeZone("2026-01-01", "America/Managua")).toBe("2026-01-02T05:59:59.999Z");
  });

  it("respeta zonas con horario de verano", () => {
    // Madrid en agosto es UTC+2; en enero, UTC+1.
    expect(endOfDayInTimeZone("2026-08-15", "Europe/Madrid")).toBe("2026-08-15T21:59:59.999Z");
    expect(endOfDayInTimeZone("2026-01-15", "Europe/Madrid")).toBe("2026-01-15T22:59:59.999Z");
  });

  it("una fecha imposible no inventa un vencimiento", () => {
    expect(endOfDayInTimeZone("13/12/2026", "America/Managua")).toBeNull();
    expect(endOfDayInTimeZone("", "America/Managua")).toBeNull();
    expect(endOfDayInTimeZone("2026-12-31T10:00:00.000Z", "America/Managua")).toBeNull();
  });

  it("una zona desconocida cae a UTC en vez de romper el guardado", () => {
    expect(endOfDayInTimeZone("2026-12-31", "No/Existe")).toBe("2026-12-31T23:59:59.999Z");
  });
});

describe("dateOnlyInTimeZone", () => {
  it("vuelve del instante guardado a la fecha que eligió el owner", () => {
    // Ida y vuelta: lo que se guarda se tiene que poder volver a mostrar igual.
    expect(dateOnlyInTimeZone("2027-01-01T05:59:59.999Z", "America/Managua")).toBe("2026-12-31");
    expect(dateOnlyInTimeZone("2026-12-31T23:59:59.999Z", "UTC")).toBe("2026-12-31");
  });
});
