import type { TelegramGateway } from "@/modules/notifications/ports/telegram-gateway";

/**
 * Decisión del owner (2026-09-17) — **quién es el bot**, para la cabecera del estado.
 *
 * La pantalla de alertas muestra `Bot: @usuario` para que el dueño sepa con cuál está hablando (tiene más
 * de un bot en Telegram). Es una lectura best-effort: sin token o sin red devuelve `null` y la línea no se
 * dibuja — nunca se inventa el nombre ni se rompe la pantalla por no poder preguntar.
 */
export async function getTelegramBotIdentity({ gateway }: { gateway: TelegramGateway }) {
  try {
    return { data: await gateway.getBotIdentity() };
  } catch {
    return { data: { username: null } };
  }
}
