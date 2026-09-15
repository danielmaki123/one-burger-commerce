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
  /**
   * B5 — minutos que puede esperar un pedido **sin aceptar** antes de que la comanda avise. Es el
   * umbral de la cola «Por aceptar»: un pedido que nadie tomó no puede quedarse invisible.
   */
  acceptAlertMinutes: number;
  /** B5 — minutos en cocina (aceptado, preparando o listo) antes de que la comanda avise. */
  prepAlertMinutes: number;
  isAcceptingOrders: boolean;
  /**
   * TASK-308 — si este local usa el punto de venta (mostrador). Nace prendido, así el negocio de un
   * solo local no configura nada; apagado, la API del POS contesta 403 en ese local y la entrada de
   * «Caja» no se ofrece al staff que solo atiende ese local.
   */
  posEnabled: boolean;
  closedMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Motivos por los que un pedido no puede ir a un local. */
export type LocationResolutionFailure = "not-found" | "inactive" | "none-active";

export type LocationResolution =
  | { ok: true; location: LocationRecord }
  | { ok: false; reason: LocationResolutionFailure };

/**
 * Lo que un local decide sobre un producto (T8 fase 4).
 *
 * Sin fila para ese local el producto **se vende al precio base**: un negocio de un solo
 * local no necesita configurar nada, y un producto nuevo se vende en todos lados salvo que
 * el owner lo apague en alguno. Con fila, el local manda.
 */
export type LocationProductRecord = {
  id: string;
  locationId: string;
  productId: string;
  /** `null` = el precio base del producto. `0` es gratis, no "sin precio". */
  priceOverride: number | null;
  /** Agotado hoy en este local, sin dejar de venderlo. */
  isAvailable: boolean;
  /** `false` = este local no lo ofrece. */
  isActive: boolean;
};

export type LocationProductInput = {
  priceOverride: number | null;
  isAvailable: boolean;
  isActive: boolean;
};
