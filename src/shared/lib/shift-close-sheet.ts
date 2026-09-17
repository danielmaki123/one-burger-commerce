import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { formatShiftDateTime } from "@/shared/lib/shift-datetime";

/**
 * Bloque 13.3 del roadmap del POS (Fase 2) — la **hoja de cierre**, en texto plano.
 *
 * El cierre de caja es el único documento del turno que termina **firmado**: lo que se imprime tiene que
 * decir qué se contó, qué se esperaba, cuánto fue la diferencia y **quién cierra** — con nombre, no con
 * el id de la sesión. También sirve de comprobante para el local (Bloque 1.6): se imprime bajo demanda
 * desde el detalle del cierre.
 *
 * Es una función pura (datos adentro, texto afuera) para poder probarla sin navegador; el dibujo y la
 * impresión viven en el componente que la usa. Los **números no se recalculan acá**: llegan ya
 * resueltos por la pantalla, que usa los mismos helpers que ve el humano (una sola fuente por cálculo).
 * Lo que sí decide este módulo es cómo se dice: un turno sin contar dice «Sin contar», una moneda que
 * cuadra dice «sin diferencia» y un dato que no está no se estima.
 */

export type ShiftCloseSheetCountLine = {
  currency: string;
  denomination: number;
  quantity: number;
  /** Total de la línea (`denomination * quantity`), ya calculado por la pantalla. */
  amount: number;
};

export type ShiftCloseSheetCurrencyRow = {
  currency: string;
  expected: number;
  counted: number | null;
  difference: number | null;
};

export type ShiftCloseSheetInput = {
  status: string;
  openedAt: string;
  closedAt: string | null;
  locationName: string;
  notes: string | null;
  /** Conteo **del cierre** (billete por billete). */
  countLines: ShiftCloseSheetCountLine[];
  currencyRows: ShiftCloseSheetCurrencyRow[];
  totals: {
    opening: number;
    counted: number | null;
    expected: number | null;
    difference: number | null;
    cashSales: number | null;
    movements: number | null;
    refunds: number | null;
  };
  /** Nombre de quien cierra. `null` = no se pudo resolver: se imprime «—». */
  closedByName: string | null;
};

export type ShiftCloseSheetOptions = {
  businessName: string;
  timezone: string;
  locale: string;
  currencyCode: string;
  currencySymbol: string;
};

const SIGNATURE_LINE = "Firma: ______________________________";

function currencyFormat(currencyCode: string, options: ShiftCloseSheetOptions): CurrencyFormat {
  return { symbol: options.currencySymbol, locale: options.locale };
}

/**
 * Una moneda distinta a la del negocio se imprime con **su** código (`USD 20.00`): ponerle el símbolo
 * local a dólares es un número falso en un papel que se firma.
 */
function formatInCurrency(
  amount: number,
  currency: string,
  options: ShiftCloseSheetOptions,
): string {
  if (currency.toUpperCase() === options.currencyCode.toUpperCase()) {
    return formatCurrency(amount, currencyFormat(currency, options));
  }

  return formatCurrency(amount, { symbol: `${currency.toUpperCase()} `, locale: options.locale });
}

/** `-C$100.00` / `+C$50.00` / `sin diferencia`, con el símbolo de su moneda. */
function formatDelta(
  amount: number,
  currency: string,
  options: ShiftCloseSheetOptions,
): string {
  if (amount === 0) return "sin diferencia";

  return `${amount > 0 ? "+" : "-"}${formatInCurrency(Math.abs(amount), currency, options)}`;
}

function formatMoment(iso: string | null, options: ShiftCloseSheetOptions): string {
  return formatShiftDateTime(iso, { timezone: options.timezone, locale: options.locale });
}

/** Los billetes contados al cerrar, en el orden en que llegan (ya vienen del depósito). */
export function buildShiftCloseCountLines(
  input: ShiftCloseSheetInput,
  options: ShiftCloseSheetOptions,
): string[] {
  if (input.countLines.length === 0) return ["Sin conteo cargado al cerrar."];

  return input.countLines.map(
    (line) =>
      `${line.quantity} x ${line.currency.toUpperCase()} ${line.denomination} = ${formatInCurrency(
        line.amount,
        line.currency,
        options,
      )}`,
  );
}

/** El arqueo por moneda: esperado, contado y la diferencia con su signo. */
export function buildShiftCloseCurrencyLines(
  input: ShiftCloseSheetInput,
  options: ShiftCloseSheetOptions,
): string[] {
  if (input.currencyRows.length === 0) {
    return ["Sin detalle por moneda guardado (el total quedó congelado al cerrar)."];
  }

  return input.currencyRows.map((row) => {
    const counted =
      row.counted === null ? "Sin contar" : formatInCurrency(row.counted, row.currency, options);

    return `${row.currency.toUpperCase()}  esperado ${formatInCurrency(
      row.expected,
      row.currency,
      options,
    )}  contado ${counted}  ${formatDelta(row.difference ?? 0, row.currency, options)}`;
  });
}

/** La hoja completa, línea por línea, lista para imprimir. */
export function buildShiftCloseSheet(
  input: ShiftCloseSheetInput,
  options: ShiftCloseSheetOptions,
): string[] {
  const { totals } = input;
  const formatTotal = (amount: number | null) =>
    amount === null ? "Sin contar" : formatInCurrency(amount, options.currencyCode, options);
  const lines: string[] = [
    options.businessName.toUpperCase(),
    "CIERRE DE CAJA",
    `Sucursal: ${input.locationName}`,
    `Abierto: ${formatMoment(input.openedAt, options)}`,
    `Cerrado: ${
      input.status === "open" ? "sin cerrar" : formatMoment(input.closedAt, options)
    }`,
    "",
    "CONTEO AL CERRAR",
    ...buildShiftCloseCountLines(input, options),
    "",
    "ARQUEO POR MONEDA",
    ...buildShiftCloseCurrencyLines(input, options),
    "",
    "TOTALES",
    `Fondo: ${formatTotal(totals.opening)}`,
    `Contado: ${formatTotal(totals.counted)}`,
    `Esperado: ${formatTotal(totals.expected)}`,
    `Diferencia: ${
      totals.difference === null
        ? "Sin contar"
        : formatDelta(totals.difference, options.currencyCode, options)
    }`,
    `Ventas en efectivo: ${formatTotal(totals.cashSales)}`,
    `Movimientos: ${
      totals.movements === null
        ? "—"
        : totals.movements === 0
          ? "sin movimientos"
          : formatDelta(totals.movements, options.currencyCode, options)
    }`,
    `Devoluciones aprobadas en efectivo: ${formatTotal(totals.refunds)}`,
  ];

  if (input.notes?.trim()) {
    lines.push("", `NOTA: ${input.notes.trim()}`);
  }

  lines.push("", `Cerró: ${input.closedByName?.trim() || "—"}`, SIGNATURE_LINE);

  return lines;
}
