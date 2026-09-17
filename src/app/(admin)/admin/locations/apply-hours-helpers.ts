import type { BusinessHours } from "@/modules/business-settings/domain/business-settings.types";
import type { LocationRecord } from "@/modules/locations/domain/location.types";

import { locationFormToInput, locationToForm } from "./location-helpers";

export type ApplyHoursRequest = { id: string; name: string; payload: unknown };

/**
 * Arma los PATCH para copiar el horario de una sucursal a todas las demás.
 *
 * El horario vive **por sucursal** (`Location.businessHours`) y el checkout usa el del local
 * elegido; el de la configuración del negocio solo queda como plantilla al crear una sucursal nueva.
 * Esta acción es una plantilla operativa, no una segunda fuente: copia una vez y deja de mandar.
 *
 * Cada payload es el local **completo** (nombre, dirección, minutos, estado) con el horario nuevo: el
 * PATCH del backend rechaza un payload incompleto a propósito, así que no se puede mandar solo las
 * horas sin arriesgarse a borrar lo que el owner ya cargó.
 */
export function buildApplyHoursRequests(
  locations: LocationRecord[],
  currentLocationId: string,
  hours: BusinessHours,
): ApplyHoursRequest[] {
  return locations
    .filter((location) => location.id !== currentLocationId)
    .map((location) => ({
      id: location.id,
      name: location.name,
      payload: locationFormToInput({ ...locationToForm(location), businessHours: hours }),
    }));
}
