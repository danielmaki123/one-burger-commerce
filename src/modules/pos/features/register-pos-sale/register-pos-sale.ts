import type { OrderRecord, PaymentRecord } from "@/modules/orders/domain/order.types";
import { validatePaidWithAmount } from "@/modules/orders/domain/payment-change";
import {
  composeSaleDiscount,
  manualDiscountAmount,
} from "@/modules/orders/domain/sale-discount";
import type { PaymentRepository } from "@/modules/orders/ports/payment-repository";
import type { CreateOrderRequest } from "@/modules/orders/features/create-order/create-order";

import { assertPosDraftReady, posDraftTotals, type PosDraft } from "../../domain/pos-draft";
import { PosError } from "../../domain/pos-errors";
import { paymentsTotalInBusinessCurrency, type PosSalePaymentInput } from "../../domain/pos-sale";
import { commitSale } from "./commit-sale";

/**
 * TASK-303b — la venta de mostrador, en **un solo paso**.
 *
 * Decisión del owner: en el mostrador se pide y se paga de una vez. El caso de uso hace las dos
 * cosas en ese orden porque el alta (`createOrder`) es la **única puerta** que resuelve precios,
 * empaque y totales: si el POS calculara el total por su cuenta, habría dos verdades sobre la plata.
 *
 * El cobro se registra después del alta, con la moneda en la que entró (el arqueo necesita saber si
 * en el cajón hay córdobas o dólares) y el cambio se **deriva** (no se guarda), igual que en el
 * checkout.
 *
 * Antes de crear nada se compara lo que el cliente puso contra el total del borrador —la misma
 * fórmula del servidor— para no dejar un pedido creado por un cobro que no alcanza. Después del
 * alta se vuelve a comparar contra el total real: si el menú cambió entre que el cajero cargó el
 * catálogo y cobró, el error dice el número de pedido y la diferencia, en vez de registrar un cobro
 * que no cubre la venta.
 *
 * TASK-AUD-004 — **todo lo que escribe** (el alta y sus cobros) vive en `commitSale` y corre adentro de
 * una sola transacción: este archivo decide, valida y cotiza; `commit-sale.ts` escribe.
 */

export type RegisterPosSaleInput = {
  draft: PosDraft;
  customer: {
    name: string;
    whatsapp: string;
    email?: string | null;
    /** Punto 4 del roadmap (2026-09-18) — factura con RUC: los dos datos, ya validados por la ruta. */
    taxId?: string | null;
    legalName?: string | null;
  };
  payments: PosSalePaymentInput[];
  /** Clave de la operación: un reintento del mismo cobro no crea dos ventas (TASK-101). */
  idempotencyKey?: string | null;
  /**
   * Fase 6 del rediseño de Caja (2026-09-23) — la **terminal** desde la que se cobra: el POS hereda la del
   * turno abierto del local. Sirve para dos cosas: resolver la caja que corresponde (una por terminal) y
   * firmarle el turno a cada cobro (`Payment.shiftId`). Sin dato, la caja sin terminal (una sola por local).
   */
  terminalId?: string | null;
  /**
   * Tarea 9.6 del roadmap del POS (Fase 2) — el código de promo que el cliente trajo, tal como lo escribió
   * el cajero. El alta (`createOrder`) es la que lo valida, calcula el descuento y consume el uso.
   */
  couponCode?: string | null;
  /**
   * Tarea 9.7 del roadmap del POS (Fase 2) — el **descuento manual** autorizado (permiso aparte en la ruta,
   * `canDiscountPosSale`). Llega como forma y motivo; el monto lo calcula el servidor.
   */
  manualDiscount?: { kind: "percentage" | "amount"; value: number; reason: string } | null;
};

/**
 * TASK-AUD-004 — las dos cosas que escribe una venta, **con el mismo cliente de base**.
 *
 * Se entregan juntas porque el pedido y sus cobros son una sola operación: escribirlos por separado dejaba
 * un pedido con la mitad de sus cobros si algo fallaba entre medio. El alcance lo arma el adaptador (acá no
 * hay Prisma): en producción las dos piezas van dentro de la misma transacción.
 *
 * TASK-AUD-005 — además el alcance bloquea la fila del turno: el cobro y el cierre de caja no se cruzan.
 */
export type PosSaleTransactionScope = {
  /**
   * El alta real, ya cableada por la composición (el POS no conoce el grafo del módulo `orders`).
   *
   * Devuelve además si el alta **reusó** un pedido ya creado con la misma clave de intento: en ese caso
   * los cobros no se registran otra vez (tarea 11).
   */
  createPosOrder: (input: CreateOrderRequest) => Promise<{ order: OrderRecord; reused: boolean }>;
  paymentRepository: PaymentRepository;
  /**
   * TASK-AUD-005 — bloquea la fila del turno y devuelve su estado **después** de esperar a quien la
   * tuviera tomada.
   *
   * Es el otro lado del cierre: el cierre bloquea el turno antes de leer los cobros que va a firmar, y el
   * cobro lo bloquea antes de escribir. Sin esto, una venta que entró justo cuando la caja se cerraba
   * quedaba firmada con un turno cerrado: su plata no entraba a ningún arqueo y el documento no la
   * explicaba. `null` si el turno ya no existe.
   */
  lockShift: (shiftId: string) => Promise<{ id: string; status: string } | null>;
};

export type RegisterPosSaleDependencies = {
  /**
   * TASK-AUD-004 — el **límite atómico** de la venta del mostrador: el pedido (con su cupón y sus líneas)
   * y **todos** sus cobros, o nada.
   *
   * Antes se escribía el pedido y después cada cobro por su cuenta, cada uno con su propio `create`: una
   * falla en el segundo cobro dejaba un pedido cobrado a medias, y el reintento con la misma clave
   * devolvía esa venta incompleta como si estuviera paga. El caso de uso no sabe **cómo** se abre la
   * transacción (eso es del adaptador); sabe que todo lo que escriba adentro se guarda junto.
   */
  runInSaleTransaction: <T>(work: (scope: PosSaleTransactionScope) => Promise<T>) => Promise<T>;
  businessCurrencyCode: string;
  usdExchangeRate: number | null;
  /**
   * Bloque 9.2 del roadmap del POS (Fase 2) — la caja abierta del local, si hay.
   *
   * Un cobro con la caja cerrada **no entra a ningún arqueo**: se registra el `Payment` y el turno
   * que lo explica no existe. Antes se permitía (con un aviso en pantalla) y la plata quedaba fuera
   * del control; ahora es un 409 con el motivo, y el mostrador lo dice antes de cobrar.
   */
  findOpenShift?: (
    locationId: string,
    terminalId?: string | null,
  ) => Promise<{ id: string } | null>;
  /**
   * Tarea 9.6 del roadmap del POS (Fase 2) — la **misma** cotización que vio el cajero, para comparar el
   * cobro contra el total con descuento.
   *
   * El descuento autoritativo sigue siendo el del alta (que puede rechazar el cupón); esta cotización existe
   * para no rechazar una venta que el cliente ya pagó bien: sin ella, la comprobación previa comparaba
   * contra el total **sin** cupón y una venta con descuento «no alcanzaba».
   */
  quoteCoupon?: (input: {
    couponCode: string;
    lines: { productId: string; quantity: number }[];
  }) => Promise<{ discount: number }>;
};

export type RegisterPosSaleResult = {
  order: OrderRecord;
  payments: PaymentRecord[];
  /** Lo que entró, convertido a la moneda del negocio. */
  paidInBusinessCurrency: number;
  change: number | null;
  /**
   * Tarea 11 del brief (2026-09-17) — `true` cuando el alta **reconoció** el intento: el pedido ya existía
   * (misma clave) y esta llamada no cobró nada. La pantalla lo dice para que nadie cobre dos veces.
   */
  reused: boolean;
};

export async function registerPosSale(
  input: RegisterPosSaleInput,
  deps: RegisterPosSaleDependencies,
): Promise<RegisterPosSaleResult> {
  assertPosDraftReady(input.draft);

  // Bloque 9.2 — sin caja abierta no se cobra: el cobro no tendría arqueo que lo explique.
  //
  // Fase 6 del rediseño de Caja (2026-09-23) — el turno que se resuelve acá es además el que se le **firma
  // a cada cobro** (`Payment.shiftId`): es lo que permite que dos cajas abiertas en el mismo local (una por
  // terminal) no se cuenten la plata de la otra. `input.terminalId` es la estación desde la que se cobra; sin
  // él se resuelve el turno sin terminal, que es la sucursal de una sola caja.
  const openShift = deps.findOpenShift
    ? await deps.findOpenShift(input.draft.locationId, input.terminalId ?? null)
    : null;

  if (deps.findOpenShift && !openShift) {
    throw new PosError(409, "CONFLICT", "Abrí la caja antes de cobrar.", {
      shift: "No hay una caja abierta en este local.",
    });
  }

  const paidInBusinessCurrency = paymentsTotalInBusinessCurrency({
    payments: input.payments,
    businessCurrencyCode: deps.businessCurrencyCode,
    usdExchangeRate: deps.usdExchangeRate,
  });

  const couponCode = await resolveSalePricing({ input, deps, paidInBusinessCurrency });

  return deps.runInSaleTransaction((scope) =>
    commitSale({
      input,
      couponCode,
      paidInBusinessCurrency,
      openShift,
      scope,
      businessCurrencyCode: deps.businessCurrencyCode,
      usdExchangeRate: deps.usdExchangeRate,
    }),
  );
}

/**
 * Lo que se resuelve **antes** de tocar la base: qué cupón se cotiza, si el descuento manual es válido y
 * si el cobro alcanza para el total del borrador.
 *
 * La cotización previa tiene que ser la **misma** que el cajero le mostró al cliente (tarea 9.6): sin ella
 * una venta con descuento «no alcanzaba» aunque el cliente hubiera pagado bien. El descuento autoritativo
 * sigue siendo el del alta, que puede rechazar el cupón.
 *
 * Devuelve el código normalizado (o `null`): es lo único que el alta necesita de acá.
 */
async function resolveSalePricing({
  input,
  deps,
  paidInBusinessCurrency,
}: {
  input: RegisterPosSaleInput;
  deps: RegisterPosSaleDependencies;
  paidInBusinessCurrency: number;
}): Promise<string | null> {
  const couponCode = input.couponCode?.trim() ? input.couponCode.trim() : null;
  const couponDiscount =
    couponCode && deps.quoteCoupon
      ? (
          await deps.quoteCoupon({
            couponCode,
            lines: input.draft.lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
            })),
          })
        ).discount
      : 0;

  /**
   * Tarea 9.7 — el descuento manual se calcula sobre el subtotal del borrador (lo que el cajero le está
   * cobrando al cliente) y se compone con el del cupón: entre los dos nunca pasan de la venta.
   */
  const manualAmount = input.manualDiscount
    ? manualDiscountAmount({
        discount: input.manualDiscount,
        subtotal: posDraftTotals(input.draft).subtotal,
      })
    : { ok: true as const, amount: 0 };

  if (!manualAmount.ok) {
    const message =
      manualAmount.reason === "missing-reason"
        ? "Escribí por qué se hace el descuento."
        : "El descuento tiene que ser un monto mayor que cero o un porcentaje de hasta 100 %.";

    throw new PosError(422, "VALIDATION_ERROR", message, { discount: message });
  }

  const expectedTotal = posDraftTotals(
    input.draft,
    composeSaleDiscount({
      couponDiscount,
      manualDiscount: manualAmount.amount,
      subtotal: posDraftTotals(input.draft).subtotal,
    }),
  ).total;

  const draftProblem = validatePaidWithAmount({
    paidWithAmount: paidInBusinessCurrency,
    total: expectedTotal,
    paymentMethod: "cash",
  });
  if (draftProblem) {
    throw new PosError(422, "VALIDATION_ERROR", draftProblem, { payments: draftProblem });
  }

  return couponCode;
}
