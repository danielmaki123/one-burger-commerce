import type { PickupLocation } from "@/modules/locations/domain/location-rules";
import { describePickupLocation } from "@/modules/locations/domain/location-rules";
import type { LocationRepository } from "@/modules/locations/ports/location-repository";
import { OrderError } from "@/modules/orders/domain/order-errors";
import type { OrderRecord, PaymentRecord } from "@/modules/orders/domain/order.types";
import type { OrderRepository } from "@/modules/orders/ports/order-repository";
import type { PaymentRepository } from "@/modules/orders/ports/payment-repository";

/**
 * Pedido del admin con su punto de retiro al lado (T8 fase 7).
 *
 * Igual que `listAdminOrders`, el local se resuelve al leer: el pedido guarda el
 * `locationId`, nunca el nombre ni la dirección.
 *
 * TASK-304: además trae los **cobros registrados**. Un pedido del checkout no tiene ninguno (se paga
 * al retirar), pero una venta de mostrador sí, y la caja necesita ver con qué pagó el cliente y en
 * qué moneda. El **cambio no se recalcula**: se derivó al cobrar (T12) y la tasa puede haber
 * cambiado; recalcularlo acá inventaría un número que nadie cobró.
 */
export type AdminOrderDetail = OrderRecord & {
  pickupLocation: PickupLocation | null;
  payments: PaymentRecord[];
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
  const location = await locationRepository.findLocationById(order.locationId);
  const payments = await paymentRepository.listPaymentsByOrder(order.id);

  return {
    data: { ...order, pickupLocation: describePickupLocation(location), payments },
  };
}
