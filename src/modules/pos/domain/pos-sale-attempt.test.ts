import { describe, expect, it } from "vitest";

import {
  createSaleAttemptKey,
  isSaleAttemptKey,
  POS_SALE_ATTEMPT_KEY_MAX_LENGTH,
} from "./pos-sale-attempt";

/**
 * Tarea 11 del brief (2026-09-17) — la **clave del intento de cobro** (12.1/12.2).
 *
 * Es lo que hace que un reintento del mismo cobro no cree dos ventas. Para que sirva tiene que ser un
 * **UUID** (única por intento, sin coordinación entre terminales) y tiene que entrar en el tope que acepta
 * la API: una clave que la ruta rechaza por larga es un cobro que no se puede reintentar.
 */

describe("createSaleAttemptKey", () => {
  it("genera una clave distinta por intento", () => {
    const keys = new Set(Array.from({ length: 50 }, () => createSaleAttemptKey()));

    expect(keys.size).toBe(50);
  });

  it("es un UUID válido y entra en el tope de la API", () => {
    const key = createSaleAttemptKey();

    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(key.length).toBeLessThanOrEqual(POS_SALE_ATTEMPT_KEY_MAX_LENGTH);
  });
});

describe("isSaleAttemptKey", () => {
  it("acepta lo que la API aceptaría", () => {
    expect(isSaleAttemptKey("ce9b1f5e-1a2b-4c3d-8e4f-5a6b7c8d9e0f")).toBe(true);
  });

  it("rechaza lo que no sirve como clave", () => {
    expect(isSaleAttemptKey(null)).toBe(false);
    expect(isSaleAttemptKey(42)).toBe(false);
    expect(isSaleAttemptKey("")).toBe(false);
    expect(isSaleAttemptKey("   ")).toBe(false);
    expect(isSaleAttemptKey("a".repeat(POS_SALE_ATTEMPT_KEY_MAX_LENGTH + 1))).toBe(false);
  });
});
