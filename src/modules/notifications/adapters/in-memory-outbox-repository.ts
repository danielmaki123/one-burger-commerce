import type { OutboxEventRecord } from "@/modules/notifications/domain/outbox.types";
import type {
  CreateOutboxEventInput,
  LockPendingEventsFilter,
  ListOutboxFilter,
  ListRecentOutboxEventsFilter,
  OutboxRepository,
} from "@/modules/notifications/ports/outbox-repository";

export class InMemoryOutboxRepository implements OutboxRepository {
  events: OutboxEventRecord[] = [];

  private nextId() {
    return `evt_${this.events.length + 1}`;
  }

  async createEvent(input: CreateOutboxEventInput): Promise<OutboxEventRecord> {
    const now = new Date().toISOString();
    const event: OutboxEventRecord = {
      id: this.nextId(),
      eventType: input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      status: "pending",
      payload: input.payload ?? {},
      attemptCount: 0,
      errorMessage: null,
      lockedAt: null,
      processedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.events.push(event);
    return event;
  }

  async listEvents(filter: ListOutboxFilter): Promise<OutboxEventRecord[]> {
    return this.events.filter((e) => {
      if (filter.status && e.status !== filter.status) return false;
      if (filter.eventType && e.eventType !== filter.eventType) return false;
      return true;
    });
  }

  /**
   * Los últimos, del más nuevo al más viejo — igual que el `orderBy desc + take` de Prisma.
   *
   * El desempate no es un detalle: dos eventos creados en el **mismo milisegundo** (lo normal: el cierre
   * registra el aviso y el siguiente evento cae en el mismo tick) tienen el mismo `createdAt`, y sin
   * desempate el orden depende de la máquina. Prisma desempata por `id` desc; acá, por el orden de carga
   * (el último creado primero), que es lo que se ve en la pantalla.
   */
  async listRecentEvents(filter: ListRecentOutboxEventsFilter): Promise<OutboxEventRecord[]> {
    return this.events
      .map((event, index) => ({ event, index }))
      .filter(({ event }) => !filter.eventTypes?.length || filter.eventTypes.includes(event.eventType))
      .sort((a, b) => {
        const byDate = b.event.createdAt.localeCompare(a.event.createdAt);
        if (byDate !== 0) return byDate;

        return b.index - a.index;
      })
      .slice(0, Math.max(0, filter.limit))
      .map(({ event }) => event);
  }

  async lockPendingEvents(
    limit: number,
    filter?: LockPendingEventsFilter,
  ): Promise<OutboxEventRecord[]> {
    const pending = this.events
      .filter((e) => {
        if (e.status !== "pending") return false;
        if (filter?.eventTypes?.length && !filter.eventTypes.includes(e.eventType)) {
          return false;
        }
        if (filter?.minCreatedAt && e.createdAt < filter.minCreatedAt) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);

    for (const event of pending) {
      event.status = "processing";
      event.lockedAt = new Date().toISOString();
      event.updatedAt = new Date().toISOString();
    }

    return pending;
  }

  async markProcessed(id: string): Promise<void> {
    const event = this.events.find((e) => e.id === id);
    if (event) {
      event.status = "processed";
      event.processedAt = new Date().toISOString();
      event.lockedAt = null;
      event.errorMessage = null;
      event.updatedAt = new Date().toISOString();
    }
  }

  async incrementAttempt(id: string, errorMessage: string): Promise<void> {
    const event = this.events.find((e) => e.id === id);
    if (event) {
      event.attemptCount++;
      event.errorMessage = errorMessage;
      event.status = "pending";
      event.lockedAt = null;
      event.updatedAt = new Date().toISOString();
    }
  }

  async markPermanentlyFailed(id: string, errorMessage: string): Promise<void> {
    const event = this.events.find((e) => e.id === id);
    if (event) {
      event.status = "failed";
      event.errorMessage = errorMessage;
      event.lockedAt = null;
      event.updatedAt = new Date().toISOString();
    }
  }
}
