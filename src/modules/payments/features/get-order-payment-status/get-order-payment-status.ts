import {
  projectOrderPaymentStatus,
  type OrderFinancialInput,
  type OrderPaymentStatus,
  type PaymentForFinancials,
} from "@/modules/payments/domain/order-financial-status";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-016`, `D-020`, `D-021`) — **el estado financiero de un pedido**.
 *
 * Un caso de uso, un dueño. La regla —qué es «pagado», qué se puede demostrar y qué se declara— vive en el
 * dominio (`domain/order-financial-status.ts`); acá está el **borde**: las dependencias entran inyectadas y
 * la evidencia de un cobro legacy se pide por un puerto, para que la proyección no conozca ni Prisma ni la
 * configuración de hoy.
 *
 * Los consumidores (`orders`, `invoices`, el POS, React) **consumen** este caso de uso y **no** deciden
 * «pagado» con lo que tienen a mano: era exactamente eso —`payments.length > 0` en la factura, la suma cruda
 * en el POS— lo que producía `A-68` y el hecho de que una factura saliera por un cobro parcial.
 */

export type GetOrderPaymentStatusDependencies = {
  /**
   * `A-72`/`D-020` — la equivalencia de un cobro **legacy**, cuando un dato persistido la demuestra (el
   * esperado de un cierre que congeló las dos monedas, un cobro hermano del mismo hecho). Devuelve `null`
   * cuando no se puede demostrar: ese monto va a `unresolvedAmount` y **no** produce `paid`.
   *
   * Es opcional a propósito: sin ella, el sistema es **más** estricto, nunca menos.
   */
  resolveLegacyBaseAmount?: (payment: PaymentForFinancials) => number | null;
};

export async function getOrderPaymentStatus(
  input: OrderFinancialInput,
  deps: GetOrderPaymentStatusDependencies = {},
): Promise<OrderPaymentStatus> {
  return projectOrderPaymentStatus(input, {
    resolveLegacyBaseAmount: deps.resolveLegacyBaseAmount ?? (() => null),
  });
}
