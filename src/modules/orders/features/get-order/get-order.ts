import type { PickupLocation } from "@/modules/locations/domain/location-rules";
import { describePickupLocation } from "@/modules/locations/domain/location-rules";
import type { LocationRepository } from "@/modules/locations/ports/location-repository";
import { OrderError } from "@/modules/orders/domain/order-errors";
import type {
  OrderRecord,
  OrderStatusHistoryRecord,
  PaymentRecord,
} from "@/modules/orders/domain/order.types";
import type { OrderRepository } from "@/modules/orders/ports/order-repository";
import type { PaymentRepository } from "@/modules/orders/ports/payment-repository";

/**
 * Pedido del admin con lo que el detalle necesita al lado.
 *
 * Igual que el listado, el local se resuelve al leer: el pedido guarda el `locationId`, nunca el nombre ni
 * la dirección.
 *
 * `TASK-ORDERS-RUNTIME-5B` sumó el **historial real** (`getOrderStatusHistory`): es la fuente del recorrido
 * que muestra el detalle —con hora y actor— y de los sellos por etapa. Antes el detalle no lo leía y el
 * recorrido se dibujaba con un mapa estado→etapa paralelo que no decía lo que había pasado de verdad
 * (`A-09`, `A-64`).
 *
 * El **estado financiero no se resuelve acá**: lo proyecta `payments` y lo aplica la proyección del
 * detalle, que es la que decide si el rol puede verlo.
 */
export type AdminOrderDetail = OrderRecord & {
  pickupLocation: PickupLocation | null;
  payments: PaymentRecord[];
  history: OrderStatusHistoryRecord[];
};

export async function getOrder(
  id: string,
  {
    repository,
    locationRepository,
    paymentRepository,
  }: {
    repository: OrderRepository;
    locationRepository: LocationRepository;
    paymentRepository: PaymentRepository;
  },
): Promise<{ data: AdminOrderDetail }> {
  const order = await repository.findOrderById(id);
  if (!order) {
    throw new OrderError(404, "NOT_FOUND", "Order not found");
  }

  // Un local borrado (o un id viejo) deja el pedido sin punto de retiro, no rompe el detalle.
  const [location, payments, history] = await Promise.all([
    locationRepository.findLocationById(order.locationId),
    paymentRepository.listPaymentsByOrder(order.id),
    repository.getOrderStatusHistory(order.id),
  ]);

  return {
    data: { ...order, pickupLocation: describePickupLocation(location), payments, history },
  };
}
