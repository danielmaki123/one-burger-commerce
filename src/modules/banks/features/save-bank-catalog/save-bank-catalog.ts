import { normalizeBankCode, validateBankCatalog } from "@/modules/banks/domain/bank-catalog";
import { BankError } from "@/modules/banks/domain/bank-errors";
import type { BankCatalogEntry } from "@/modules/banks/domain/bank.types";
import type { BankRepository } from "@/modules/banks/ports/bank-repository";

/**
 * Fase 3 del rediseño de Caja (2026-09-23) — **guardar el catálogo completo**.
 *
 * El formulario manda la lista entera (como el de las denominaciones): el catálogo es chico y las reglas
 * que importan son **entre filas** —no puede haber dos bancos con el mismo nombre ni con el mismo código—,
 * y eso no se ve mirando una fila sola.
 *
 * Se normaliza **antes** de validar (nombre sin espacios de sobra, código en mayúsculas y vacío como
 * `null`) para que dos filas que se ven iguales choquen como iguales y para que un código vacío no ocupe
 * el índice único con una cadena vacía.
 */
export async function saveBankCatalog(
  input: { banks: readonly BankCatalogEntry[] },
  { repository }: { repository: BankRepository },
): Promise<{ banks: BankCatalogEntry[] }> {
  const entries: BankCatalogEntry[] = input.banks.map((bank, index) => ({
    id: (bank.id ?? "").trim(),
    name: (bank.name ?? "").trim(),
    code: normalizeBankCode(bank.code),
    isActive: bank.isActive !== false,
    sortOrder: Number.isInteger(bank.sortOrder) ? bank.sortOrder : index,
    locationIds: [...new Set((bank.locationIds ?? []).map((id) => id.trim()).filter(Boolean))],
  }));

  const fields = validateBankCatalog(entries);
  if (Object.keys(fields).length > 0) {
    throw new BankError(422, "VALIDATION_ERROR", "Revisá el catálogo de bancos.", fields);
  }

  return { banks: await repository.replaceCatalog(entries) };
}
