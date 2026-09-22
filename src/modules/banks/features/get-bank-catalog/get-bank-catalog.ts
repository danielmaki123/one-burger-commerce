import { mergeBankCatalog } from "@/modules/banks/domain/bank-catalog";
import type { BankCatalogEntry } from "@/modules/banks/domain/bank.types";
import type { BankRepository } from "@/modules/banks/ports/bank-repository";

/**
 * Fase 3 del rediseño de Caja (2026-09-23) — **el catálogo de bancos de la pantalla**.
 *
 * Es la lectura de Config de Caja → Bancos: qué bancos hay y en qué sucursales liquidan. Sin catálogo la
 * pantalla muestra el estado vacío (y el cierre no ofrece ningún bloque), que es lo correcto: los bancos
 * con los que opera el local son datos del negocio y no se inventan en el código.
 */
export async function getBankCatalog({
  repository,
}: {
  repository: BankRepository;
}): Promise<{ banks: BankCatalogEntry[] }> {
  const [banks, assignments] = await Promise.all([
    repository.listBanks(),
    repository.listAssignments(),
  ]);

  return { banks: mergeBankCatalog(banks, assignments) };
}
