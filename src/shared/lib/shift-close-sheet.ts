import {
  formatSheetAmount,
  formatSheetDelta,
  formatSheetMoment,
  formatSheetMovement,
  formatSheetTotal,
  SHIFT_SIGNATURE_LINE,
  type ShiftSheetOptions,
} from "@/shared/lib/shift-sheet-format";

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
 * El formato de plata es el de `shift-sheet-format`, compartido con el **corte X** (tarea 7): el mismo
 * turno no puede imprimirse distinto según qué papel se saque.
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

/**
 * Fase 3 del rediseño de Caja (2026-09-23) — una fila del **cuadre por banco**: lo que declaró el banco
 * para este turno, con el lote y la terminal que reportó.
 */
export type ShiftCloseSheetBankRow = {
  bankName: string;
  currency: string;
  declaredAmount: number;
  lote: string | null;
  terminalLabel: string | null;
};

/** Lo cobrado sin pasar por el cajón y la diferencia del cuadre, ya congelados al cerrar. */
export type ShiftCloseSheetBankConsolidated = {
  charged: number | null;
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
  /**
   * Fase 3 del rediseño de Caja (2026-09-23) — el **cuadre por banco**: lo declarado por cada banco.
   * Vacío = el turno se cerró sin declarar lotes y la sección no se imprime.
   */
  bankRows?: ShiftCloseSheetBankRow[];
  /** Lo cobrado sin pasar por el cajón y la diferencia del cuadre, congelados al cerrar. */
  bankConsolidated?: ShiftCloseSheetBankConsolidated;
};

/**
 * Fase 3 — el cuadre por banco: una línea por lote declarado, con su terminal, y el consolidado contra lo
 * que el sistema cobró con tarjeta y transferencia. Los números llegan congelados del turno (no se
 * recalculan acá): el papel de un cierre firmado no puede cambiar porque después se editó un cobro.
 */
export function buildShiftCloseBankLines(
  input: ShiftCloseSheetInput,
  options: ShiftSheetOptions,
): string[] {
  const rows = input.bankRows ?? [];

  if (rows.length === 0) return [];

  const lines = rows.map((row) => {
    const reference = [row.terminalLabel?.trim(), row.lote?.trim() ? `lote ${row.lote.trim()}` : null]
      .filter(Boolean)
      .join(" · ");

    return `${row.bankName}  ${row.currency.toUpperCase()}  declarado ${formatSheetAmount(
      row.declaredAmount,
      row.currency,
      options,
    )}${reference ? `  (${reference})` : ""}`;
  });

  const charged = input.bankConsolidated?.charged ?? null;
  const difference = input.bankConsolidated?.difference ?? null;

  lines.push(
    `Tarjeta + transferencia: ${
      charged === null ? "—" : formatSheetAmount(charged, options.currencyCode, options)
    }`,
  );
  lines.push(
    `Diferencia de bancos: ${
      difference === null
        ? "Sin cuadre"
        : formatSheetDelta(difference, options.currencyCode, options)
    }`,
  );

  return lines;
}

/** Los billetes contados al cerrar, en el orden en que llegan (ya vienen del depósito). */
export function buildShiftCloseCountLines(
  input: ShiftCloseSheetInput,
  options: ShiftSheetOptions,
): string[] {
  if (input.countLines.length === 0) return ["Sin conteo cargado al cerrar."];

  return input.countLines.map(
    (line) =>
      `${line.quantity} x ${line.currency.toUpperCase()} ${line.denomination} = ${formatSheetAmount(
        line.amount,
        line.currency,
        options,
      )}`,
  );
}

/** El arqueo por moneda: esperado, contado y la diferencia con su signo. */
export function buildShiftCloseCurrencyLines(
  input: ShiftCloseSheetInput,
  options: ShiftSheetOptions,
): string[] {
  if (input.currencyRows.length === 0) {
    return ["Sin detalle por moneda guardado (el total quedó congelado al cerrar)."];
  }

  return input.currencyRows.map((row) => {
    const counted =
      row.counted === null ? "Sin contar" : formatSheetAmount(row.counted, row.currency, options);

    return `${row.currency.toUpperCase()}  esperado ${formatSheetAmount(
      row.expected,
      row.currency,
      options,
    )}  contado ${counted}  ${formatSheetDelta(row.difference ?? 0, row.currency, options)}`;
  });
}

/** La hoja completa, línea por línea, lista para imprimir. */
export function buildShiftCloseSheet(
  input: ShiftCloseSheetInput,
  options: ShiftSheetOptions,
): string[] {
  const { totals } = input;
  const bankLines = buildShiftCloseBankLines(input, options);
  const lines: string[] = [
    options.businessName.toUpperCase(),
    "CIERRE DE CAJA",
    `Sucursal: ${input.locationName}`,
    `Abierto: ${formatSheetMoment(input.openedAt, options)}`,
    `Cerrado: ${input.status === "open" ? "sin cerrar" : formatSheetMoment(input.closedAt, options)}`,
    "",
    "CONTEO AL CERRAR",
    ...buildShiftCloseCountLines(input, options),
    "",
    "ARQUEO POR MONEDA",
    ...buildShiftCloseCurrencyLines(input, options),
    "",
    "TOTALES",
    `Fondo: ${formatSheetTotal(totals.opening, options)}`,
    `Contado: ${formatSheetTotal(totals.counted, options)}`,
    `Esperado: ${formatSheetTotal(totals.expected, options)}`,
    `Diferencia: ${
      totals.difference === null
        ? "Sin contar"
        : formatSheetDelta(totals.difference, options.currencyCode, options)
    }`,
    `Ventas en efectivo: ${formatSheetTotal(totals.cashSales, options)}`,
    `Movimientos: ${
      totals.movements === null ? "—" : formatSheetMovement(totals.movements, options)
    }`,
    `Devoluciones aprobadas en efectivo: ${formatSheetTotal(totals.refunds, options)}`,
  ];

  // Fase 3 del rediseño de Caja: el cuadre por banco va entre los totales y la nota (es parte del arqueo).
  if (bankLines.length > 0) {
    lines.push("", "CUADRE POR BANCO", ...bankLines);
  }

  if (input.notes?.trim()) {
    lines.push("", `NOTA: ${input.notes.trim()}`);
  }

  lines.push("", `Cerró: ${input.closedByName?.trim() || "—"}`, SHIFT_SIGNATURE_LINE);

  return lines;
}
