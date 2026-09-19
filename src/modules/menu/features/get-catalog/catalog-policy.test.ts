import { describe, expect, it } from "vitest";

import { resolveCatalogPolicy } from "./catalog-policy";

/**
 * La tabla de alcances: el público muestra lo disponible y lee la carta; el mostrador muestra también
 * lo agotado (para poder avisarlo) y no lee los bloques de marketing.
 */
describe("resolveCatalogPolicy", () => {
  it("el mostrador incluye lo agotado y no lee los bloques de marketing", () => {
    expect(resolveCatalogPolicy("pos", {})).toEqual({
      includeUnavailable: true,
      loadsMarketingBlocks: false,
    });
  });

  it("la carta muestra solo lo disponible y sí lee los bloques", () => {
    expect(resolveCatalogPolicy("public", {})).toEqual({
      includeUnavailable: false,
      loadsMarketingBlocks: true,
    });
  });

  it("la carta puede pedir los agotados (`includeUnavailable`), el mostrador no puede apagarlos", () => {
    expect(resolveCatalogPolicy("public", { includeUnavailable: true })).toEqual({
      includeUnavailable: true,
      loadsMarketingBlocks: true,
    });
    expect(resolveCatalogPolicy("pos", { includeUnavailable: false })).toEqual({
      includeUnavailable: true,
      loadsMarketingBlocks: false,
    });
  });
});
