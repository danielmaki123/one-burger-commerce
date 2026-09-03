export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { startOutboxProcessorScheduler } = await import(
    "./src/modules/notifications/adapters/outbox-processor-scheduler"
  );

  startOutboxProcessorScheduler();
}
