import type { BusinessHours } from "@/modules/business-settings/domain/business-settings.types";

/**
 * T8 — un local del negocio.
 *
 * Lo que es **por local**: dónde se retira, cómo se contacta, cuándo abre, cuánto tarda
 * la cocina y si está aceptando pedidos. Lo que sigue siendo del negocio entero (marca,
 * colores, moneda, propina, promos) vive en `BusinessSettings` y no se repite acá.
 *
 * `businessHours` viaja como JSON, igual que en la configuración: la forma la valida
 * `business-settings.schema` y los turnos los calcula `pickup-slots`.
 */
export type LocationRecord = {
  id: string;
  /** Nombre para mostrar: "Principal", "Sucursal Norte". */
  name: string;
  /** Identificador estable para URLs y anclas. */
  slug: string;
  isActive: boolean;
  /** Orden manual en la lista; el primero activo es el local por defecto. */
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
  /** Máximo del rango de preparación (`null` = se promete un instante, no una franja). */
  pickupMaxMinutes: number | null;
  isAcceptingOrders: boolean;
  closedMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Motivos por los que un pedido no puede ir a un local. */
export type LocationResolutionFailure = "not-found" | "inactive" | "none-active";

export type LocationResolution =
  | { ok: true; location: LocationRecord }
  | { ok: false; reason: LocationResolutionFailure };
