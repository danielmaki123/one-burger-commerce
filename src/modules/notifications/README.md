# Módulo `notifications`

Avisos de pedidos por **outbox**: el hecho se registra en la base y un proceso lo entrega después. El
pedido **nunca** depende del aviso (si el envío falla, el pedido ya existe).

```
domain/       outbox.types.ts · order-created-notification.ts (el texto/estructura del aviso)
ports/        outbox-repository.ts · notification-sender.ts · outbox-dedup.ts
adapters/     prisma-outbox-repository.ts · in-memory-outbox-repository.ts
              notification-sender-factory.ts (elige el emisor por entorno)
              telegram-notification-sender.ts · telegram-dry-run-sender.ts · n8n-webhook-sender.ts
              multi-notification-sender.ts · rate-limited-sender.ts · dummy-notification-sender.ts
              outbox-subscriber.ts (se suscribe a los eventos de pedidos)
              outbox-processor-scheduler.ts · in-memory-dedup-tracker.ts
features/     register-outbox-event/ · process-outbox-events/ · list-outbox-events/
```

Reglas:

- **Sin duplicados** (`outbox-dedup`) y con **rate limit** (`rate-limited-sender`): un pedido que se
  reintenta no puede avisar dos veces.
- El emisor se elige por entorno en la **capa de composición**; dejarlo en `dummy` es una decisión
  válida (hoy el owner eligió no usar Telegram: la operación es 100% panel).
- `telegram-dry-run-sender` **no envía**: sirve para ver el mensaje sin mandarlo. Los tests usan los
  dobles en memoria, nunca la red.

Estado y planes en `ops/production-readiness.md` §8.2; no activar notificaciones sin pedido del owner.
