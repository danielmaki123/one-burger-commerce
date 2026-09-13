import { describe, expect, it } from "vitest";

import { findUnknownLocationIds, normalizeLocationIds } from "./location-ids";

/**
 * Una sola forma de leer una lista de sucursales llega del admin (formulario, API, sesión):
 * sin vacíos, sin repetidos y en el orden en que el owner las eligió. Vivía duplicada en el
 * dominio de visibilidad de pedidos y en los casos de uso de usuarios.
 */
describe("normalizeLocationIds", () => {
  it("saca vacíos y espacios en blanco", () => {
    expect(normalizeLocationIds(["loc_norte", "", "   ", null, undefined])).toEqual(["loc_norte"]);
  });

  it("saca repetidos y respeta el orden de elección", () => {
    expect(normalizeLocationIds(["loc_sur", "loc_norte", "loc_sur"])).toEqual([
      "loc_sur",
      "loc_norte",
    ]);
  });

  it("recorta los espacios de cada identificador", () => {
    expect(normalizeLocationIds(["  loc_norte  "])).toEqual(["loc_norte"]);
  });

  it("sin lista devuelve una lista vacía", () => {
    expect(normalizeLocationIds(undefined)).toEqual([]);
    expect(normalizeLocationIds(null)).toEqual([]);
  });
});

/**
 * Antes de guardar una asignación hay que saber si alguna sucursal elegida ya no existe:
 * un id inventado dejaría al usuario acotado a una sucursal fantasma (no vería nada).
 */
describe("findUnknownLocationIds", () => {
  it("devuelve las que no existen, en el orden en que llegaron", () => {
    expect(
      findUnknownLocationIds(["loc_norte", "loc_fantasma", "loc_sur"], ["loc_norte", "loc_sur"]),
    ).toEqual(["loc_fantasma"]);
  });

  it("sin desconocidas devuelve una lista vacía", () => {
    expect(findUnknownLocationIds(["loc_norte"], ["loc_norte", "loc_sur"])).toEqual([]);
    expect(findUnknownLocationIds([], ["loc_norte"])).toEqual([]);
  });
});
