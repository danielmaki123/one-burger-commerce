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

  /**
   * El reloj del proceso tiene resolución de **milisegundos**: los cuatro eventos de este test caen en el
   * mismo instante y el orden quedaría a cargo de la máquina (en CI pasó exactamente eso). Los tiempos se
   * fijan a mano para que el test hable del orden y no del reloj.
   */
  const conTiempo = (id: string, createdAt: string) => {
    const event = repository.events.find((candidate) => candidate.id === id);
    if (event) event.createdAt = createdAt;
  };

  conTiempo(cierre.id, "2026-09-17T15:00:00.000Z");
  conTiempo(devolucion.id, "2026-09-17T17:55:00.000Z");
  conTiempo(pedido.id, "2026-09-17T18:05:00.000Z");

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

  /**
   * El desempate: dos avisos creados en el **mismo milisegundo** (lo normal cuando un cierre registra su
   * mensaje y el siguiente evento cae en el mismo tick) tienen que salir siempre en el mismo orden.
   */
  it("dos avisos del mismo milisegundo salen en orden estable (el último primero)", async () => {
    const repository = new InMemoryOutboxRepository();
    const primero = await repository.createEvent({
      eventType: "shift_closed",
      aggregateType: "Shift",
      aggregateId: "shift_a",
      payload: {},
    });
    const segundo = await repository.createEvent({
      eventType: "shift_closed",
      aggregateType: "Shift",
      aggregateId: "shift_b",
      payload: {},
    });
    const mismoInstante = "2026-09-17T18:00:00.000Z";

    for (const event of repository.events) {
      event.createdAt = mismoInstante;
      await repository.markProcessed(event.id);
    }

    const primera = await listTelegramAlertHistory({ limit: 5 }, { outboxRepository: repository });
    const segunda = await listTelegramAlertHistory({ limit: 5 }, { outboxRepository: repository });

    expect(primera.data.map((row) => row.id)).toEqual([segundo.id, primero.id]);
    expect(segunda.data.map((row) => row.id)).toEqual([segundo.id, primero.id]);
  });
});
