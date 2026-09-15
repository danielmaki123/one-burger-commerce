import { z } from "zod";

import type { AdminRole } from "@/modules/auth/domain/admin-role";
import { resolveOrderLocationScope } from "@/modules/orders/domain/order-visibility";
import { PosError } from "@/modules/pos/domain/pos-errors";
import { resolvePosLocationId } from "@/modules/pos/domain/pos-location";
import type { PosDraft } from "@/modules/pos/domain/pos-draft";
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
});

const paymentSchema = z.object({
  method: z.enum(["cash", "card"], { message: "Elegí efectivo o tarjeta" }),
  currency: z.string().trim().min(3, "Falta la moneda").max(3, "La moneda son 3 letras"),
  amount: z.number().positive("El monto tiene que ser mayor que cero"),
});

const saleSchema = z.object({
  locationId: z.string().trim().min(1, "Elegí el local"),
  customer: z.object({
    name: z.string().trim().min(1, "Escribí el nombre del cliente").max(120),
    whatsapp: z.string().trim().min(1, "Escribí el número del cliente").max(30),
    email: z.string().trim().max(160).nullable().optional(),
  }),
  lines: z.array(lineSchema).min(1, "Agregá al menos un producto"),
  payments: z.array(paymentSchema).min(1, "Registrá al menos un cobro"),
  idempotencyKey: z.string().trim().min(1).max(80).nullable().optional(),
});

export type PosSalePayload = z.infer<typeof saleSchema>;

/**
 * El local de la venta, con el alcance por sucursal aplicado (A). Vive acá y no en la ruta porque la
 * ruta solo orquesta y tiene un tope de 50 líneas (contrato de TASK-204).
 */
export function resolveSaleLocationId(input: {
  requested: string;
  role: AdminRole;
  assignedLocationIds?: readonly string[] | null;
}): string {
  return resolvePosLocationId({
    requested: input.requested,
    scope: resolveOrderLocationScope({
      role: input.role,
      assignedLocationIds: input.assignedLocationIds,
    }),
  });
}

/** La respuesta del cobro: lo que el mostrador necesita mostrar y nada más. */
export function toPosSaleResponse(result: RegisterPosSaleResult) {
  return {
    orderId: result.order.id,
    orderNumber: result.order.orderNumber,
    total: result.order.total,
    paid: result.paidInBusinessCurrency,
    change: result.change,
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
      },
      payments: parsed.data.payments.map((payment) => ({
        method: payment.method,
        currency: payment.currency.toUpperCase(),
        amount: payment.amount,
      })),
      idempotencyKey: parsed.data.idempotencyKey ?? null,
    },
  };
}
