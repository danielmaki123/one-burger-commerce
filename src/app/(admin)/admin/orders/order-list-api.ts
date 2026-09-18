/**
 * Bug de producción (2026-09-18) — la lectura de la lista de órdenes, con red de seguridad.
 *
 * La pantalla mostraba «No se pudieron cargar las órdenes» por **cualquier** respuesta que no fuera 200 y por
 * cualquier fallo de red. En producción eso pasó con dos causas distintas, las dos reales:
 *
 * 1. **Un filtro con un valor que la API rechaza** (`400 Invalid query params`, medido contra producción con
 *    `?dateFrom=basura` y `?status=no-existe`). La API devuelve qué campos fallaron; la pantalla los tiraba.
 * 2. **Un fallo transitorio** (reinicio del contenedor en un deploy, bache de red) mientras la lista estaba
 *    vacía: el cartel rojo quedaba a la vista, porque no se reintentaba nada.
 *
 * Este módulo resuelve las dos: **sanea** los filtros antes de armar la consulta (nunca manda un valor que la
 * API va a rechazar), **reintenta** los fallos que tienen sentido reintentar (red y 5xx, nunca un 400/401) y
 * traduce el fallo a un motivo que se puede mostrar y a un `kind` que la pantalla usa para ofrecer la acción
 * correcta.
 */

export type OrderListFailure =
  /** La sesión no sirve: hay que volver a entrar. */
  | { kind: "auth" }
  /** Un filtro con un valor inválido: la API dice **cuál**. */
  | { kind: "filters"; message: string; fields: string[] }
  /** El servidor respondió mal (5xx) después de reintentar. */
  | { kind: "server"; message: string; status: number }
  /** No hubo respuesta (red caída, contenedor reiniciando) después de reintentar. */
  | { kind: "network"; message: string };

export type OrderListReadResult =
  | { ok: true; orders: unknown[]; meta: Record<string, unknown> }
  | { ok: false; failure: OrderListFailure };

const ORDER_STATUSES = [
  "new",
  "confirmed",
  "preparing",
  "ready",
  "ready_for_pickup",
  "out_for_delivery",
  "delivered",
  "picked_up",
  "accepted",
  "served",
  "closed",
  "cancelled",
] as const;

const ORDER_TYPES = ["delivery", "pickup", "table"] as const;
const PAYMENT_METHODS = ["cash", "card"] as const;

function isValidDate(value: string): boolean {
  return value.trim() !== "" && !Number.isNaN(Date.parse(value));
}

export type OrderQueryInput = {
  status?: string | null;
  type?: string | null;
  locationId?: string | null;
  search?: string | null;
  paymentMethod?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  lateOnly?: boolean;
  limit?: number | null;
};

/**
 * El valor del control de sucursal cuando no hay filtro. **No es un id de local**: si viaja, la API lo
 * aplica literal y devuelve 0 pedidos (bug encontrado en el arnés local el 2026-09-18, al verificar el
 * Punto 3). El centinela se queda en la pantalla.
 */
const ALL_LOCATIONS = "all";

/**
 * Arma la consulta con **solo** lo que la API acepta: un filtro con un valor que no corresponde se descarta
 * (y la pantalla sigue funcionando con el resto) en vez de viajar y volver como 400.
 */
export function sanitizeOrderQuery(input: OrderQueryInput): URLSearchParams {
  const params = new URLSearchParams();

  if (input.status && (ORDER_STATUSES as readonly string[]).includes(input.status)) {
    params.set("status", input.status);
  }
  if (input.type && (ORDER_TYPES as readonly string[]).includes(input.type)) {
    params.set("type", input.type);
  }
  const locationId = input.locationId?.trim();
  if (locationId && locationId !== ALL_LOCATIONS) {
    params.set("locationId", locationId);
  }
  if (input.search && input.search.trim() !== "") {
    params.set("search", input.search.trim());
  }
  if (input.paymentMethod && (PAYMENT_METHODS as readonly string[]).includes(input.paymentMethod)) {
    params.set("paymentMethod", input.paymentMethod);
  }
  if (input.dateFrom && isValidDate(input.dateFrom)) {
    params.set("dateFrom", input.dateFrom);
  }
  if (input.dateTo && isValidDate(input.dateTo)) {
    params.set("dateTo", input.dateTo);
  }
  if (input.lateOnly) {
    params.set("lateOnly", "1");
  }
  if (typeof input.limit === "number" && Number.isInteger(input.limit) && input.limit > 0) {
    params.set("limit", String(input.limit));
  }

  return params;
}

const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 600;

/** Un fallo que vale la pena reintentar: la red y el servidor. Un 400/401 no cambia por reintentar. */
function isRetryable(failure: OrderListFailure): boolean {
  return failure.kind === "network" || failure.kind === "server";
}

function failureFromResponse(
  status: number,
  body: { error?: { message?: string; fields?: Record<string, string> } } | null,
): OrderListFailure {
  if (status === 401 || status === 403) {
    return { kind: "auth" };
  }

  if (status === 400 || status === 422) {
    const fields = Object.keys(body?.error?.fields ?? {});

    return {
      kind: "filters",
      fields,
      message:
        fields.length > 0
          ? `Revisá los filtros: ${fields.map((field) => `«${field}»`).join(", ")} no ${fields.length === 1 ? "tiene" : "tienen"} un valor válido.`
          : "Revisá los filtros: hay uno con un valor que no es válido.",
    };
  }

  return {
    kind: "server",
    status,
    message: `El servidor no pudo leer las órdenes (${status}). Probá de nuevo en un momento.`,
  };
}

/**
 * Lee la lista de órdenes: reintenta los fallos transitorios con una espera corta y devuelve **por qué**
 * falló cuando ya no hay nada que hacer. No tira: la pantalla necesita el motivo, no una excepción.
 */
export async function readAdminOrders(input: {
  queryString: string;
  fetchImpl?: typeof fetch;
  retries?: number;
  retryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<OrderListReadResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const retries = input.retries ?? DEFAULT_RETRIES;
  const retryDelayMs = input.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const sleep =
    input.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  let lastFailure: OrderListFailure = {
    kind: "network",
    message: "No hubo respuesta del servidor. Revisá la conexión.",
  };

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchImpl(
        `/api/admin/orders${input.queryString ? `?${input.queryString}` : ""}`,
      );

      if (response.ok) {
        const payload = (await response.json()) as {
          data?: unknown[];
          meta?: Record<string, unknown>;
        };

        return { ok: true, orders: payload.data ?? [], meta: payload.meta ?? {} };
      }

      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string; fields?: Record<string, string> };
      } | null;

      lastFailure = failureFromResponse(response.status, body);
    } catch {
      lastFailure = {
        kind: "network",
        message: "No se pudo hablar con el servidor. Revisá la conexión y probá de nuevo.",
      };
    }

    if (!isRetryable(lastFailure) || attempt === retries) break;

    await sleep(retryDelayMs);
  }

  return { ok: false, failure: lastFailure };
}
