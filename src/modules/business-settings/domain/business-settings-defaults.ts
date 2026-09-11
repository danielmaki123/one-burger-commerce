import {
  BUSINESS_SETTINGS_ID,
  type BusinessHours,
  type BusinessSettingsRecord,
} from "@/modules/business-settings/domain/business-settings.types";

/**
 * Valores por defecto de la configuración del negocio.
 *
 * Reproducen **exactamente** lo que hoy está escrito a mano en el sitio público
 * (ver `ops/tasks/TASK-whitelabel-branding.md` §2), así el deploy de esta tarea
 * no cambia nada visible. Es el único lugar del código donde pueden vivir estos
 * literales junto con `prisma/seed.ts`: el test de contrato anti-hardcode falla
 * si reaparecen en otra superficie.
 */
export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  mon: { closed: false, open: "12:00", close: "22:00" },
  tue: { closed: false, open: "12:00", close: "22:00" },
  wed: { closed: false, open: "12:00", close: "22:00" },
  thu: { closed: false, open: "12:00", close: "22:00" },
  fri: { closed: false, open: "12:00", close: "22:00" },
  sat: { closed: false, open: "12:00", close: "22:00" },
  sun: { closed: false, open: "12:00", close: "22:00" },
};

/** La fila por defecto, sin la auditoría que agrega el repositorio al guardar. */
export type BusinessSettingsDefaults = Omit<
  BusinessSettingsRecord,
  "updatedAt" | "updatedByUserId"
>;

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettingsDefaults = {
  id: BUSINESS_SETTINGS_ID,
  name: "One Burger",
  tagline: "Burgers preparadas al momento para llevar.",
  description: "Menu and pickup ordering platform for One Burger.",
  logoUrl: null,
  // Sin isotipo configurado el header muestra las iniciales del nombre, que es
  // lo que hace hoy el sitio. Cuando el owner suba su logo, se usa ese.
  logoMarkUrl: null,
  faviconUrl: "/brand/one-burger-mark.svg",
  ogImageUrl: null,
  primaryColor: "#2b6c96",
  accentColor: "#eaf1f6",
  backgroundColor: "#fbf9f5",
  foregroundColor: "#23303a",
  surfaceColor: "#ffffff",
  headingFont: "fraunces",
  bodyFont: "inter",
  phone: "+50588770888",
  whatsapp: "50588770888",
  email: null,
  instagram: "oneburger",
  facebook: null,
  tiktok: null,
  addressLine: "Retiro en restaurante",
  city: "Jinotepe",
  addressReference: null,
  mapsUrl: null,
  latitude: null,
  longitude: null,
  timezone: "America/Managua",
  businessHours: DEFAULT_BUSINESS_HOURS,
  currencyCode: "NIO",
  currencySymbol: "C$",
  locale: "es-NI",
  pickupLeadMinutes: 25,
  // Sin rango por defecto: el checkout sigue prometiendo un instante concreto.
  pickupMaxMinutes: null,
  paymentInstructions: "Pagás en el local al retirar tu pedido. No se cobra nada online.",
  tipEnabled: true,
  tipRate: 10,
  isAcceptingOrders: true,
  closedMessage: "Estamos cerrados. Podés mirar el menú y volver cuando abramos.",
};

/**
 * Construye una fila completa a partir de los defaults.
 *
 * Clona los horarios a propósito: `DEFAULT_BUSINESS_HOURS` se comparte entre
 * llamadas y nadie debería poder mutarlo desde afuera.
 */
export function createDefaultBusinessSettingsRecord(
  overrides: Partial<BusinessSettingsRecord> = {},
): BusinessSettingsRecord {
  return {
    ...DEFAULT_BUSINESS_SETTINGS,
    businessHours: cloneBusinessHours(DEFAULT_BUSINESS_HOURS),
    updatedAt: new Date(),
    updatedByUserId: null,
    ...overrides,
  };
}

export function cloneBusinessHours(hours: BusinessHours): BusinessHours {
  return {
    mon: { ...hours.mon },
    tue: { ...hours.tue },
    wed: { ...hours.wed },
    thu: { ...hours.thu },
    fri: { ...hours.fri },
    sat: { ...hours.sat },
    sun: { ...hours.sun },
  };
}
