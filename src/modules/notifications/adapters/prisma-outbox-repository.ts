import { getPrismaClient } from "@/infrastructure/database/prisma";
import { OutboxError } from "@/modules/notifications/domain/outbox-errors";
import type { OutboxEventRecord } from "@/modules/notifications/domain/outbox.types";
import type {
  CreateOutboxEventInput,
  LockPendingEventsFilter,
  ListOutboxFilter,
  ListRecentOutboxEventsFilter,
  OutboxRepository,
} from "@/modules/notifications/ports/outbox-repository";

function mapEvent(event: {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  status: OutboxEventRecord["status"];
  payload: unknown;
  attemptCount: number;
  errorMessage: string | null;
  lockedAt: Date | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): OutboxEventRecord {
  return {
    id: event.id,
    eventType: event.eventType,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    status: event.status as OutboxEventRecord["status"],
    payload: event.payload,
    attemptCount: event.attemptCount,
    errorMessage: event.errorMessage,
    lockedAt: event.lockedAt ? event.lockedAt.toISOString() : null,
    processedAt: event.processedAt ? event.processedAt.toISOString() : null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

export class PrismaOutboxRepository implements OutboxRepository {
  async createEvent(input: CreateOutboxEventInput): Promise<OutboxEventRecord> {
    const prisma = getPrismaClient();
    const event = await prisma.outboxEvent.create({
      data: {
        eventType: input.eventType,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        payload: input.payload ?? {},
      },
    });
    return mapEvent(event);
  }

  async listEvents(filter: ListOutboxFilter): Promise<OutboxEventRecord[]> {
    const prisma = getPrismaClient();

    const where: {
      status?: OutboxEventRecord["status"];
      eventType?: string;
    } = {};

    if (filter.status) {
      where.status = filter.status as OutboxEventRecord["status"];
    }
    if (filter.eventType) {
      where.eventType = filter.eventType;
    }

    const events = await prisma.outboxEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return events.map(mapEvent);
  }

  /**
   * Los últimos eventos (o los de estos tipos), del más nuevo al más viejo: lo que muestra el historial.
   *
   * El segundo criterio (`id desc`) es el desempate de dos eventos creados en el **mismo milisegundo**: sin
   * él, Postgres devuelve las filas en el orden que quiere y el historial cambia entre consultas.
   */
  async listRecentEvents(filter: ListRecentOutboxEventsFilter): Promise<OutboxEventRecord[]> {
    const prisma = getPrismaClient();

    const events = await prisma.outboxEvent.findMany({
      where: filter.eventTypes?.length ? { eventType: { in: [...filter.eventTypes] } } : {},
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: Math.max(1, filter.limit),
    });

    return events.map(mapEvent);
  }

  async lockPendingEvents(
    limit: number,
    filter?: LockPendingEventsFilter,
  ): Promise<OutboxEventRecord[]> {
    const prisma = getPrismaClient();
    const where: {
      status: "pending";
      eventType?: { in: string[] };
      createdAt?: { gte: Date };
    } = { status: "pending" };

    if (filter?.eventTypes?.length) {
      where.eventType = { in: filter.eventTypes };
    }
    if (filter?.minCreatedAt) {
      where.createdAt = { gte: new Date(filter.minCreatedAt) };
    }

    const events = await prisma.outboxEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    if (events.length === 0) {
      return [];
    }

    const ids = events.map((e: { id: string }) => e.id);
    const lockedAt = new Date();
    const claimedIds: string[] = [];

    // Claim one event at a time with the status guard inside the WHERE clause:
    // when two processors pick the same batch, only the one whose UPDATE affects
    // a row keeps the event, so notifications are not delivered twice.
    for (const id of ids) {
      const claimed = await prisma.outboxEvent.updateMany({
        where: { id, status: "pending" },
        data: { status: "processing", lockedAt },
      });

      if (claimed.count === 1) {
        claimedIds.push(id);
      }
    }

    if (claimedIds.length === 0) {
      return [];
    }

    const locked = await prisma.outboxEvent.findMany({
      where: { id: { in: claimedIds } },
      orderBy: { createdAt: "desc" },
    });

    return locked.map(mapEvent);
  }

  async markProcessed(id: string): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.outboxEvent.update({
      where: { id },
      data: {
        status: "processed",
        processedAt: new Date(),
        lockedAt: null,
        errorMessage: null,
      },
    });
  }

  async incrementAttempt(id: string, errorMessage: string): Promise<void> {
    const prisma = getPrismaClient();
    const event = await prisma.outboxEvent.findUnique({ where: { id } });
    if (!event) {
      throw new OutboxError(404, "NOT_FOUND", "Outbox event not found");
    }

    await prisma.outboxEvent.update({
      where: { id },
      data: {
        attemptCount: { increment: 1 },
        errorMessage,
        status: "pending",
        lockedAt: null,
      },
    });
  }

  async markPermanentlyFailed(id: string, errorMessage: string): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.outboxEvent.update({
      where: { id },
      data: {
        status: "failed",
        errorMessage,
        lockedAt: null,
      },
    });
  }
}
