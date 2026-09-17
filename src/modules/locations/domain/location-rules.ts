import {
  WEEKDAY_KEYS,
  type BusinessHours,
} from "@/modules/business-settings/domain/business-settings.types";
import type {
  LocationRecord,
  LocationResolution,
} from "@/modules/locations/domain/location.types";
import { normalizeWhatsapp } from "@/shared/lib/normalize-whatsapp";

/**
 * Qué local atiende un pedido (T8).
 *
 * Dos reglas y nada más:
 *  - **sin local elegido se usa el primario** (el primero activo por orden), así el
 *    negocio de un solo local sigue funcionando sin que nadie elija nada;
 *  - **un local pedido que no sirve se rechaza**, no se cae al primario. Caer al
 *    primario sería mandar la comida al local equivocado sin avisar.
 *
 * El orden es determinista a propósito (orden manual y, si empatan, el nombre): dos
 * locales con el mismo `sortOrder` no pueden alternar según cómo los devuelva la base.
 */

export type { LocationRecord };

/** Días en el orden en que se muestran, para el mensaje de error. */
const WEEKDAY_LABELS: Record<(typeof WEEKDAY_KEYS)[number], string> = {
  mon: "lunes",
  tue: "martes",
  wed: "miércoles",
  thu: "jueves",
  fri: "viernes",
  sat: "sábado",
  sun: "domingo",
};

/** Datos que el admin carga (y edita) de un local. */
export type LocationInput = {
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  addressLine: string | null;
  city: string | null;
  addressReference: string | null;
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  whatsapp: string | null;
  businessHours: BusinessHours;
  pickupLeadMinutes: number;
  pickupMaxMinutes: number | null;
  /** B5 — cuándo avisa la comanda: sin aceptar y en cocina. */
  acceptAlertMinutes: number;
  prepAlertMinutes: number;
  isAcceptingOrders: boolean;
  /** TASK-308 — si este local usa el punto de venta (mostrador). */
  posEnabled: boolean;
  /** Tarea 3 del brief (2026-09-17) — si este local exige cerrar la caja todos los días. */
  requireShiftClose: boolean;
  closedMessage: string | null;
};

/** Un slug para URL: minúsculas, números y guiones simples. */
export const LOCATION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeLocationSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Valida lo que se va a guardar y devuelve un error por campo.
 *
 * Los números de preparación usan los mismos límites y los mismos mensajes que
 * `/admin/settings`: son la misma regla en dos pantallas y no pueden discrepar.
 */
export function validateLocationInput(input: LocationInput): Record<string, string> {
  const errors: Record<string, string> = {};

  const name = input.name.trim();
  if (name.length < 2) {
    errors.name = "Escribí el nombre del local";
  } else if (name.length > 60) {
    errors.name = "Máximo 60 caracteres";
  }

  const slug = normalizeLocationSlug(input.slug);
  if (!slug) {
    errors.slug = "Escribí un identificador para la URL";
  } else if (!LOCATION_SLUG_PATTERN.test(slug)) {
    errors.slug = "Usá minúsculas, números y guiones (por ejemplo sucursal-norte)";
  }

  if (!Number.isInteger(input.pickupLeadMinutes) || input.pickupLeadMinutes < 0) {
    errors.pickupLeadMinutes = "No puede ser negativo";
  } else if (input.pickupLeadMinutes > 180) {
    errors.pickupLeadMinutes = "Como máximo 180 minutos";
  }

  if (input.pickupMaxMinutes !== null) {
    if (!Number.isInteger(input.pickupMaxMinutes) || input.pickupMaxMinutes < 0) {
      errors.pickupMaxMinutes = "No puede ser negativo";
    } else if (input.pickupMaxMinutes > 240) {
      errors.pickupMaxMinutes = "Como máximo 240 minutos";
    } else if (input.pickupMaxMinutes < input.pickupLeadMinutes) {
      errors.pickupMaxMinutes = "Tiene que ser mayor o igual que los minutos de preparación";
    }
  }

  const hoursError = firstBusinessHoursError(input.businessHours);
  if (hoursError) errors.businessHours = hoursError;

  // B5: los avisos del tablero de comandas. El mismo límite y el mismo mensaje para los dos: son la
  // misma magnitud y discrepar solo confundiría a quien los edita.
  for (const [field, label] of [
    ["acceptAlertMinutes", "El aviso de pedidos sin aceptar"],
    ["prepAlertMinutes", "El aviso de preparación"],
  ] as const) {
    const value = input[field];

    if (!Number.isInteger(value) || value < 1) {
      errors[field] = `${label} tiene que ser de al menos 1 minuto`;
    } else if (value > 120) {
      errors[field] = `${label} no puede pasar de 120 minutos`;
    }
  }

  if (input.whatsapp !== null && input.whatsapp.trim() !== "" && !normalizeWhatsapp(input.whatsapp)) {
    // Sin un número de ejemplo en el mensaje: el contrato anti-hardcode rechaza cualquier
    // teléfono literal fuera del módulo de configuración del negocio.
    errors.whatsapp = "Usá el número con código de país, sin + ni espacios";
  }

  if (input.latitude !== null && (input.latitude < -90 || input.latitude > 90)) {
    errors.latitude = "Tiene que estar entre -90 y 90";
  }
  if (input.longitude !== null && (input.longitude < -180 || input.longitude > 180)) {
    errors.longitude = "Tiene que estar entre -180 y 180";
  }

  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0) {
    errors.sortOrder = "Tiene que ser un número entero positivo";
  }

  return errors;
}

/** Primer día con un horario incoherente, con el nombre del día en el mensaje. */
function firstBusinessHoursError(hours: BusinessHours): string | null {
  for (const weekday of WEEKDAY_KEYS) {
    const day = hours[weekday];
    if (day.closed) continue;

    // El formato `HH:mm` lo garantiza el esquema del payload; acá importa que el cierre
    // sea posterior a la apertura (y que un horario que cruza la medianoche se rechace,
    // que es la misma decisión que toma `buildPickupSlots`).
    if (day.open >= day.close) {
      return `El horario del ${WEEKDAY_LABELS[weekday]}: la hora de cierre tiene que ser posterior a la de apertura`;
    }
  }

  return null;
}

function byDisplayOrder(a: LocationRecord, b: LocationRecord): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.name.localeCompare(b.name, "es");
}

/** El local por defecto: el primero activo. `null` si no hay ninguno activo. */
export function pickDefaultLocation(locations: LocationRecord[]): LocationRecord | null {
  const active = locations.filter((location) => location.isActive).sort(byDisplayOrder);

  return active[0] ?? null;
}

export function resolveLocation({
  requestedLocationId,
  locations,
}: {
  requestedLocationId: string | null | undefined;
  locations: LocationRecord[];
}): LocationResolution {
  const requested = requestedLocationId?.trim();

  if (!requested) {
    const fallback = pickDefaultLocation(locations);
    return fallback ? { ok: true, location: fallback } : { ok: false, reason: "none-active" };
  }

  const found = locations.find((location) => location.id === requested);
  if (!found) return { ok: false, reason: "not-found" };
  if (!found.isActive) return { ok: false, reason: "inactive" };

  return { ok: true, location: found };
}

/**
 * El punto de retiro de un pedido ya hecho (T8 fase 7).
 *
 * Solo lo que hace falta para ir a buscar la comida: nombre, dirección y mapa. El
 * teléfono y el WhatsApp del local quedan afuera, igual que en `listPublicLocations`.
 */
export type PickupLocation = {
  name: string;
  addressLine: string | null;
  city: string | null;
  addressReference: string | null;
  mapsUrl: string | null;
};

/**
 * Resuelve el punto de retiro que muestra un pedido. `null` cuando el local ya no está,
 * para que la pantalla muestre "sin local" en vez de romperse.
 */
export function describePickupLocation(location: LocationRecord | null): PickupLocation | null {
  if (!location) return null;

  return {
    name: location.name,
    addressLine: location.addressLine,
    city: location.city,
    addressReference: location.addressReference,
    mapsUrl: location.mapsUrl,
  };
}

/**
 * La dirección del punto de retiro en una línea, como la lee el cliente.
 *
 * Mismo criterio que el checkout: se une con coma y se saltean los datos que el owner no
 * cargó. Sin ningún dato devuelve `null`, para no dibujar una fila vacía.
 *
 * Pide solo los campos de dirección (no el nombre ni el mapa) para que la pueda usar
 * también quien tiene el local público a mano en vez del registro completo.
 */
export function formatPickupAddress(
  location: Pick<PickupLocation, "addressLine" | "addressReference" | "city"> | null,
): string | null {
  if (!location) return null;

  const parts = [location.addressLine, location.addressReference, location.city]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(", ") : null;
}
