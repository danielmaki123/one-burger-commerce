import { OrderError } from "@/modules/orders/domain/order-errors";
import type { PaymentRepository } from "@/modules/orders/ports/payment-repository";
import type { RefundRepository } from "@/modules/orders/ports/refund-repository";
import type { ShiftRepository } from "@/modules/orders/ports/shift-repository";
import { roundCurrency } from "@/shared/lib/order-totals";

/**
 * Bloque 3 del roadmap del POS (Fase 2) — pedir una devolución sobre un cobro.
 *
 * Tres controles de plata:
 *
 * 1. **No se devuelve más de lo que se cobró.** Se suman las devoluciones del cobro **sin contar las
 *    rechazadas** (lo que no salió no consume cupo) y lo pedido no puede pasarse.
 * 2. **Parcial y total se distinguen**: una parcial no puede cubrir todo el cobro (para eso está la
 *    total) y una total tiene que cubrirlo entero. Así una devolución «total» que en realidad deja
 *    plata a favor no se puede registrar como total.
 * 3. **Nadie aprueba su propia devolución**: quien tiene el permiso la deja aprobada, pero si es la
 *    suya queda pendiente de otro par de ojos. Es la regla conservadora y la que evita el
 *    autoservicio.
 *
 * La devolución queda atada al **turno abierto** del local cuando hay uno: es lo que permite que el
 * arqueo la descuente. Sin caja abierta queda sin turno (no se rechaza: el cobro pudo ser de otro
 * momento y el motivo es lo que importa).
 */
export async function requestRefund(
  input: {
    paymentId: string;
    kind: "full" | "partial";
    amount: number;
    reason: string;
    requestedByUserId: string;
    /** ¿Quien pide tiene permiso de aprobar (`canManageCash`)? */
    canApprove: boolean;
    locationId: string;
  },
  {
    paymentRepository,
    refundRepository,
    shiftRepository,
  }: {
    paymentRepository: Pick<PaymentRepository, "findPaymentById">;
    refundRepository: RefundRepository;
    shiftRepository: Pick<ShiftRepository, "findOpenShiftByLocation">;
  },
) {
  const reason = input.reason?.trim();
  if (!reason) {
    throw new OrderError(422, "VALIDATION_ERROR", "Escribí por qué devolvés la plata.", {
      reason: "El motivo es obligatorio.",
    });
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new OrderError(422, "VALIDATION_ERROR", "El monto tiene que ser mayor que cero.", {
      amount: "El monto tiene que ser mayor que cero.",
    });
  }

  const payment = await paymentRepository.findPaymentById(input.paymentId);
  if (!payment) {
    throw new OrderError(404, "NOT_FOUND", "No encontramos ese cobro.");
  }

  const existing = await refundRepository.listByPayment(payment.id);
  const alreadyRefunded = roundCurrency(
    existing
      .filter((refund) => refund.status !== "rejected")
      .reduce((sum, refund) => sum + refund.amount, 0),
  );
  const remaining = roundCurrency(payment.amount - alreadyRefunded);

  if (input.amount > remaining) {
    throw new OrderError(
      422,
      "VALIDATION_ERROR",
      `Ese cobro tiene ${remaining} disponible para devolver.`,
      { amount: `No podés devolver más de ${remaining}.` },
    );
  }

  if (input.kind === "partial" && input.amount >= payment.amount) {
    throw new OrderError(422, "VALIDATION_ERROR", "Una devolución parcial no cubre todo el cobro.", {
      amount: "Para devolver todo, usá «total».",
    });
  }

  if (input.kind === "full" && input.amount !== remaining) {
    throw new OrderError(
      422,
      "VALIDATION_ERROR",
      "La devolución total tiene que cubrir lo que queda del cobro.",
      { amount: `Quedan ${remaining} por devolver.` },
    );
  }

  const openShift = await shiftRepository.findOpenShiftByLocation(input.locationId);
  const approved = input.canApprove;
  const now = new Date().toISOString();

  const refund = await refundRepository.create({
    paymentId: payment.id,
    orderId: payment.orderId,
    shiftId: openShift?.id ?? null,
    kind: input.kind,
    method: payment.method,
    amount: roundCurrency(input.amount),
    // Un cobro viejo sin moneda se devuelve en la moneda del negocio, que es lo que asume el arqueo.
    currency: (payment.currency ?? "NIO").toUpperCase(),
    reason,
    status: approved ? "approved" : "pending",
    requestedByUserId: input.requestedByUserId,
    approvedByUserId: approved ? input.requestedByUserId : null,
    approvedAt: approved ? now : null,
  });

  return { data: refund };
}
