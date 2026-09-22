import type { BankCatalogEntry, BankRecord, LocationBankRecord } from "./bank.types";

/**
 * Fase 3 del rediseño de Caja (2026-09-23) — las reglas del catálogo de bancos.
 *
 * El catálogo se edita **entero** (igual que las denominaciones): la pantalla manda la lista completa y el
 * servidor la valida junta, porque las reglas que importan son **entre filas** — no puede haber dos bancos
 * con el mismo nombre ni con el mismo código corto, y eso no se ve mirando una fila sola.
 *
 * Los bancos **no se borran**: se apagan. Un cierre viejo sigue diciendo con quién se liquidó, y el
 * `onDelete: Restrict` de la base lo haría fallar de todos modos.
 */

const MAX_NAME = 60;
const MAX_CODE = 12;

/**
 * Valida el catálogo completo y devuelve los errores por fila, para señalarlos en el formulario.
 */
export function validateBankCatalog(
  entries: readonly BankCatalogEntry[],
): Record<string, string> {
  const fields: Record<string, string> = {};
  const names = new Map<string, number>();
  const codes = new Map<string, number>();

  entries.forEach((entry, index) => {
    const name = (entry.name ?? "").trim();

    if (!name) {
      fields[`banks.${index}.name`] = "Escribí el nombre del banco.";
    } else if (name.length > MAX_NAME) {
      fields[`banks.${index}.name`] = `Máximo ${MAX_NAME} caracteres.`;
    } else {
      const key = name.toLowerCase();
      const first = names.get(key);

      if (first !== undefined) {
        fields[`banks.${index}.name`] = "Ya hay un banco con ese nombre.";
      } else {
        names.set(key, index);
      }
    }

    const code = normalizeBankCode(entry.code);

    if (code === null) return;

    if (code.length > MAX_CODE) {
      fields[`banks.${index}.code`] = `Máximo ${MAX_CODE} caracteres.`;
      return;
    }

    const firstCode = codes.get(code);

    if (firstCode !== undefined) {
      fields[`banks.${index}.code`] = "Ya hay un banco con ese código.";
      return;
    }

    codes.set(code, index);
  });

  return fields;
}

/** El código corto, en mayúsculas. Vacío es `null`: dos cadenas vacías chocarían en el índice único. */
export function normalizeBankCode(code: string | null | undefined): string | null {
  const trimmed = (code ?? "").trim().toUpperCase();

  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Junta el catálogo con las asignaciones: el banco con las sucursales donde está **activo**.
 *
 * Dos cosas no cuentan y las dos son a propósito:
 *
 * - Una asignación apagada (el banco dejó de liquidar ahí) pero la fila queda, porque los cierres viejos
 *   la referencian.
 * - Un **banco** apagado no muestra sucursales aunque sus asignaciones sigan vivas: apagar el banco es
 *   sacarlo del cierre, y una sucursal asignada a un banco que no se ofrece sería una mentira en pantalla.
 */
export function mergeBankCatalog(
  banks: readonly BankRecord[],
  assignments: readonly LocationBankRecord[],
): BankCatalogEntry[] {
  const byBank = new Map<string, string[]>();

  for (const assignment of assignments) {
    if (!assignment.isActive) continue;

    const list = byBank.get(assignment.bankId) ?? [];
    list.push(assignment.locationId);
    byBank.set(assignment.bankId, list);
  }

  return banks.map((bank) => ({
    ...bank,
    locationIds: bank.isActive ? (byBank.get(bank.id) ?? []) : [],
  }));
}
