import type { LocationRepository } from "@/modules/locations/ports/location-repository";
import { KITCHEN_BOARD_STATUSES } from "@/modules/orders/domain/order-lanes";
import {
  resolveAcceptTargetMinutes,
  resolvePrepTargetMinutes,
} from "@/modules/orders/domain/order-location-thresholds";
import {
  averagePrepMinutes,
  resolveLongestPrepMinutes,
} from "@/modules/orders/domain/order-stage-times";
import type {
  ListOrdersFilter,
  OrderQueueRecord,
  OrderRepository,
} from "@/modules/orders/ports/order-repository";

import type {
  KitchenOrderProjection,
  KitchenOrdersResult,
} from "./kitchen-order-projection";

/**
 * La **cola de Cocina**: una proyección de `orders`, no un módulo nuevo.
 *
 * Tres decisiones que este caso de uso concentra, y por qué:
 *
 * 1. **No proyecta dinero.** Devuelve `KitchenOrderProjection`, que no tiene un solo campo financiero: la
 *    frontera es el **tipo**, no la pantalla. Lo que la cocina no debe leer no existe en la respuesta.
 * 2. **Trae el turno en una consulta.** Pide los cuatro estados del tablero (`KITCHEN_BOARD_STATUSES`) de
 *    una sola vez; los sellos de etapa y el resumen salen de esa misma lectura, no de N consultas.
 * 3. **Resuelve el local y sus umbrales acá**, en el servidor. La pantalla no reimplementa el alcance por
 *    sucursal ni decide el «objetivo»: los recibe.
 */

export type ListKitchenOrdersFilter = ListOrdersFilter & {
  /**
   * Sucursales que el usuario **puede** ver (`null`/vacío = todas). Es el resultado de
   * `resolveOrderLocationScope`, resuelto en la ruta: acá entra ya decidido, porque el dominio de pedidos
   * no sabe quién es el usuario.
   */
  scopeLocationIds?: string[] | null;
  /** El instante de la lectura. Entra por parámetro para que el resumen sea determinista en tests. */
  now?: Date;
};

export async function listKitchenOrders(
  filter: ListKitchenOrdersFilter,
  {
    repository,
    locationRepository,
  }: {
    repository: OrderRepository;
    locationRepository: LocationRepository;
  },
): Promise<KitchenOrdersResult> {
  const orders = await repository.listOrders({
    type: filter.type,
    // El tablero de Cocina son estos cuatro estados: pedirlos por estado serían cuatro viajes a la base
    // para dibujar una sola pantalla.
    statusIn: [...KITCHEN_BOARD_STATUSES],
    locationIds: filter.locationIds,
    search: filter.search,
    dateFrom: filter.dateFrom,
    dateTo: filter.dateTo,
  });

  const locations = await locationRepository.listLocations();
  const byId = new Map(locations.map((location) => [location.id, location]));
  const boardLocation = resolveBoardLocation(locations, filter.locationIds);

  const data: KitchenOrderProjection[] = orders.map((order) =>
    toKitchenOrder(order, byId.get(order.locationId)),
  );

  return {
    data,
    meta: {
      count: data.length,
      locationScope: filter.scopeLocationIds?.length ? filter.scopeLocationIds : null,
      summary: {
        averagePrepMinutes: averagePrepMinutes(orders),
        longestPrepMinutes: resolveLongestPrepMinutes(orders),
        prepTargetMinutes: resolvePrepTargetMinutes(boardLocation),
        acceptTargetMinutes: resolveAcceptTargetMinutes(boardLocation),
      },
    },
  };
}

/**
 * El local del que salen los umbrales del tablero.
 *
 * Con **una sola** sucursal a la vista hay un ritmo claro y se usan sus umbrales. Con varias y sin filtro
 * no hay un ritmo único que valga, así que rige el default: inventar un promedio entre dos cocinas sería
 * mentir sobre las dos.
 */
function resolveBoardLocation(
  locations: readonly { id: string; acceptAlertMinutes?: number | null; prepAlertMinutes?: number | null }[],
  locationIds?: string[],
): { acceptAlertMinutes?: number | null; prepAlertMinutes?: number | null } | null {
  const visible = locationIds?.length
    ? locations.filter((location) => locationIds.includes(location.id))
    : locations;

  return visible.length === 1 ? visible[0] : null;
}

function toKitchenOrder(
  order: OrderQueueRecord,
  location: { id: string; name: string; pickupLeadMinutes?: number | null } | undefined,
): KitchenOrderProjection {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    type: order.type,
    status: order.status,
    // `null` significa «no declarado» y se queda así: la etiqueta del canal no se adivina.
    source: order.source ?? null,
    customerName: order.customerName,
    location: {
      id: order.locationId,
      name: location?.name ?? null,
      pickupLeadMinutes: location?.pickupLeadMinutes ?? null,
    },
    createdAt: order.createdAt,
    stageChangedAt: order.stageChangedAt,
    preparingAt: order.preparingAt,
    readyAt: order.readyAt,
    pickupTime: order.pickupTime ?? null,
    pickupScheduled: order.pickupScheduled ?? false,
    // Lo que hay que cocinar, sin precio: `productName`, cantidad, modificadores y nota.
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      quantity: item.quantity,
      notes: item.notes ?? null,
      modifiers: item.modifiers.map((modifier) => ({ id: modifier.id, name: modifier.name })),
    })),
  };
}
