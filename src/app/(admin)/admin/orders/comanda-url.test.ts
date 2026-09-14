import { describe, expect, it } from "vitest";

import { readOrderUrlFilters, writeOrderUrlFilters } from "./comanda-url";

/**
 * B4 — el estado de la vista en la URL.
 *
 * Quien atiende el mostrador necesita poder mandarle a la cocina "el pedido de Ana" con un enlace, y
 * que al recargar la pantalla (o al volver del detalle) no se pierda lo que estaba mirando. Por eso
 * los filtros del tablero viven en la query string y no solo en memoria.
 */
describe("filtros del tablero en la URL (B4)", () => {
  it("sin nada en la URL no hay filtros", () => {
    expect(readOrderUrlFilters("")).toEqual({
      search: "",
      paymentMethod: "all",
      lateOnly: false,
    });
  });

  it("lee lo que hay, recortando los espacios del término", () => {
    expect(readOrderUrlFilters("?search=%20ana%20&paymentMethod=cash&late=1")).toEqual({
      search: "ana",
      paymentMethod: "cash",
      lateOnly: true,
    });
  });

  it("ignora lo que no entiende en vez de romper la pantalla", () => {
    expect(readOrderUrlFilters("?paymentMethod=bitcoin&late=quizas").paymentMethod).toBe("all");
    expect(readOrderUrlFilters("?paymentMethod=bitcoin&late=quizas").lateOnly).toBe(false);
  });

  it("escribe solo lo que está puesto: los valores por defecto no ensucian la URL", () => {
    expect(writeOrderUrlFilters("", { search: "", paymentMethod: "all", lateOnly: false })).toBe("");
  });

  it("escribe y vuelve a leer lo mismo", () => {
    const filters = { search: "P-ABC", paymentMethod: "card" as const, lateOnly: true };
    const written = writeOrderUrlFilters("", filters);

    expect(readOrderUrlFilters(written)).toEqual(filters);
  });

  it("conserva los parámetros que no son suyos", () => {
    const written = writeOrderUrlFilters("?tab=historial", {
      search: "ana",
      paymentMethod: "all",
      lateOnly: false,
    });

    expect(written).toContain("tab=historial");
    expect(written).toContain("search=ana");
  });

  it("quitar un filtro lo saca de la URL", () => {
    const written = writeOrderUrlFilters("?search=ana&late=1", {
      search: "",
      paymentMethod: "all",
      lateOnly: false,
    });

    expect(written).toBe("");
  });
});
