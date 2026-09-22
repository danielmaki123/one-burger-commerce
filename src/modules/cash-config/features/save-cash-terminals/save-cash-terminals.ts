import { CashConfigError } from "@/modules/cash-config/domain/cash-config-errors";
import type { PosTerminalRecord } from "@/modules/cash-config/domain/cash-config.types";
import type { CashConfigRepository } from "@/modules/cash-config/ports/cash-config-repository";

/**
 * Fase 6 del rediseño de Caja (2026-09-23) — **guardar las terminales de una sucursal**.
 *
 * El formulario manda el estado completo de esa sucursal (como el de los billetes): las que están, con su
 * etiqueta y su estado. Dos reglas que la base no puede explicar sola:
 *
 * 1. **La etiqueta es única por sucursal**: dos «Caja 1» en el mismo local no se distinguen al elegir y el
 *    índice único lo rechazaría con un error de servidor; acá se dice con palabras y por fila.
 * 2. **Una terminal no se borra, se apaga**: un turno viejo la referencia (`Shift.terminalId`) y el
 *    `onDelete: Restrict` de la base lo exige. Lo hace el adaptador.
 */

const MAX_LABEL = 40;

export async function saveCashTerminals(
  input: { locationId: string; terminals: readonly Omit<PosTerminalRecord, "locationId">[] },
  { repository }: { repository: CashConfigRepository },
): Promise<{ terminals: PosTerminalRecord[] }> {
  const rows: PosTerminalRecord[] = input.terminals.map((terminal, index) => ({
    id: (terminal.id ?? "").trim(),
    locationId: input.locationId,
    label: (terminal.label ?? "").trim(),
    isActive: terminal.isActive !== false,
    sortOrder: Number.isInteger(terminal.sortOrder) ? terminal.sortOrder : index,
  }));

  const fields = validate(rows);
  if (Object.keys(fields).length > 0) {
    throw new CashConfigError(422, "VALIDATION_ERROR", "Revisá las terminales.", fields);
  }

  return { terminals: await repository.replacePosTerminals(input.locationId, rows) };
}

/** Los errores por fila, keyed como los espera el formulario (`terminals.0.label`). */
function validate(rows: readonly PosTerminalRecord[]): Record<string, string> {
  const fields: Record<string, string> = {};
  const labels = new Map<string, number>();

  rows.forEach((row, index) => {
    if (row.id.length === 0) {
      fields[`terminals.${index}.id`] = "Falta el identificador de la terminal.";
      return;
    }

    if (row.label.length === 0) {
      fields[`terminals.${index}.label`] = "Escribí el nombre de la terminal.";
      return;
    }

    if (row.label.length > MAX_LABEL) {
      fields[`terminals.${index}.label`] = `Máximo ${MAX_LABEL} caracteres.`;
      return;
    }

    const key = row.label.toLowerCase();
    if (labels.has(key)) {
      fields[`terminals.${index}.label`] = "Ya hay una terminal con ese nombre.";
      return;
    }

    labels.set(key, index);
  });

  return fields;
}
