import { describe, expect, it } from "vitest";

import { resolveCustomerFiscalData } from "./customer-fiscal-data";

/**
 * Punto 4 del roadmap (2026-09-18) — los datos fiscales del cliente de una venta.
 *
 * El POS pregunta «¿el cliente pide factura con RUC?» y con el tilde puesto el **RUC y la razón social
 * son obligatorios**. La regla es de **dominio** y no de la pantalla porque el alta de un pedido es una
 * API pública: el servidor no puede aceptar media factura (un RUC sin razón social, o al revés) por más
 * que la pantalla lo impida.
 */

describe("resolveCustomerFiscalData", () => {
  it("sin datos fiscales no hay nada que guardar", () => {
    expect(resolveCustomerFiscalData({})).toEqual({ taxId: null, legalName: null });
    expect(resolveCustomerFiscalData({ taxId: null, legalName: null })).toEqual({
      taxId: null,
      legalName: null,
    });
    expect(resolveCustomerFiscalData({ taxId: "  ", legalName: "  " })).toEqual({
      taxId: null,
      legalName: null,
    });
  });

  it("normaliza los dos datos cuando vienen completos", () => {
    expect(
      resolveCustomerFiscalData({ taxId: "  J0310000001 ", legalName: "  Distribuidora La Unión  " }),
    ).toEqual({ taxId: "J0310000001", legalName: "Distribuidora La Unión" });
  });

  it("un RUC sin razón social no se guarda a medias", () => {
    // Media factura no es una factura: el cliente quedaría con un RUC que después nadie puede usar.
    expect(resolveCustomerFiscalData({ taxId: "J0310000001" })).toEqual({
      taxId: null,
      legalName: null,
    });
    expect(resolveCustomerFiscalData({ taxId: "J0310000001", legalName: "   " })).toEqual({
      taxId: null,
      legalName: null,
    });
  });

  it("una razón social sin RUC tampoco se guarda", () => {
    expect(resolveCustomerFiscalData({ legalName: "Distribuidora La Unión" })).toEqual({
      taxId: null,
      legalName: null,
    });
  });

  it("un RUC más corto que 8 caracteres no sirve", () => {
    expect(resolveCustomerFiscalData({ taxId: "J0310", legalName: "Distribuidora La Unión" })).toEqual({
      taxId: null,
      legalName: null,
    });
    // Ocho exactos sí: es el mínimo que el POS pide.
    expect(resolveCustomerFiscalData({ taxId: "J0310000", legalName: "Distribuidora" })).toEqual({
      taxId: "J0310000",
      legalName: "Distribuidora",
    });
  });

  it("no pasa valores por encima del tope de la columna", () => {
    const result = resolveCustomerFiscalData({
      taxId: "X".repeat(60),
      legalName: "Y".repeat(200),
    });

    expect(result.taxId).toHaveLength(40);
    expect(result.legalName).toHaveLength(120);
  });
});
