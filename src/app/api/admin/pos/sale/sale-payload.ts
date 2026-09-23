import { z } from "zod";

import { MIN_TAX_ID_LENGTH } from "@/modules/customers/domain/customer-fiscal-data";
import { PosError } from "@/modules/pos/domain/pos-errors";
import type { PosDraft } from "@/modules/pos/domain/pos-draft";
import { POS_PAYMENT_METHODS } from "@/modules/pos/domain/pos-sale";
import { normalizeCouponCode } from "@/modules/orders/domain/coupon-eligibility";
import type {
  RegisterPosSaleInput,
  RegisterPosSaleResult,
} from "@/modules/pos/features/register-pos-sale/register-pos-sale";

/**
 * TASK-303b — la forma del payload del cobro.
 *
 * Valida **forma** (tipos, rangos, que haya algo) y traduce al input del caso de uso. El **correo**
 * no se valida acá a propósito: su formato lo decide `createOrder` (el alta es la única puerta de
 * los datos del cliente), así el error cae en el campo con el mismo mensaje en el POS y en el
 * checkout. El precio que manda el cliente es solo para su cuenta local: el que vale es el que
 * resuelve el servidor al crear el pedido.
 */

const lineSchema = z.object({
  productId: z.string().trim().min(1, "Falta el producto"),
  name: z.string().trim().min(1).max(120),
  unitPrice: z.number().min(0, "El precio no puede ser negativo"),
  packagingUnitAmount: z.number().min(0, "El empaque no puede ser negativo").optional(),
  quantity: z.number().int("La cantidad tiene que ser un entero").min(1, "La cantidad mínima es 1"),
  notes: z.string().trim().max(200).nullable().optional(),
  /**
   * Las opciones elegidas del producto. **No se validan acá a propósito**: qué opción vale para qué
   * producto, los mínimos y los máximos los resuelve el alta (`createOrder`), que es la única puerta
   * —igual que el correo—. Acá solo se comprueba la forma, con un tope de sanidad.
   */
  modifierOptionIds: z.array(z.string().trim().min(1)).max(50).optional(),
});

const paymentSchema = z.object({
  /**
   * Bloque 4 del roadmap del POS (Fase 2) — los medios del enum real, no solo dos.
   *
   * El mostrador cobra efectivo, tarjeta y **transferencia**, y un pedido puede partirse entre varios
   * medios (efectivo + transferencia, dos tarjetas). El `mixed` no se elige acá: se **deriva** de que
   * haya más de un cobro.
   *
   * Tareas 9.4/9.5 — la lista sale del dominio (`POS_PAYMENT_METHODS`), que es la misma que ofrece la
   * pantalla y la que se guarda en una venta en espera: una sola, no tres que se desincronizan.
   */
  method: z.enum(POS_PAYMENT_METHODS, {
    message: "Elegí efectivo, tarjeta, transferencia u otro",
  }),
  currency: z.string().trim().min(3, "Falta la moneda").max(3, "La moneda son 3 letras"),
  amount: z.number().positive("El monto tiene que ser mayor que cero"),
  /** Referencia externa del cobro (número de voucher o de transferencia). Opcional. */
  reference: z.string().trim().max(80).nullable().optional(),
});

const saleSchema = z
  .object({
    locationId: z.string().trim().min(1, "Elegí el local"),
    customer: z.object({
      name: z.string().trim().min(1, "Escribí el nombre del cliente").max(120),
      whatsapp: z.string().trim().min(1, "Escribí el número del cliente").max(30),
      email: z.string().trim().max(160).nullable().optional(),
      /**
       * Punto 4 del roadmap (2026-09-18) — el cliente que pide **factura con RUC**. Los dos datos van juntos
       * y el RUC tiene el mismo mínimo que la pantalla (8 caracteres): el cobro del POS es una API, no puede
       * aceptar media factura por más que el mostrador lo impida.
       */
      taxId: z.string().trim().max(40).nullable().optional(),
      legalName: z.string().trim().max(120).nullable().optional(),
    }),
    lines: z.array(lineSchema).min(1, "Agregá al menos un producto"),
    payments: z.array(paymentSchema).min(1, "Registrá al menos un cobro"),
    idempotencyKey: z.string().trim().min(1).max(80).nullable().optional(),
    /**
     * Fase 6 del rediseño de Caja (2026-09-23) — la **terminal** desde la que se cobra. El POS la manda
     * cuando el local tiene más de una: el caso de uso resuelve el turno de esa estación y le firma el cobro
     * (`Payment.shiftId`). Sin terminal es el turno «sin terminal», que es la sucursal de una sola caja.
     */
    terminalId: z.string().trim().min(1).nullable().optional(),
    /**
     * Tarea 9.6 del roadmap del POS (Fase 2) — el código de la promo que el cliente trajo.
     *
     * Llega como lo escribió el cajero y se **normaliza** acá (mayúsculas y sin espacios, la misma regla del
     * checkout): el código se guarda en mayúsculas y el que lo escribe no tiene por qué saberlo.
     */
    couponCode: z.string().trim().max(40, "El código es muy largo").nullable().optional(),
    /**
     * Tarea 9.7 del roadmap del POS (Fase 2) — el **descuento manual** autorizado por quien administra la caja.
     *
     * Viaja como **forma** (porcentaje o monto) y con su motivo: el monto lo calcula el servidor. El permiso se
     * comprueba en la ruta (`canDiscountPosSale`); acá solo se valida que los datos tengan sentido.
     */
    manualDiscount: z
      .object({
        kind: z.enum(["percentage", "amount"]),
        value: z.number().positive("El descuento tiene que ser mayor que cero"),
        reason: z.string().trim().min(3, "Escribí por qué se hace el descuento").max(200),
      })
      .nullable()
      .optional(),
  })
  .superRefine((value, context) => {
    const taxId = value.customer.taxId?.trim() ?? "";
    const legalName = value.customer.legalName?.trim() ?? "";
    if (!taxId && !legalName) return;

    if (taxId.length < MIN_TAX_ID_LENGTH) {
      context.addIssue({
        code: "custom",
        path: ["taxId"],
        message: `El RUC tiene que tener al menos ${MIN_TAX_ID_LENGTH} caracteres`,
      });
    }

    if (!legalName) {
      context.addIssue({
        code: "custom",
        path: ["legalName"],
        message: "Escribí la razón social",
      });
    }
  });

export type PosSalePayload = z.infer<typeof saleSchema>;

/**
 * El local de la venta lo resuelve `requirePosLocation` (`pos-route-helpers`, TASK-308): el alcance
 * por sucursal y el punto de venta prendido en ese local son las mismas tres preguntas para todas las
 * rutas del POS, así que no hay una versión propia acá que se pueda desincronizar.
 */

/** La respuesta del cobro: lo que el mostrador necesita mostrar y nada más. */
export function toPosSaleResponse(result: RegisterPosSaleResult) {
  return {
    orderId: result.order.id,
    orderNumber: result.order.orderNumber,
    total: result.order.total,
    paid: result.paidInBusinessCurrency,
    change: result.change,
    /**
     * Tarea 11 del brief (2026-09-17) — `true` cuando el cobro **reconoció** el intento: el pedido ya
     * existía con esa clave y no se cobró de nuevo. El mostrador lo dice para que nadie vuelva a cobrar.
     */
    reused: result.reused,
    payments: result.payments.map((payment) => ({
      id: payment.id,
      method: payment.method,
      amount: payment.amount,
      currency: payment.currency,
    })),
  };
}

export function parsePosSalePayload(body: unknown): {
  input: RegisterPosSaleInput;
  locationId: string;
} {
  const parsed = saleSchema.safeParse(body);
  if (!parsed.success) {
    throw new PosError(422, "VALIDATION_ERROR", "Revisá los datos de la venta.", {
      ...Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
      ),
    });
  }

  const draft: PosDraft = {
    locationId: parsed.data.locationId,
    lines: parsed.data.lines.map((line) => ({
      productId: line.productId,
      name: line.name,
      unitPrice: line.unitPrice,
      packagingUnitAmount: line.packagingUnitAmount ?? 0,
      quantity: line.quantity,
      notes: line.notes ?? undefined,
      ...(line.modifierOptionIds === undefined
        ? {}
        : { modifierOptionIds: line.modifierOptionIds }),
    })),
  };

  return {
    locationId: parsed.data.locationId,
    input: {
      draft,
      customer: {
        name: parsed.data.customer.name,
        whatsapp: parsed.data.customer.whatsapp,
        email: parsed.data.customer.email ?? null,
        // Punto 4: ya validados (los dos, con el mínimo del RUC) o vacíos.
        taxId: parsed.data.customer.taxId ?? null,
        legalName: parsed.data.customer.legalName ?? null,
      },
      payments: parsed.data.payments.map((payment) => ({
        method: payment.method,
        currency: payment.currency.toUpperCase(),
        amount: payment.amount,
        ...(payment.reference ? { reference: payment.reference } : {}),
      })),
      idempotencyKey: parsed.data.idempotencyKey ?? null,
      // Fase 6 del rediseño de Caja: la terminal con la que se cobra (el turno lo resuelve el caso de uso).
      terminalId: parsed.data.terminalId ?? null,
      couponCode: parsed.data.couponCode ? normalizeCouponCode(parsed.data.couponCode) : null,
      manualDiscount: parsed.data.manualDiscount
        ? {
            kind: parsed.data.manualDiscount.kind,
            value: parsed.data.manualDiscount.value,
            reason: parsed.data.manualDiscount.reason,
          }
        : null,
    },
  };
}
