import { getWeekdayInTimeZone } from "@/modules/business-settings/domain/business-hours-format";
import {
  WEEKDAY_KEYS,
  type BusinessHours,
  type WeekdayKey,
} from "@/modules/business-settings/domain/business-settings.types";
import { DEFAULT_BUSINESS_HOURS } from "@/modules/business-settings/domain/business-settings-defaults";
import type { LocationInput } from "@/modules/locations/domain/location-rules";
import type { LocationRecord } from "@/modules/locations/domain/location.types";

/**
 * T8 fase 3 — la pantalla de locales.
 *
 * Dos traducciones y un par de etiquetas. El formulario trabaja con texto (es lo que devuelve un
 * campo de formulario), así que la conversión tiene que ser explícita: un campo vacío es
 * "sin dato", no un cero silencioso, y los números viajan como números.
 */
export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  mon: "Lunes",
  tue: "Martes",
  wed: "Miércoles",
  thu: "Jueves",
  fri: "Viernes",
  sat: "Sábado",
  sun: "Domingo",
};

export const LOCATION_STATUS_LABELS = {
  active: "Activo",
  inactive: "Apagado",
} as const;

export type LocationStatus = keyof typeof LOCATION_STATUS_LABELS;

export function locationStatus(location: Pick<LocationRecord, "isActive">): LocationStatus {
  return location.isActive ? "active" : "inactive";
}

export type LocationFormState = {
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: string;
  addressLine: string;
  city: string;
  addressReference: string;
  mapsUrl: string;
  latitude: string;
  longitude: string;
  phone: string;
  whatsapp: string;
  businessHours: BusinessHours;
  pickupLeadMinutes: string;
  pickupMaxMinutes: string;
  /** B5: cuándo avisa la comanda de este local (sin aceptar y en cocina). */
  acceptAlertMinutes: string;
  prepAlertMinutes: string;
  isAcceptingOrders: boolean;
  /** TASK-308 — si el local cobra en el mostrador. */
  posEnabled: boolean;
  /** Tarea 3 del brief (2026-09-17) — si este local exige cerrar la caja todos los días. */
  requireShiftClose: boolean;
  closedMessage: string;
};

export function createEmptyLocationForm(): LocationFormState {
  return {
    name: "",
    slug: "",
    isActive: true,
    sortOrder: "0",
    addressLine: "",
    city: "",
    addressReference: "",
    mapsUrl: "",
    latitude: "",
    longitude: "",
    phone: "",
    whatsapp: "",
    // Un local nuevo arranca con el mismo horario del negocio: es lo que el owner espera.
    businessHours: {
      mon: { ...DEFAULT_BUSINESS_HOURS.mon },
      tue: { ...DEFAULT_BUSINESS_HOURS.tue },
      wed: { ...DEFAULT_BUSINESS_HOURS.wed },
      thu: { ...DEFAULT_BUSINESS_HOURS.thu },
      fri: { ...DEFAULT_BUSINESS_HOURS.fri },
      sat: { ...DEFAULT_BUSINESS_HOURS.sat },
      sun: { ...DEFAULT_BUSINESS_HOURS.sun },
    },
    pickupLeadMinutes: "25",
    pickupMaxMinutes: "",
    // Los mismos valores por defecto que la base (B5): 10 sin aceptar, 15 en cocina.
    acceptAlertMinutes: "10",
    prepAlertMinutes: "15",
    isAcceptingOrders: true,
    // TASK-308: el mostrador nace prendido, igual que en la base.
    posEnabled: true,
    // Tarea 3: el cierre obligatorio nace apagado; cada sucursal lo prende en su ficha.
    requireShiftClose: false,
    closedMessage: "",
  };
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function integerOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function numberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function locationFormToInput(form: LocationFormState): LocationInput {
  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    isActive: form.isActive,
    sortOrder: integerOrNull(form.sortOrder) ?? 0,
    addressLine: textOrNull(form.addressLine),
    city: textOrNull(form.city),
    addressReference: textOrNull(form.addressReference),
    mapsUrl: textOrNull(form.mapsUrl),
    latitude: numberOrNull(form.latitude),
    longitude: numberOrNull(form.longitude),
    phone: textOrNull(form.phone),
    whatsapp: textOrNull(form.whatsapp),
    businessHours: form.businessHours,
    pickupLeadMinutes: integerOrNull(form.pickupLeadMinutes) ?? 0,
    pickupMaxMinutes: integerOrNull(form.pickupMaxMinutes),
    acceptAlertMinutes: integerOrNull(form.acceptAlertMinutes) ?? 10,
    prepAlertMinutes: integerOrNull(form.prepAlertMinutes) ?? 15,
    isAcceptingOrders: form.isAcceptingOrders,
    posEnabled: form.posEnabled,
    requireShiftClose: form.requireShiftClose,
    closedMessage: textOrNull(form.closedMessage),
  };
}

export function locationToForm(location: LocationRecord): LocationFormState {
  return {
    name: location.name,
    slug: location.slug,
    isActive: location.isActive,
    sortOrder: String(location.sortOrder),
    addressLine: location.addressLine ?? "",
    city: location.city ?? "",
    addressReference: location.addressReference ?? "",
    mapsUrl: location.mapsUrl ?? "",
    latitude: location.latitude === null ? "" : String(location.latitude),
    longitude: location.longitude === null ? "" : String(location.longitude),
    phone: location.phone ?? "",
    whatsapp: location.whatsapp ?? "",
    businessHours: location.businessHours,
    pickupLeadMinutes: String(location.pickupLeadMinutes),
    pickupMaxMinutes: location.pickupMaxMinutes === null ? "" : String(location.pickupMaxMinutes),
    acceptAlertMinutes: String(location.acceptAlertMinutes),
    prepAlertMinutes: String(location.prepAlertMinutes),
    isAcceptingOrders: location.isAcceptingOrders,
    posEnabled: location.posEnabled,
    requireShiftClose: location.requireShiftClose,
    closedMessage: location.closedMessage ?? "",
  };
}

/** Dónde se retira, en una línea. Sin dirección cargada lo dice en vez de dejar un hueco. */
export function describeLocationAddress(
  location: Pick<LocationRecord, "addressLine" | "city">,
): string {
  const parts = [location.addressLine, location.city].filter(
    (part): part is string => Boolean(part && part.trim()),
  );

  return parts.length > 0 ? parts.join(", ") : "Sin dirección cargada";
}

/** El horario de hoy, que es lo que el owner necesita ver de un vistazo en la lista. */
export function describeLocationHours(
  location: Pick<LocationRecord, "businessHours">,
  timezone: string,
  now: Date,
): string {
  const today = WEEKDAY_KEYS.indexOf(getWeekdayInTimeZone(now, timezone));
  const day = location.businessHours[WEEKDAY_KEYS[today]];

  if (!day || day.closed) return "Hoy cerrado";

  return `Hoy ${day.open} a ${day.close}`;
}

