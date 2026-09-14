/**
 * Tipos y constantes del módulo de configuración del negocio.
 *
 * Es la única fuente de verdad para los datos del negocio (nombre, contacto,
 * horarios, moneda, propina): ninguna superficie pública ni API debe escribir
 * estos valores a mano. Ver `ops/tasks/TASK-whitelabel-branding.md`.
 */

/** La configuración es una sola fila: no hay multi-sucursal en el MVP. */
export const BUSINESS_SETTINGS_ID = "default";

export const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export type BusinessHoursDay = {
  /** Si está cerrado, `open`/`close` se conservan como referencia pero no se aplican. */
  closed: boolean;
  /** Hora de apertura en `HH:mm` (24 h). */
  open: string;
  /** Hora de cierre en `HH:mm` (24 h). */
  close: string;
};

export type BusinessHours = Record<WeekdayKey, BusinessHoursDay>;

export type BusinessHoursPatch = Partial<BusinessHours>;

/** Solo las tipografías incluidas en el build: no se agregan fuentes externas. */
export const FONT_CHOICES = ["fraunces", "inter", "jakarta"] as const;

export type FontChoice = (typeof FONT_CHOICES)[number];

/**
 * Nombre con el que cada tipografía se muestra en el admin. Vive acá y no en la
 * pantalla para que las dos listas (títulos y texto) y la vista previa usen la
 * misma fuente de verdad: con una lista fija, la tercera opción se mostraba con
 * el nombre de otra.
 */
export const FONT_LABELS: Record<FontChoice, string> = {
  fraunces: "Fraunces",
  inter: "Inter",
  jakarta: "Plus Jakarta Sans",
};

export const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/;
export const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
/** E.164 con `+`: es el formato agnóstico que se usa para `tel:`. */
export const E164_PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
/** E.164 sin `+`: es el formato que consumen los enlaces de WhatsApp. */
export const E164_DIGITS_PATTERN = /^[1-9]\d{7,14}$/;
export const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;
export const LOCALE_PATTERN = /^[a-z]{2}-[A-Z]{2}$/;

export type BusinessSettingsRecord = {
  id: string;
  // Identidad
  name: string;
  tagline: string | null;
  description: string | null;
  logoUrl: string | null;
  logoMarkUrl: string | null;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  // Apariencia
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  foregroundColor: string;
  surfaceColor: string;
  headingFont: FontChoice;
  bodyFont: FontChoice;
  // Contacto y ubicación
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  addressLine: string | null;
  city: string | null;
  addressReference: string | null;
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  // Operación
  timezone: string;
  businessHours: BusinessHours;
  currencyCode: string;
  currencySymbol: string;
  locale: string;
  /**
   * TASK-303a — cuántos de la moneda del negocio vale 1 dólar. `null` = sin tasa cargada: un cobro en
   * dólares se rechaza con el motivo en vez de convertirse con un número inventado.
   */
  usdExchangeRate: number | null;
  pickupLeadMinutes: number;
  /** Máximo del rango de preparación; `null` = se promete un instante, no un rango. */
  pickupMaxMinutes: number | null;
  paymentInstructions: string | null;
  tipEnabled: boolean;
  tipRate: number;
  isAcceptingOrders: boolean;
  closedMessage: string | null;
  // Auditoría
  updatedAt: Date;
  updatedByUserId: string | null;
};

/** Campos editables desde el admin: el `id` y la auditoría los maneja el repositorio. */
export type BusinessSettingsFields = Omit<
  BusinessSettingsRecord,
  "id" | "updatedAt" | "updatedByUserId"
>;

/** Lo que el repositorio persiste: un parche con los horarios ya resueltos. */
export type BusinessSettingsPatch = Partial<BusinessSettingsFields>;

/** Lo que llega desde el admin: los horarios pueden venir día por día. */
export type BusinessSettingsInput = Omit<BusinessSettingsPatch, "businessHours"> & {
  businessHours?: BusinessHoursPatch;
};
