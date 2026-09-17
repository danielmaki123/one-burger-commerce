import { describe, expect, it } from "vitest";

import { groupDayCloseByLocation, summarizeDayClose, type DayCloseShift } from "./day-close";

/**
 * Bloque 11.5/11.6 del roadmap del POS (Fase 2) — el **cierre del día consolidado** y la comparación
 * entre sucursales.
 *
 * El arqueo de un turno dice si a **esa** caja le cuadró. La pregunta del dueño es otra: cuánto entró en
 * el día en todas las sucursales y cuál quedó torcida. Esta cuenta es la que arma ese número, y por eso
 * vive en el dominio y se prueba sola: sumar mal acá es un reporte de plata mal.
 *
 * Lo que fija este archivo: los totales salen de los datos **congelados** al cerrar (no se recalcula
 * nada), un turno sin contar no se cuenta como cero (se informa aparte) y una sucursal sin turnos
 * aparece con ceros en vez de desaparecer de la comparación.
 */

function shift(overrides: Partial<DayCloseShift>): DayCloseShift {
  return {
    id: "shift_01",
    locationId: "loc_centro",
    status: "closed",
    openedAt: "2026-09-18T14:00:00.000Z",
    closedAt: "2026-09-18T22:00:00.000Z",
    openingAmount: 1000,
    closingAmount: 1500,
    expectedAmount: 1500,
    difference: 0,
    cashSalesAmount: 700,
    cashMovementsAmount: -200,
    refundsAmount: 0,
    ...overrides,
  };
}

describe("summarizeDayClose", () => {
  it("suma lo que entró, lo que se movió y lo que se devolvió en el día", () => {
    const totals = summarizeDayClose([
      shift({ id: "a" }),
      shift({
        id: "b",
        cashSalesAmount: 300,
        cashMovementsAmount: 100,
        refundsAmount: -50,
        openingAmount: 0,
        closingAmount: 350,
        expectedAmount: 350,
        difference: 0,
      }),
    ]);

    expect(totals.cashSales).toBe(1000);
    expect(totals.movements).toBe(-100);
    expect(totals.refunds).toBe(-50);
    expect(totals.expected).toBe(1850);
    expect(totals.counted).toBe(1850);
    expect(totals.difference).toBe(0);
  });

  it("cuenta los turnos por estado y los que quedaron sin contar", () => {
    const totals = summarizeDayClose([
      shift({ id: "a" }),
      shift({ id: "b", status: "open", closedAt: null, closingAmount: null, expectedAmount: null, difference: null }),
      // Cierre ciego: hay esperado pero nadie contó (Bloque 1.11).
      shift({ id: "c", closingAmount: null, difference: null }),
    ]);

    expect(totals.shifts).toBe(3);
    expect(totals.closed).toBe(2);
    expect(totals.open).toBe(1);
    expect(totals.withoutCount).toBe(2);
    // El esperado de los tres suma igual: es lo que el sistema esperaba, se haya contado o no.
    expect(totals.expected).toBe(1500 + 0 + 1500);
    // Lo contado, en cambio, solo cuenta lo que existe.
    expect(totals.counted).toBe(1500);
  });

  it("un turno viejo sin los campos nuevos no rompe la cuenta", () => {
    const totals = summarizeDayClose([
      shift({ id: "viejo", cashSalesAmount: null, cashMovementsAmount: null, refundsAmount: null }),
    ]);

    expect(totals.cashSales).toBe(0);
    expect(totals.movements).toBe(0);
    expect(totals.refunds).toBe(0);
    expect(totals.counted).toBe(1500);
  });

  it("sin turnos, todo en cero (el día no arrancó, no es un hueco)", () => {
    expect(summarizeDayClose([])).toEqual({
      shifts: 0,
      closed: 0,
      open: 0,
      withoutCount: 0,
      cashSales: 0,
      movements: 0,
      refunds: 0,
      expected: 0,
      counted: 0,
      difference: 0,
    });
  });
});

describe("groupDayCloseByLocation", () => {
  const locations = [
    { id: "loc_centro", name: "Camino de Oriente" },
    { id: "loc_masaya", name: "Carretera Masaya" },
  ];

  it("compara sucursales y deja con ceros la que no tuvo turnos", () => {
    const groups = groupDayCloseByLocation([shift({ id: "a" })], locations);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      locationId: "loc_centro",
      locationName: "Camino de Oriente",
      totals: { shifts: 1, cashSales: 700 },
    });
    expect(groups[1]).toMatchObject({
      locationId: "loc_masaya",
      locationName: "Carretera Masaya",
      totals: { shifts: 0, cashSales: 0, difference: 0 },
    });
  });

  it("respeta el orden de las sucursales que se le pasa", () => {
    const groups = groupDayCloseByLocation([], [...locations].reverse());

    expect(groups.map((group) => group.locationId)).toEqual(["loc_masaya", "loc_centro"]);
  });

  it("un turno de una sucursal que no está en la lista no se pierde: se agrupa por su id", () => {
    const groups = groupDayCloseByLocation([shift({ id: "a", locationId: "loc_raro" })], locations);

    expect(groups.map((group) => group.locationId)).toEqual([
      "loc_centro",
      "loc_masaya",
      "loc_raro",
    ]);
    expect(groups[2]).toMatchObject({ locationName: "loc_raro", totals: { shifts: 1 } });
  });

  it("cada sucursal trae su propia diferencia, que es lo que se compara", () => {
    const groups = groupDayCloseByLocation(
      [
        shift({ id: "a", locationId: "loc_centro", difference: -100 }),
        shift({ id: "b", locationId: "loc_masaya", difference: 25, closingAmount: 1525, expectedAmount: 1500 }),
      ],
      locations,
    );

    expect(groups[0].totals.difference).toBe(-100);
    expect(groups[1].totals.difference).toBe(25);
  });
});
