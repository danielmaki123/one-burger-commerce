import type { OutboxEventRecord } from "@/modules/notifications/domain/outbox.types";
import type {
  ListOutboxFilter,
  OutboxRepository,
} from "@/modules/notifications/ports/outbox-repository";

export async function listOutboxEvents(
  filter: ListOutboxFilter,
  { repository }: { repository: OutboxRepository },
): Promise<{ data: OutboxEventRecord[] }> {
  const events = await repository.listEvents(filter);
  return { data: events };
}
