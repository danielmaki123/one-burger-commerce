import { describe, expect, it } from "vitest";

import { InMemoryOutboxRepository } from "@/modules/notifications/adapters/in-memory-outbox-repository";

import { listTelegramAlertHistory } from "./list-telegram-alert-history";

/**
 * Decisión del owner (2026-09-17) — el **historial** de la pantalla de alertas.
 *
 * Lo que se fija: solo eventos de alerta (el outbox también lleva avisos de pedidos), del más nuevo al más
 * viejo, con la sucursal que trae el payload y el estado del envío. Un evento **pendiente** no es un envío
 * y no aparece; uno fallado sí, con su motivo, porque es justo lo que el dueño tiene que ver.
 */

async function seed(repository: InMemoryOutboxRepository) {
  const cierre = await repository.createEvent({
    eventType: "shift_closed",
    aggregateType: "Shift",
    aggregateId: "shift_01",
    payload: { locationName: "Camino de Oriente" },
  });
  await repository.markProcessed(cierre.id);

  const devolucion = await repository.createEvent({
    eventType: "refund_over_threshold",
    aggregateType: "Refund",
    aggregateId: "refund_01",
    payload: { amount: 620 },
  });
  await repository.markPermanentlyFailed(devolucion.id, "Telegram rechazó el mensaje.");

  // Pendiente: todavía no se intentó, no es un envío.
  await repository.createEvent({
    eventType: "shift_open_over_24h",
    aggregateType: "Shift",
    aggregateId: "shift_02",
    payload: { locationName: "Carretera Masaya" },
  });

  // De otro canal: no es una alerta del dueño.
  const pedido = await repository.createEvent({
    eventType: "order.created",
    aggregateType: "Order",
    aggregateId: "ord_01",
    payload: {},
  });
  await repository.markProcessed(pedido.id);

  return { cierre, devolucion };
}

describe("listTelegramAlertHistory", () => {
  it("devuelve los envíos de alerta con sucursal, estado y motivo del fallo", async () => {
    const repository = new InMemoryOutboxRepository();
    await seed(repository);

    const { data } = await listTelegramAlertHistory({ limit: 5 }, { outboxRepository: repository });

    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({
      label: "Devolución grande",
      locationName: null,
      ok: false,
      errorMessage: "Telegram rechazó el mensaje.",
    });
    expect(data[1]).toMatchObject({ label: "Cierre de caja", locationName: "Camino de Oriente", ok: true });
  });

  it("respeta el límite pedido", async () => {
    const repository = new InMemoryOutboxRepository();
    await seed(repository);

    const { data } = await listTelegramAlertHistory({ limit: 1 }, { outboxRepository: repository });

    expect(data).toHaveLength(1);
  });

  it("sin envíos devuelve una lista vacía, no un error", async () => {
    const repository = new InMemoryOutboxRepository();

    const { data } = await listTelegramAlertHistory({ limit: 5 }, { outboxRepository: repository });

    expect(data).toEqual([]);
  });
});
