import { describe, expect, it } from "vitest";

import {
  LEGACY_DEFAULT_FAVICON_URL,
  resolveBrandImageUrl,
  resolveFaviconUrl,
} from "@/modules/business-settings/domain/brand-assets";
import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";

const ISOTIPO = "https://cdn.test/isotipo.png";
const LOGO_COMPLETO = "https://cdn.test/logo-completo.png";

describe("brand assets", () => {
  it("el isotipo manda para la marca corta y el logo completo para la larga", () => {
    const settings = { logoUrl: LOGO_COMPLETO, logoMarkUrl: ISOTIPO };

    expect(resolveBrandImageUrl(settings, "mark")).toBe(ISOTIPO);
    expect(resolveBrandImageUrl(settings, "full")).toBe(LOGO_COMPLETO);
  });

  it("cae al otro logo cuando solo hay uno configurado", () => {
    expect(resolveBrandImageUrl({ logoUrl: null, logoMarkUrl: ISOTIPO }, "full")).toBe(ISOTIPO);
    expect(resolveBrandImageUrl({ logoUrl: LOGO_COMPLETO, logoMarkUrl: null }, "mark")).toBe(
      LOGO_COMPLETO,
    );
  });

  it("devuelve null cuando no hay ningun logo: el consumidor usa las iniciales", () => {
    expect(resolveBrandImageUrl({ logoUrl: null, logoMarkUrl: null }, "mark")).toBeNull();
    expect(resolveBrandImageUrl({ logoUrl: null, logoMarkUrl: null }, "full")).toBeNull();
  });

  describe("favicon", () => {
    it("usa el isotipo cuando el owner no eligio un favicon propio", () => {
      // El valor que sembro la migracion no cuenta como eleccion del owner:
      // si no, dejaria el favicon viejo tapando al isotipo configurado.
      expect(
        resolveFaviconUrl({ faviconUrl: LEGACY_DEFAULT_FAVICON_URL, logoMarkUrl: ISOTIPO }),
      ).toBe(ISOTIPO);
      expect(resolveFaviconUrl({ faviconUrl: null, logoMarkUrl: ISOTIPO })).toBe(ISOTIPO);
    });

    it("respeta el favicon elegido a mano por encima del isotipo", () => {
      expect(
        resolveFaviconUrl({ faviconUrl: "https://cdn.test/favicon.png", logoMarkUrl: ISOTIPO }),
      ).toBe("https://cdn.test/favicon.png");
    });

    it("cae al valor sembrado cuando no hay nada configurado", () => {
      expect(resolveFaviconUrl({ faviconUrl: null, logoMarkUrl: null })).toBe(
        LEGACY_DEFAULT_FAVICON_URL,
      );
    });

    it("el valor sembrado es el de los defaults del dominio", () => {
      expect(LEGACY_DEFAULT_FAVICON_URL).toBe(DEFAULT_BUSINESS_SETTINGS.faviconUrl);
    });
  });
});
