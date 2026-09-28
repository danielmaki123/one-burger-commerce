import type { PaymentMethodKind } from "@/modules/payments/domain/payment-snapshot";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-016`, `D-018`) — **el contrato del cliente de Finanzas**.
 *
 * La pantalla **no guarda reglas de dinero**: pide y manda. Lo que vive acá es la traducción de
 * `fetch` a un resultado con forma (`{ ok }`), para que el componente no tenga que decidir si un
 * `response.ok` es un error de red o un 422 del dominio — y para que **ningún** error del servidor se
 * pierda en un `catch` vacío.
 */

export type { PaymentMethodKind };

export const PAYMENT_METHOD_KIND_LABELS: Record<PaymentMethodKind, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  bank_transfer: "Transferencia bancaria",
  wallet: "Billetera digital",
  other: "Otro",
};

export type FinanceCurrency = {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  isKnown: boolean;
  isActive: boolean;
  sortOrder: number;
};

export type FinanceCurrencySettings = {
  baseCurrencyCode: string;
  locale: string;
  currencies: FinanceCurrency[];
  activeRates: { fromCurrencyCode: string; toCurrencyCode: string; rate: number; effectiveFrom: string }[];
};

export type FinancePaymentMethod = {
  id: string;
  name: string;
  kind: PaymentMethodKind;
  entityId: string | null;
  currencyCodes: string[];
  requiresReference: boolean;
  isActive: boolean;
  sortOrder: number;
};

export type FinanceEntity = {
  id: string;
  name: string;
  code: string | null;
  entityType?: string;
  isActive: boolean;
  sortOrder: number;
};

export type FinanceConfig = {
  settings: FinanceCurrencySettings;
  knownCurrencies: { code: string; name: string; symbol: string; decimals: number }[];
  knownLocales: { value: string; label: string }[];
  entities: FinanceEntity[];
  paymentMethods: FinancePaymentMethod[];
};

type ApiResult<T> = { ok: true; data: T } | { ok: false; message: string; fields?: Record<string, string> };

/** Un comando de la pantalla: el `action` que espera la ruta y su payload. */
type FinanceCommand =
  | {
      action: "save-currency";
      payload: {
        code: string;
        name?: string | null;
        symbol?: string | null;
        decimals?: number | null;
        isActive?: boolean;
        mode?: "create" | "update";
      };
    }
  | { action: "register-rate"; payload: { fromCurrencyCode: string; rate: number } }
  | { action: "change-base-currency"; payload: { code: string; locale?: string } }
  | {
      action: "save-payment-method";
      payload: {
        id?: string;
        name: string;
        kind: PaymentMethodKind;
        entityId?: string | null;
        currencyCodes?: string[];
        requiresReference?: boolean;
        isActive?: boolean;
      };
    }
  | {
      action: "save-entity";
      payload: {
        id?: string;
        name: string;
        code?: string | null;
        entityType: string;
        isActive?: boolean;
      };
    };

export function createFinanceApi(fetchImpl: typeof fetch = fetch) {
  async function request<T>(init: RequestInit): Promise<ApiResult<T>> {
    try {
      const response = await fetchImpl("/api/admin/finance", {
        ...init,
        headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
        cache: "no-store",
      });
      const body = (await response.json().catch(() => ({}))) as {
        data?: T;
        error?: { message?: string; fields?: Record<string, string> };
      };

      if (!response.ok || body.data === undefined) {
        const fields = body.error?.fields ?? {};

        return {
          ok: false,
          // El mensaje del campo es el útil cuando el servidor señala uno; si no, el mensaje general.
          message: fields[Object.keys(fields)[0] ?? ""] ?? body.error?.message ?? "No se pudo completar.",
          fields,
        };
      }

      return { ok: true, data: body.data };
    } catch {
      return { ok: false, message: "No hubo respuesta del servidor: revisá la conexión." };
    }
  }

  async function command(command: FinanceCommand): Promise<{ ok: true } | { ok: false; message: string }> {
    const result = await request<unknown>({
      method: "POST",
      body: JSON.stringify(command),
    });

    return result.ok ? { ok: true } : { ok: false, message: result.message };
  }

  return {
    read: () => request<FinanceConfig>({ method: "GET" }),
    saveCurrency: (payload: Extract<FinanceCommand, { action: "save-currency" }>["payload"]) =>
      command({ action: "save-currency", payload }),
    registerRate: (payload: { fromCurrencyCode: string; rate: number }) =>
      command({ action: "register-rate", payload }),
    changeBaseCurrency: (payload: { code: string; locale?: string }) =>
      command({ action: "change-base-currency", payload }),
    savePaymentMethod: (
      payload: Extract<FinanceCommand, { action: "save-payment-method" }>["payload"],
    ) => command({ action: "save-payment-method", payload }),
    saveEntity: (payload: Extract<FinanceCommand, { action: "save-entity" }>["payload"]) =>
      command({ action: "save-entity", payload }),
  };
}
