import { TIME_OF_DAY_PATTERN } from "@/modules/business-settings/domain/business-settings.types";

/**
 * Utilidades del checkout, separadas de la página para poder probarlas solas.
 */

const GENERIC_ERROR = "No pudimos confirmar el pedido. Intentá de nuevo.";

/**
 * Convierte la hora de retiro del formulario (`19:30`) al ISO que espera la API.
 * Devuelve `null` si la hora no es válida, para que el llamador la trate como falta.
 */
export function formatPickupTimeIso(time24: string): string | null {
  if (!TIME_OF_DAY_PATTERN.test(time24)) return null;

  const [hours, minutes] = time24.split(":").map((part) => Number.parseInt(part, 10));
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return date.toISOString();
}

/** Estados que ve el cliente en la confirmación y en el seguimiento. */
export function formatPublicOrderStatus(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "new") return "Recibida";
  if (normalized === "confirmed") return "Confirmada";
  if (normalized === "preparing") return "En preparación";
  if (normalized === "ready") return "Lista";
  if (normalized === "ready_for_pickup") return "Lista para retirar";
  if (normalized === "picked_up") return "Retirada";
  if (normalized === "accepted") return "Aceptada";
  if (normalized === "closed") return "Completada";
  if (normalized === "cancelled") return "Cancelada";

  return status;
}

/**
 * Motivo del rechazo operativo, si la respuesta fue uno. Lo escribe el servidor en
 * `fields.acceptance` para que el cliente pueda reaccionar sin parsear el mensaje.
 */
export function readAcceptanceReason(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const error = (payload as Record<string, unknown>).error as
    | Record<string, unknown>
    | undefined;
  const fields = error?.fields as Record<string, unknown> | undefined;

  return typeof fields?.acceptance === "string" ? fields.acceptance : null;
}

/**
 * Traduce el error de `POST /api/orders` a un mensaje para el cliente.
 *
 * Solo cubre lo que este checkout puede provocar: entrega y mesa están fuera del MVP,
 * así que una respuesta con esos campos cae al mensaje genérico en vez de hablarle al
 * cliente de una dirección que nunca le pedimos.
 */
export function extractCheckoutErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return GENERIC_ERROR;

  const asRecord = payload as Record<string, unknown>;
  const error = asRecord.error as Record<string, unknown> | undefined;
  const fields = error?.fields as Record<string, unknown> | undefined;

  // Rechazo operativo (local cerrado o negocio sin aceptar pedidos): el mensaje lo
  // escribe el servidor desde la configuración, así que se muestra tal cual.
  if (readAcceptanceReason(payload) && typeof error?.message === "string") {
    return error.message;
  }

  if (fields?.customerName) return "Falta completar nombre.";
  if (fields?.customerWhatsapp) return "Falta completar WhatsApp.";
  if (fields?.pickupTime) return "Revisá la hora de retiro.";
  if (fields?.items) return "El carrito está vacío o incompleto.";

  if (typeof error?.message === "string") {
    if (error.message.toLowerCase().includes("invalid payload")) {
      return "Revisá los datos del pedido.";
    }
  }

  return GENERIC_ERROR;
}
