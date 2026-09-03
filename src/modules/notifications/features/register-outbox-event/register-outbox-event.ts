import type { OutboxEventRecord } from "@/modules/notifications/domain/outbox.types";
import type {
  CreateOutboxEventInput,
  OutboxRepository,
} from "@/modules/notifications/ports/outbox-repository";

export async function registerOutboxEvent(
  input: CreateOutboxEventInput,
  { repository }: { repository: OutboxRepository },
): Promise<{ data: OutboxEventRecord }> {
  const event = await repository.createEvent(input);
  return { data: event };
}
