import { readProductionMoney } from "@/modules/money/adapters/production-money-context";
import { createProductionConfiguredPaymentMethods } from "@/modules/pos/adapters/production-configured-payment-methods";
import { createProductionPosCatalog } from "@/modules/pos/adapters/production-pos-catalog";
import { listPosPaymentMethodOptions } from "@/modules/pos/domain/pos-payment-methods";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §37, §40) — **lo que viaja con el catálogo del POS**.
 *
 * El catálogo del mostrador ya traía la vista de productos; además publica **tres cosas que son de la misma
 * pantalla, del mismo local y del mismo momento**:
 *
 * 1. **el contexto monetario** (`money`: moneda base y tasas), que el POS usa para los precios y para el
 *    cobro partido (`A-85`);
 * 2. **las monedas aceptadas**, que son las que ofrece el selector —no «la base y el dólar»—;
 * 3. **los medios configurados de este local** (`PaymentMethodConfig` + `PaymentMethodLocation` filtrados por
 *    el dominio de `payments`), que son los botones de «¿Cómo paga?». Publicarlos acá es la corrección de la
 *    divergencia de `A-85`: el backend ya los resolvía en el `snapshot`, pero la pantalla seguía dibujando
 *    `POS_PAYMENT_METHODS`.
 *
 * Se separa del handler por el tope de 50 líneas y porque el orden de las tres lecturas es la composición,
 * no la orquestación de la ruta: la vista, la autoridad monetaria y el catálogo de medios.
 */
export async function loadPosCatalogPayload(input: { locationId: string; query: string }) {
  const view = await createProductionPosCatalog().listCatalog({
    locationId: input.locationId,
    query: input.query,
  });

  const money = await readProductionMoney();
  const catalog = await createProductionConfiguredPaymentMethods().listPaymentMethods();

  return {
    data: view,
    money: money.context,
    acceptedCurrencies: money.currencies.map((currency) => currency.code),
    paymentMethods: listPosPaymentMethodOptions({ locationId: input.locationId, catalog }),
  };
}
