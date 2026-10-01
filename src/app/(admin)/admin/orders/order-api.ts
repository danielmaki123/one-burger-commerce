/**
 * `TASK-ORDERS-RUNTIME-5B` — la lectura del listado de Pedidos, con su traducción de fallos.
 *
 * Es la misma idea que el `readAdminOrders` de la bandeja vieja —**sanea** lo que se manda y **reintenta**
 * sólo lo que tiene sentido reintentar (red y 5xx, nunca un 400/401/403)—, pero contra el read model nuevo:
 * devuelve `data`, `meta` (paginación) y `kpi`, y conserva lo último leído cuando un refresco falla.
 */

export type OrderListFailureKind =
  /** La sesión no sirve: hay que volver a entrar. */
  | "auth"
  /** El rol no entra a Pedidos (cocina): es un mensaje de **permiso**, no de sesión (`A-66`). */
  | "forbidden"
  /** Un filtro con un valor inválido: la API dice cuál. */
  | "filters"
  /** El servidor respondió mal (5xx) después de reintentar. */
  | "server"
  /** No hubo respuesta (red caída, contenedor reiniciando) después de reintentar. */
  | "network";

export type OrderListFailure = { kind: OrderListFailureKind; message: string; fields: string[] };

export type OrderListPayload = {
  data: Array<Record<string, unknown>>;
  meta: { page?: number; pageSize?: number; total?: number; locationScope?: string[] | null };
  kpi: { total?: number; active?: number; pendingPayment?: number; scheduled?: number };
};

export type OrderListReadResult =
  | { ok: true; payload: OrderListPayload }
  | { ok: false; failure: OrderListFailure };

const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 600;

/** Un fallo que vale la pena reintentar: la red y el servidor. Un 400/401/403 no cambia por reintentar. */
function isRetryable(failure: OrderListFailure): boolean {
  return failure.kind === "network" || failure.kind === "server";
}

function failureFromResponse(
  status: number,
  body: { error?: { message?: string; fields?: Record<string, string> } } | null,
): OrderListFailure {
  if (status === 401) return { kind: "auth", message: "Sesión vencida.", fields: [] };

  if (status === 403) {
    return {
      kind: "forbidden",
      message: "Tu usuario no revisa Pedidos.",
      fields: [],
    };
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
    message: `El servidor no pudo leer los pedidos (${status}). Probá de nuevo en un momento.`,
    fields: [],
  };
}

/**
 * Lee el listado: reintenta los fallos transitorios con una espera corta y devuelve **por qué** falló cuando
 * ya no hay nada que hacer. No tira: la pantalla necesita el motivo, no una excepción.
 */
export async function readOrderList(input: {
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
    fields: [],
  };

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchImpl(
        `/api/admin/orders${input.queryString ? `?${input.queryString}` : ""}`,
        { cache: "no-store" },
      );

      if (response.ok) {
        const body = (await response.json()) as Partial<OrderListPayload>;

        return {
          ok: true,
          payload: {
            data: (body.data ?? []) as Array<Record<string, unknown>>,
            meta: body.meta ?? {},
            kpi: body.kpi ?? {},
          },
        };
      }

      const errorBody = (await response.json().catch(() => null)) as {
        error?: { message?: string; fields?: Record<string, string> };
      } | null;

      lastFailure = failureFromResponse(response.status, errorBody);
    } catch {
      lastFailure = {
        kind: "network",
        message: "No se pudo hablar con el servidor. Revisá la conexión y probá de nuevo.",
        fields: [],
      };
    }

    if (!isRetryable(lastFailure) || attempt === retries) break;

    await sleep(retryDelayMs);
  }

  return { ok: false, failure: lastFailure };
}

/** Lee el detalle de un pedido. 403 y 404 tienen su propio mensaje: los dos se explican solos. */
export async function readOrderDetail(
  orderId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; kind: OrderListFailureKind; message: string }
> {
  try {
    const response = await fetchImpl(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
      cache: "no-store",
    });

    if (response.ok) {
      const body = (await response.json()) as { data?: Record<string, unknown> };

      return { ok: true, data: body.data ?? {} };
    }

    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;

    if (response.status === 401) {
      return { ok: false, kind: "auth", message: "Sesión vencida." };
    }

    if (response.status === 403) {
      return {
        ok: false,
        kind: "forbidden",
        message: body?.error?.message ?? "Tu usuario no revisa Pedidos.",
      };
    }

    if (response.status === 404) {
      return { ok: false, kind: "server", message: "Ese pedido no existe." };
    }

    return {
      ok: false,
      kind: "server",
      message: body?.error?.message ?? "No se pudo cargar el detalle del pedido.",
    };
  } catch {
    return {
      ok: false,
      kind: "network",
      message: "No se pudo hablar con el servidor. Revisá la conexión y probá de nuevo.",
    };
  }
}
