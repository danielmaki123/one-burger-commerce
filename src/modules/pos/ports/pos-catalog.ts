/**
 * TASK-301 — lo que el POS necesita del catálogo.
 *
 * El puerto pide **productos vendibles de un local con su precio ya resuelto**: el POS nunca calcula
 * precios ni filtra por local por su cuenta (eso ya lo hace `getPublicMenu` con
 * `apply-location-pricing`, T8). El adaptador de producción será una composición sobre ese caso de
 * uso, no una consulta nueva a la base: si hubiera dos caminos de precios, podrían diferir.
 */

export interface PosCatalogProduct {
  id: string;
  name: string;
  /** Precio final para ese local, ya resuelto por el módulo de menú. */
  price: number;
  /**
   * TASK-303b — empaque por unidad. El mostrador tiene que ver el **total** que va a cobrar y el
   * servidor suma el empaque aparte (`packagingTotalAmount`): si el POS mostrara solo el precio, el
   * cajero cobraría de menos. Es la misma clase de bug de dinero mostrado que arregló T5.
   */
  packagingFeeAmount: number;
  categoryId: string;
  categoryName: string;
  /** El producto exige elegir opciones: no se puede vender de un toque desde el mostrador. */
  requiresOptions: boolean;
}

export interface PosCatalogPort {
  listProducts(params: { locationId: string }): Promise<PosCatalogProduct[]>;
}
