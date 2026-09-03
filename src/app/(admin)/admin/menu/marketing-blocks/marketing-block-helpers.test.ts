import { describe, expect, it } from "vitest";

import {
  describeMarketingCta,
  describeMarketingWindow,
  getMarketingDisplayStatus,
  MARKETING_STATUS_LABELS,
  MARKETING_TYPE_LABELS,
} from "./marketing-block-helpers";

const NOW = new Date("2026-08-03T12:00:00").getTime();

describe("marketing block helpers", () => {
  it("traduce los tipos al español", () => {
    expect(MARKETING_TYPE_LABELS.promo).toBe("Promoción");
    expect(MARKETING_TYPE_LABELS.event).toBe("Evento");
    expect(MARKETING_TYPE_LABELS.info).toBe("Información");
  });

  it("bloque activo con inicio futuro es Programado", () => {
    expect(
      getMarketingDisplayStatus(
        { isActive: true, startsAt: "2026-08-10T00:00:00", endsAt: null },
        NOW,
      ),
    ).toBe("scheduled");
    expect(MARKETING_STATUS_LABELS.scheduled).toBe("Programado");
  });

  it("bloque activo con fin pasado se muestra Inactivo", () => {
    expect(
      getMarketingDisplayStatus(
        { isActive: true, startsAt: null, endsAt: "2026-07-15T00:00:00" },
        NOW,
      ),
    ).toBe("inactive");
  });

  it("bloque activo vigente es Activo", () => {
    expect(
      getMarketingDisplayStatus(
        { isActive: true, startsAt: "2026-08-01T00:00:00", endsAt: "2026-08-26T00:00:00" },
        NOW,
      ),
    ).toBe("active");
  });

  it("describe la ventana de visibilidad en formato local", () => {
    expect(
      describeMarketingWindow(
        { startsAt: "2026-08-10T12:00:00", endsAt: null },
        NOW,
      ),
    ).toContain("Empieza el 10/08/2026");
    expect(
      describeMarketingWindow({ startsAt: null, endsAt: "2026-08-26T23:59:00" }, NOW),
    ).toBe("Visible hasta el 26/08/2026");
    expect(describeMarketingWindow({ startsAt: null, endsAt: null }, NOW)).toBe(
      "Sin fecha de fin",
    );
  });

  it("describe el CTA con el nombre del destino, no el id", () => {
    const resolve = () => "Vigorón";
    expect(
      describeMarketingCta(
        { ctaType: "product", ctaLabel: "Ver plato", ctaTarget: "prod_1" },
        resolve,
      ),
    ).toBe("Botón “Ver plato” → Vigorón");
    expect(
      describeMarketingCta({ ctaType: "none", ctaLabel: null, ctaTarget: null }, resolve),
    ).toBe("Sin botón");
  });
});
