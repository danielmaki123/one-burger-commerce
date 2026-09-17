import type { OutboxEventRecord } from "@/modules/notifications/domain/outbox.types";

export type CreateOutboxEventInput = {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload?: unknown;
};

export type ListOutboxFilter = {
  status?: string;
  eventType?: string;
};

/**
 * Decisión del owner (2026-09-17) — lo que necesita el **historial** de la pantalla de alertas: los últimos
 * envíos, del más nuevo al más viejo. Va como operación propia (y no como un `listEvents` con límite)
 * porque el orden importa y el `limit` tiene que llegar a la base: traer todo el outbox para mostrar cinco
 * filas es lo que hace lenta una pantalla de configuración.
 */
export type ListRecentOutboxEventsFilter = {
  eventTypes?: readonly string[];
  limit: number;
};

export type LockPendingEventsFilter = {
  eventTypes?: string[];
  minCreatedAt?: string;
};

export interface OutboxRepository {
  createEvent(input: CreateOutboxEventInput): Promise<OutboxEventRecord>;

  listEvents(filter: ListOutboxFilter): Promise<OutboxEventRecord[]>;

  /** Los últimos eventos (o los últimos de estos tipos), del más nuevo al más viejo. */
  listRecentEvents(filter: ListRecentOutboxEventsFilter): Promise<OutboxEventRecord[]>;

  lockPendingEvents(
    limit: number,
    filter?: LockPendingEventsFilter,
  ): Promise<OutboxEventRecord[]>;

  markProcessed(id: string): Promise<void>;

  incrementAttempt(id: string, errorMessage: string): Promise<void>;

  markPermanentlyFailed(id: string, errorMessage: string): Promise<void>;
}
