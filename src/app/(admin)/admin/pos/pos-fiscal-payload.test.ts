import { describe, expect, it } from "vitest";

import { buildPosFiscalPayload } from "./pos-fiscal-payload";

/**
 * Punto 4 del roadmap (2026-09-18) — lo que el POS manda cuando el cliente pide **factura con RUC**.
 *
 * El checkbox está **desmarcado por defecto**, y con el tilde puesto el RUC (mínimo 8 caracteres) y la
 * razón social son obligatorios: el cobro no sale con media factura. Al desmarcarlo, los datos **se
 * limpian** —no viajan— para que el próximo cliente no herede el RUC del anterior.
 *
 * `pos-client.tsx` es deuda congelada (916 líneas): la regla vive acá, que se prueba sola, y la pantalla
 * solo la usa.
 */

describe("buildPosFiscalPayload", () => {
  it("sin factura no manda nada y no hay problema que mostrar", () => {
    expect(
      buildPosFiscalPayload({ wantsInvoice: false, taxId: "J0310000001", legalName: "Ana S.A." }),
    ).toEqual({ ok: true, taxId: null, legalName: null });
  });

  it("con factura manda los dos datos, recortados", () => {
    expect(
      buildPosFiscalPayload({
        wantsInvoice: true,
        taxId: "  J0310000001 ",
        legalName: "  Distribuidora La Unión  ",
      }),
    ).toEqual({ ok: true, taxId: "J0310000001", legalName: "Distribuidora La Unión" });
  });

  it("sin RUC con factura pedida, el cobro no sale", () => {
    expect(
      buildPosFiscalPayload({ wantsInvoice: true, taxId: "", legalName: "Ana S.A." }),
    ).toMatchObject({ ok: false, field: "taxId" });
  });

  it("un RUC de menos de 8 caracteres no alcanza", () => {
    expect(
      buildPosFiscalPayload({ wantsInvoice: true, taxId: "J0310", legalName: "Ana S.A." }),
    ).toMatchObject({ ok: false, field: "taxId" });
  });

  it("sin razón social con factura pedida, tampoco", () => {
    expect(
      buildPosFiscalPayload({ wantsInvoice: true, taxId: "J0310000001", legalName: "   " }),
    ).toMatchObject({ ok: false, field: "legalName" });
  });

  it("el problema dice qué campo marcar y qué escribir", () => {
    const result = buildPosFiscalPayload({ wantsInvoice: true, taxId: "J0310", legalName: "" });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("tenía que fallar");

    expect(result.message).toMatch(/RUC/);
  });
});
