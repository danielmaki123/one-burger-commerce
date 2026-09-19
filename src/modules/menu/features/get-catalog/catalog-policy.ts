import type { CatalogScope } from "@/modules/menu/domain/menu.types";

/**
 * Qué cambia entre mirar el catálogo desde la carta y desde el mostrador.
 *
 * Es la **única** diferencia entre las dos superficies: las dos leen el mismo catálogo (el mismo precio
 * del local, las mismas excepciones del local) y esta función decide qué se incluye. Vive aparte del
 * caso de uso para poder probar la tabla sin base de datos.
 */
export type CatalogPolicy = {
  /** El mostrador necesita ver el agotado para poder decir "está agotado". La carta no lo muestra. */
  includeUnavailable: boolean;
  /** Los bloques de marketing son de la carta; el mostrador no los lee. */
  loadsMarketingBlocks: boolean;
};

export function resolveCatalogPolicy(
  scope: CatalogScope,
  input: { includeUnavailable?: boolean },
): CatalogPolicy {
  // El mostrador no puede apagar los agotados: si el producto no está, el cajero no puede avisarlo.
  if (scope === "pos") {
    return { includeUnavailable: true, loadsMarketingBlocks: false };
  }

  return {
    includeUnavailable: Boolean(input.includeUnavailable),
    loadsMarketingBlocks: true,
  };
}
