import { describe, expect, it } from "vitest";

import { parsePosDraft, serializePosDraft } from "./pos-draft-storage";

/**
 * Bloque 12.3 del roadmap del POS (Fase 2) — el borrador de la venta guardado en el dispositivo.
 *
 * El cajero arma la venta y, si se corta la luz, se recarga la pantalla o se va la red, el borrador tiene
 * que **seguir ahí**: perder la venta en curso es volver a tocar todo con el cliente adelante. Se guarda
 * en el dispositivo (no en el servidor: todavía no es un pedido) y por eso el texto guardado se lee
 * defensivamente —un guardado viejo o corrupto no puede romper el mostrador—.
 *
 * Tarea 11 del brief (2026-09-17): desde acá viaja también la **clave del intento de cobro** (el UUID con
 * el que el servidor reconoce un reintento). Va con el borrador y no en memoria porque se pierde justo
 * cuando más hace falta: la pantalla se recarga después del corte y el cajero vuelve a cobrar. Un guardado
 * viejo (sin clave) se lee igual y la clave se genera de nuevo.
 */

const draft = {
  locationId: "loc_centro",
  lines: [
    { productId: "seed-prod-01", name: "Taco de Birria", unitPrice: 35, quantity: 2 },
    {
      productId: "seed-prod-03",
      name: "Agua de Jamaica",
      unitPrice: 25,
      packagingUnitAmount: 5,
      quantity: 1,
      notes: "Sin hielo",
    },
  ],
};

const attemptKey = "ce9b1f5e-1a2b-4c3d-8e4f-5a6b7c8d9e0f";

describe("serializePosDraft", () => {
  it("guarda el borrador con su local, sus líneas y la clave del intento", () => {
    const parsed = parsePosDraft(serializePosDraft(draft, attemptKey), "loc_centro");

    expect(parsed).toEqual({ draft, attemptKey });
  });

  it("sin clave guarda el borrador igual (y al leerlo la clave es null)", () => {
    const parsed = parsePosDraft(serializePosDraft(draft), "loc_centro");

    expect(parsed?.draft).toEqual(draft);
    expect(parsed?.attemptKey).toBeNull();
  });
});

describe("parsePosDraft", () => {
  it("sin nada guardado no hay venta que recuperar", () => {
    expect(parsePosDraft(null, "loc_centro")).toBeNull();
    expect(parsePosDraft("", "loc_centro")).toBeNull();
  });

  it("lo que no es un borrador no rompe la pantalla", () => {
    expect(parsePosDraft("no-es-json", "loc_centro")).toBeNull();
    expect(parsePosDraft("{}", "loc_centro")).toBeNull();
    expect(parsePosDraft('{"locationId":"loc_centro"}', "loc_centro")).toBeNull();
    expect(parsePosDraft('{"locationId":"loc_centro","lines":"dos"}', "loc_centro")).toBeNull();
  });

  it("un borrador vacío no se recupera: no hay venta en curso", () => {
    expect(
      parsePosDraft(serializePosDraft({ locationId: "loc_centro", lines: [] }), "loc_centro"),
    ).toBeNull();
  });

  it("el borrador es de un local: cambiar de sucursal no resucita la venta de la otra", () => {
    expect(parsePosDraft(serializePosDraft(draft), "loc_masaya")).toBeNull();
  });

  it("una línea con basura se descarta sin llevarse el resto", () => {
    const raw = JSON.stringify({
      locationId: "loc_centro",
      lines: [
        { productId: "seed-prod-01", name: "Taco de Birria", unitPrice: 35, quantity: 2 },
        { productId: "", name: "Fantasma", unitPrice: 10, quantity: 1 },
        { productId: "seed-prod-09", name: "Precio malo", unitPrice: "gratis", quantity: 1 },
        { productId: "seed-prod-10", name: "Cantidad cero", unitPrice: 10, quantity: 0 },
      ],
    });

    const parsed = parsePosDraft(raw, "loc_centro");

    expect(parsed?.draft.lines).toEqual([
      { productId: "seed-prod-01", name: "Taco de Birria", unitPrice: 35, quantity: 2 },
    ]);
  });

  it("una clave de intento corrupta se descarta (se genera una nueva)", () => {
    const raw = JSON.stringify({
      locationId: "loc_centro",
      lines: draft.lines,
      attemptKey: "a".repeat(200),
    });

    expect(parsePosDraft(raw, "loc_centro")?.attemptKey).toBeNull();
  });
});
