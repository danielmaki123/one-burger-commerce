import { subscribe } from "@/infrastructure/events/event-bus";
import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { loadBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { buildOrderCreatedNotificationPayload } from "@/modules/notifications/domain/order-created-notification";
import { PrismaOutboxRepository } from "./prisma-outbox-repository";

let registered = false;

export function registerOutboxEventBusHandlers() {
  if (registered) return;
  registered = true;

  const repository = new PrismaOutboxRepository();

  subscribe("OrderCreated", async ({ order }: { order: Parameters<typeof buildOrderCreatedNotificationPayload>[0] }) => {
    // El ticket de cocina usa el nombre y la moneda configurados, no literales.
    const settings = await loadBusinessSettings({
      repository: new PrismaBusinessSettingsRepository(),
    });

    await repository.createEvent({
      eventType: "OrderCreated",
      aggregateType: "order",
      aggregateId: order.id,
      payload: buildOrderCreatedNotificationPayload(order, {
        businessName: settings.name,
        currency: { symbol: settings.currencySymbol, locale: settings.locale },
        timeZone: settings.timezone,
      }),
    });
  });

  subscribe("OrderStatusChanged", async ({ orderId, status }: { orderId: string; status: string }) => {
    await repository.createEvent({
      eventType: "OrderStatusChanged",
      aggregateType: "order",
      aggregateId: orderId,
      payload: { orderId, status },
    });
  });

  subscribe("ReservationCreated", async ({ reservation }: { reservation: { id: string; status: string; customerName: string; customerWhatsapp: string } }) => {
    await repository.createEvent({
      eventType: "ReservationCreated",
      aggregateType: "reservation",
      aggregateId: reservation.id,
      payload: { reservation },
    });
  });

  subscribe("ReservationApproved", async ({ reservationId }: { reservationId: string }) => {
    await repository.createEvent({
      eventType: "ReservationApproved",
      aggregateType: "reservation",
      aggregateId: reservationId,
      payload: { reservationId },
    });
  });

  subscribe("InventoryLow", async ({ productId, productName }: { productId: string; productName: string }) => {
    await repository.createEvent({
      eventType: "InventoryLow",
      aggregateType: "inventory",
      aggregateId: productId,
      payload: { productId, productName },
    });
  });
}
