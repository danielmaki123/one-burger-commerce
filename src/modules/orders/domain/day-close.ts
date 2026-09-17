/**
 * Bloque 11.5/11.6 del roadmap del POS (Fase 2) — el **cierre del día** consolidado y la comparación
 * entre sucursales.
 *
 * El arqueo de un turno dice si a **esa** caja le cuadró. La pregunta del dueño es otra: cuánto entró en
 * el día en todas las sucursales y cuál quedó torcida. Esa cuenta vive acá (dominio, sin I/O) para que se
 * pruebe sola: sumar mal acá es un reporte de plata mal.
 *
 * Tres reglas que no son obvias:
 *
 * 1. Los números salen de lo que quedó **congelado al cerrar** (`cashSalesAmount`, `expectedAmount`, …).
 *    No se recalcula nada con la tasa de hoy: el cierre es un documento.
 * 2. Un turno sin contar **no** se cuenta como cero: entra en `withoutCount` y en el esperado, pero no en
 *    lo contado. Si no, un día a medio arquear parecería un faltante de plata.
 * 3. Una sucursal sin turnos aparece con ceros en la comparación, no desaparece (y un turno de una
 *    sucursal que no está en la lista se agrupa por su id en vez de perderse).
 */

export type DayCloseShift = {
  id: string;
  locationId: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  openingAmount: number;
  closingAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;
  cashSalesAmount?: number | null;
  cashMovementsAmount?: number | null;
  refundsAmount?: number | null;
};

export type DayCloseTotals = {
  shifts: number;
  closed: number;
  open: number;
  /** Turnos sin contar: cierre ciego o caja abierta. */
  withoutCount: number;
  cashSales: number;
  movements: number;
  refunds: number;
  expected: number;
  counted: number;
  difference: number;
};

export type DayCloseLocationGroup = {
  locationId: string;
  locationName: string;
  totals: DayCloseTotals;
};

function sum(values: (number | null | undefined)[]): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

/** Los totales del día: lo que entró, lo que se movió, lo que se devolvió y cómo quedó el arqueo. */
export function summarizeDayClose(shifts: readonly DayCloseShift[]): DayCloseTotals {
  return {
    shifts: shifts.length,
    closed: shifts.filter((shift) => shift.status === "closed").length,
    open: shifts.filter((shift) => shift.status === "open").length,
    withoutCount: shifts.filter((shift) => shift.closingAmount === null).length,
    cashSales: sum(shifts.map((shift) => shift.cashSalesAmount)),
    movements: sum(shifts.map((shift) => shift.cashMovementsAmount)),
    refunds: sum(shifts.map((shift) => shift.refundsAmount)),
    expected: sum(shifts.map((shift) => shift.expectedAmount)),
    counted: sum(shifts.map((shift) => shift.closingAmount ?? 0)),
    difference: sum(shifts.map((shift) => shift.difference)),
  };
}

/**
 * La comparación entre sucursales (11.6): una fila por sucursal del alcance, en el orden que llegan.
 * Las sucursales sin turnos van con ceros —"no vendió" es un dato— y los turnos de una sucursal que no
 * está en la lista se agregan al final con su id, para que ningún turno quede fuera del total.
 */
export function groupDayCloseByLocation(
  shifts: readonly DayCloseShift[],
  locations: readonly { id: string; name: string }[],
): DayCloseLocationGroup[] {
  const groups: DayCloseLocationGroup[] = locations.map((location) => ({
    locationId: location.id,
    locationName: location.name,
    totals: summarizeDayClose(shifts.filter((shift) => shift.locationId === location.id)),
  }));

  const known = new Set(locations.map((location) => location.id));
  const unknown = [...new Set(shifts.map((shift) => shift.locationId))].filter(
    (locationId) => !known.has(locationId),
  );

  for (const locationId of unknown) {
    groups.push({
      locationId,
      locationName: locationId,
      totals: summarizeDayClose(shifts.filter((shift) => shift.locationId === locationId)),
    });
  }

  return groups;
}
