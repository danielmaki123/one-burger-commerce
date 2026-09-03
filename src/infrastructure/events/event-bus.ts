type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

const handlers = new Map<string, EventHandler[]>();

export function subscribe<T>(eventName: string, handler: EventHandler<T>) {
  const list = handlers.get(eventName) ?? [];
  list.push(handler as EventHandler);
  handlers.set(eventName, list);

  return () => {
    const current = handlers.get(eventName) ?? [];
    handlers.set(
      eventName,
      current.filter((h) => h !== handler),
    );
  };
}

export async function publish<T>(eventName: string, payload: T) {
  const list = handlers.get(eventName) ?? [];
  for (const handler of list) {
    try {
      await handler(payload);
    } catch {
      // Event handler failure must not break core flow
    }
  }
}
