import type { ShiftRecord } from "@/modules/orders/domain/order.types";

/**
 * Punto 2 del roadmap (2026-09-18) — los cierres del Historial, cruzando las sucursales del alcance.
 *
 * La ruta resuelve **qué** sucursales puede mirar quien pide (dueño: todas; manager: las suyas) y este
 * caso de uso arma la lista: solo turnos **cerrados** —un turno abierto no es un cierre—, del más nuevo
 * al más viejo, con los filtros de la barra y con el nombre del cajero resuelto **una vez por persona**
 * (varios turnos del mismo cajero no pueden ser varias consultas).
 *
 * Una diferencia de centavos por redondeo no debería aparecer en «solo descuadre»: el umbral es el mismo
 * que usa el arqueo para decir que la caja cuadró.
 */

/** Medio centavo: abajo de eso, la diferencia es redondeo, no descuadre. */
const DIFFERENCE_EPSILON = 0.005;

export type HistoryShiftRecord = ShiftRecord & {
  locationName: string | null;
  /** Nombre de quien cerró el turno. `null` si el usuario ya no existe. */
  cashierName: string | null;
};

export type ListHistoryShiftsFilters = {
  /** Las sucursales del alcance, ya resueltas por la ruta. */
  locations: Array<{ id: string; name: string }>;
  closedFrom?: string | null;
  closedTo?: string | null;
  cashierUserId?: string | null;
  onlyDifference?: boolean;
};

export type ListHistoryShiftsDependencies = {
  shiftRepository: { listShifts(locationId: string): Promise<ShiftRecord[]> };
  userRepository: { findUserById(id: string): Promise<{ id: string; name: string } | null> };
};

function inRange(closedAt: string, from?: string | null, to?: string | null): boolean {
  const closed = new Date(closedAt).getTime();

  if (from && closed < new Date(from).getTime()) return false;
  if (to && closed > new Date(to).getTime()) return false;

  return true;
}

export async function listHistoryShifts(
  filters: ListHistoryShiftsFilters,
  dependencies: ListHistoryShiftsDependencies,
): Promise<HistoryShiftRecord[]> {
  const perLocation = await Promise.all(
    filters.locations.map(async (location) => ({
      location,
      shifts: await dependencies.shiftRepository.listShifts(location.id),
    })),
  );

  const rows = perLocation.flatMap(({ location, shifts }) =>
    shifts
      .filter((shift) => shift.closedAt !== null && shift.status === "closed")
      .filter((shift) =>
        inRange(shift.closedAt as string, filters.closedFrom, filters.closedTo),
      )
      .filter((shift) =>
        filters.cashierUserId ? shift.userId === filters.cashierUserId : true,
      )
      .filter((shift) =>
        filters.onlyDifference
          ? (shift.difference ?? 0) > DIFFERENCE_EPSILON ||
            (shift.difference ?? 0) < -DIFFERENCE_EPSILON
          : true,
      )
      .map((shift) => ({ shift, locationName: location.name })),
  );

  rows.sort(
    (a, b) => new Date(b.shift.closedAt as string).getTime() - new Date(a.shift.closedAt as string).getTime(),
  );

  const names = new Map<string, string | null>();

  for (const { shift } of rows) {
    if (names.has(shift.userId)) continue;

    const user = await dependencies.userRepository.findUserById(shift.userId);
    names.set(shift.userId, user?.name ?? null);
  }

  return rows.map(({ shift, locationName }) => ({
    ...shift,
    locationName,
    cashierName: names.get(shift.userId) ?? null,
  }));
}
