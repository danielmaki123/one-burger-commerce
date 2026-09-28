import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";
import { currencyKey } from "@/modules/money/domain/convert-to-base-currency";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-019`) — **el catálogo de monedas es conveniencia, no una
 * restricción**.
 *
 * El contrato viejo era «ISO de 3 letras» (`/^[A-Z]{3}$/`): una moneda personalizada con código interno no
 * podía existir, y varios lugares del código asumían que la única moneda extranjera era el dólar. El
 * negocio opera internacionalmente: el catálogo **conoce** las comunes (para no hacer tipear nombre y
 * símbolo) y **acepta** las que el dueño cargue.
 *
 * `decimals` es del catálogo y no del formateador: formatear con dos decimales una moneda de cero es un bug
 * de presentación, y guardar con dos una de tres es un bug de dinero.
 */

export const MIN_CURRENCY_DECIMALS = 0;
export const MAX_CURRENCY_DECIMALS = 4;
export const MAX_CURRENCY_CODE_LENGTH = 12;

export type CurrencyDraft = {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  isKnown: boolean;
};

export type KnownCurrency = Omit<CurrencyDraft, "isKnown">;

/**
 * Las monedas que el sistema **conoce** de fábrica. No es una lista cerrada —el catálogo vive en la base y
 * una moneda personalizada es válida—, es la conveniencia con la que el admin completa un formulario.
 *
 * `NIO` toma su símbolo y su locale de `business-settings-defaults.ts`, que es la **única** fuente legítima
 * de los literales del negocio (`AGENTS.md` § *UI y design system*): este módulo describe monedas, no
 * configura el negocio, y por eso no repite el `C$`.
 */
export const KNOWN_CURRENCIES: readonly KnownCurrency[] = [
  {
    code: DEFAULT_BUSINESS_SETTINGS.currencyCode,
    name: "Córdoba nicaragüense",
    symbol: DEFAULT_BUSINESS_SETTINGS.currencySymbol,
    decimals: 2,
  },
  { code: "USD", name: "Dólar estadounidense", symbol: "US$", decimals: 2 },
  { code: "EUR", name: "Euro", symbol: "€", decimals: 2 },
  { code: "MXN", name: "Peso mexicano", symbol: "MX$", decimals: 2 },
  { code: "GTQ", name: "Quetzal guatemalteco", symbol: "Q", decimals: 2 },
  { code: "CRC", name: "Colón costarricense", symbol: "₡", decimals: 2 },
  { code: "PAB", name: "Balboa panameño", symbol: "B/.", decimals: 2 },
  { code: "COP", name: "Peso colombiano", symbol: "COL$", decimals: 2 },
  { code: "JPY", name: "Yen japonés", symbol: "¥", decimals: 0 },
  { code: "CAD", name: "Dólar canadiense", symbol: "CA$", decimals: 2 },
  { code: "GBP", name: "Libra esterlina", symbol: "£", decimals: 2 },
  { code: "BRL", name: "Real brasileño", symbol: "R$", decimals: 2 },
];

export function normalizeCurrencyCode(code: string): string {
  return currencyKey(code);
}

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-019`) — los **locales** que el dueño puede elegir para el formato
 * regional.
 *
 * Es la conveniencia del formulario, igual que `KNOWN_CURRENCIES`: un locale distinto es válido y se puede
 * escribir a mano, pero tener los comunes a mano evita que el dueño tenga que saber de memoria que se
 * escribe `es-NI` y no `es_NI`.
 */
export const KNOWN_LOCALES: readonly { value: string; label: string }[] = [
  { value: "es-NI", label: "Español (Nicaragua)" },
  { value: "es-MX", label: "Español (México)" },
  { value: "es-CR", label: "Español (Costa Rica)" },
  { value: "es-GT", label: "Español (Guatemala)" },
  { value: "es-PA", label: "Español (Panamá)" },
  { value: "es-CO", label: "Español (Colombia)" },
  { value: "es-US", label: "Español (Estados Unidos)" },
  { value: "en-US", label: "Inglés (Estados Unidos)" },
];

const LOCALE_PATTERN = /^[a-z]{2}-[A-Z]{2}$/;

/** Un locale con forma de locale (`es-NI`). No valida que exista: eso es del navegador. */
export function isLocaleShaped(locale: string): boolean {
  return LOCALE_PATTERN.test(locale.trim());
}

/** Dos códigos nombran la misma moneda. */
export function isSameCurrency(a: string, b: string): boolean {
  return currencyKey(a) === currencyKey(b);
}

/** Alias explícito del normalizador, para el código que se lee de una fila del catálogo. */
export function currencyCodeKey(code: string): string {
  return currencyKey(code);
}

export function findKnownCurrency(code: string): KnownCurrency | null {
  const key = currencyKey(code);

  return KNOWN_CURRENCIES.find((currency) => currency.code === key) ?? null;
}

/** El error de un borrador inválido, con el campo que lo causó (la ruta lo mapea a 422). */
export type CurrencyDraftError = {
  field: "code" | "name" | "symbol" | "decimals";
  message: string;
};

function validateDraftShape(draft: {
  code: string;
  name?: string | null;
  symbol?: string | null;
  decimals?: number | null;
}): CurrencyDraftError | null {
  const code = normalizeCurrencyCode(draft.code ?? "");

  if (code.length < 2) {
    return { field: "code", message: "Poné el código de la moneda." };
  }

  if (code.length > MAX_CURRENCY_CODE_LENGTH) {
    return { field: "code", message: `El código no puede pasar de ${MAX_CURRENCY_CODE_LENGTH} caracteres.` };
  }

  if (!/^[A-Z0-9]+$/.test(code)) {
    return { field: "code", message: "El código sólo lleva letras y números." };
  }

  const known = findKnownCurrency(code);

  if (!known) {
    if (!draft.name?.trim()) {
      return { field: "name", message: "Poné el nombre de la moneda." };
    }

    if (!draft.symbol?.trim()) {
      return { field: "symbol", message: "Poné el símbolo de la moneda." };
    }
  }

  if (draft.decimals !== undefined && draft.decimals !== null) {
    if (
      !Number.isInteger(draft.decimals) ||
      draft.decimals < MIN_CURRENCY_DECIMALS ||
      draft.decimals > MAX_CURRENCY_DECIMALS
    ) {
      return {
        field: "decimals",
        message: `Los decimales van de ${MIN_CURRENCY_DECIMALS} a ${MAX_CURRENCY_DECIMALS}.`,
      };
    }
  }

  return null;
}

/**
 * Normaliza y valida un borrador de moneda. Una moneda **conocida** se completa del catálogo; una
 * **personalizada** exige nombre y símbolo propios (`D-019`).
 */
export function assertCurrencyDraft(draft: {
  code: string;
  name?: string | null;
  symbol?: string | null;
  decimals?: number | null;
}): CurrencyDraft {
  const error = validateDraftShape(draft);

  if (error) {
    throw new Error(`${error.field}: ${error.message}`);
  }

  const code = normalizeCurrencyCode(draft.code);
  const known = findKnownCurrency(code);

  if (known) {
    return {
      code: known.code,
      name: draft.name?.trim() || known.name,
      symbol: draft.symbol?.trim() || known.symbol,
      decimals: draft.decimals ?? known.decimals,
      isKnown: true,
    };
  }

  return {
    code,
    name: (draft.name ?? "").trim(),
    symbol: (draft.symbol ?? "").trim(),
    decimals: draft.decimals ?? 2,
    isKnown: false,
  };
}

/** La variante que no tira: `null` cuando el borrador no es válido. */
export function resolveCurrencyDraft(draft: {
  code: string;
  name?: string | null;
  symbol?: string | null;
  decimals?: number | null;
}): CurrencyDraft | null {
  try {
    return assertCurrencyDraft(draft);
  } catch {
    return null;
  }
}
