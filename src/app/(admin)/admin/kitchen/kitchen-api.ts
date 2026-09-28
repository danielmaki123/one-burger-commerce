import type { KitchenOrdersResult } from "@/modules/orders/features/list-kitchen-orders/kitchen-order-projection";

/**
 * La lectura de la cola de **Cocina**, con la red de seguridad de la bandeja de Pedidos.
 *
 * Un fallo de red en una cocina **no** puede dejar la pantalla sin comandas: la pantalla conserva lo último
 * que leyó y dice qué pasó. Por eso esta lectura **no tira**: devuelve el motivo y la pantalla elige la
 * acción (reintentar), igual que `order-list-api.ts` de Órdenes. Se reintentan los fallos transitorios
 * (red y 5xx), nunca un 401/403: eso no cambia por reintentar.
 *
 * Vive en la pantalla y no en el módulo de pedidos porque es el **cliente** de la API: el módulo dueño del
 * caso de uso y del contrato es `orders`.
 */

export type KitchenReadFailure =
  | { kind: "auth" }
  | { kind: "server"; message: string; status: number }
  | { kind: "network"; message: string };

export type KitchenReadResult =
  | ({ ok: true } & KitchenOrdersResult)
  | { ok: false; failure: KitchenReadFailure };

export function kitchenOrdersQuery(input: { search?: string; locationId?: string | null }): string {
  const params = new URLSearchParams();
  const search = input.search?.trim();

  if (search) params.set("search", search);
  if (input.locationId && input.locationId !== "all") params.set("locationId", input.locationId);

  const query = params.toString();

  return query ? `?${query}` : "";
}

const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 600;

function isRetryable(failure: KitchenReadFailure): boolean {
  return failure.kind === "network" || failure.kind === "server";
}

function failureFromResponse(status: number): KitchenReadFailure {
  if (status === 401 || status === 403) return { kind: "auth" };

  return {
    kind: "server",
    status,
    message: `El servidor no pudo leer las comandas (${status}). Probá de nuevo en un momento.`,
  };
}

export async function readKitchenOrders(input: {
  queryString: string;
  fetchImpl?: typeof fetch;
  retries?: number;
  retryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<KitchenReadResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const retries = input.retries ?? DEFAULT_RETRIES;
  const retryDelayMs = input.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const sleep =
    input.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  let lastFailure: KitchenReadFailure = {
    kind: "network",
    message: "No hubo respuesta del servidor. Revisá la conexión.",
  };

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchImpl(`/api/admin/kitchen/orders${input.queryString}`);

      if (response.ok) {
        const payload = (await response.json()) as KitchenOrdersResult;

        return { ok: true, data: payload.data ?? [], meta: payload.meta };
      }

      lastFailure = failureFromResponse(response.status);
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
