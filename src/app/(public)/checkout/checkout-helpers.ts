/**
 * Utilidades del checkout, separadas de la página para poder probarlas solas.
 *
 * El armado del instante de retiro **no** vive acá: desde la fase 4 (D1) el día elegido
 * manda, así que lo resuelve el dominio de turnos (`pickupInstant`), que además lo hace en
 * la zona del negocio y no en la del celular. Antes esta capa armaba la hora con
 * `date.setHours(...)`, o sea con el reloj del cliente.
 */

const GENERIC_ERROR = "No pudimos confirmar el pedido. Intentá de nuevo.";

/**
 * Hallazgo N2 de la auditoría post-deploy (2026-09-23) — el **429** (límite de altas por IP) tiene su
 * propio mensaje.
 *
 * El alta pública corta a las 10 por minuto por IP (`/api/orders`). Con el mensaje genérico el cliente
 * reintenta enseguida y **empeora** el límite; el código de estado es el único dato que distingue ese caso,
 * así que el helper lo recibe.
 */
const RATE_LIMIT_ERROR = "Esperá un momento e intentá de nuevo en unos segundos.";

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
export function extractCheckoutErrorMessage(payload: unknown, status?: number): string {
  // El límite por IP es lo primero: su mensaje es el único que le dice al cliente qué hacer.
  if (status === 429) return RATE_LIMIT_ERROR;

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
