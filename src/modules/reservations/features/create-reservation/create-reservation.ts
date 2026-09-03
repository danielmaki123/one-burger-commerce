import { publish } from "@/infrastructure/events/event-bus";
import { maskWhatsapp } from "@/modules/customers/domain/mask-whatsapp";
import { findOrCreateCustomer } from "@/modules/customers/features/find-or-create-customer/find-or-create-customer";
import {
  generateReservationLookupToken,
  generateReservationNumber,
  hashReservationLookupToken,
} from "@/modules/reservations/domain/reservation-tracking";
import { ReservationError } from "@/modules/reservations/domain/reservation-errors";
import { isValidReservationBusinessHour } from "@/modules/reservations/domain/reservation-business-hours";
import {
  BLOCKING_RESERVATION_STATUSES,
  DEFAULT_RESERVATION_DURATION_MINUTES,
  hasReservationTimeOverlap,
} from "@/modules/reservations/domain/reservation-overlap";
import type { ReservationRepository } from "@/modules/reservations/ports/reservation-repository";
import { normalizeWhatsapp } from "@/shared/lib/normalize-whatsapp";

export type CreateReservationRequest = {
  customerName: string;
  customerWhatsapp: string;
  date: string;
  time: string;
  partySize: number;
  tableId: string;
  notes?: string | null;
};

export async function createReservation(
  input: CreateReservationRequest,
  {
    repository,
    resolveCustomerId = findOrCreateCustomer,
    reservationNumberGenerator = generateReservationNumber,
    reservationLookupTokenGenerator = generateReservationLookupToken,
  }: {
    repository: ReservationRepository;
    resolveCustomerId?: (input: {
      fullName: string;
      whatsappNormalized: string;
    }) => Promise<string | null>;
    reservationNumberGenerator?: () => string;
    reservationLookupTokenGenerator?: () => string;
  },
) {
  if (!input.customerName?.trim()) {
    throw new ReservationError(400, "BAD_REQUEST", "Invalid payload", {
      customerName: "Required",
    });
  }
  if (!input.customerWhatsapp?.trim()) {
    throw new ReservationError(400, "BAD_REQUEST", "Invalid payload", {
      customerWhatsapp: "Required",
    });
  }
  const normalizedWhatsapp = normalizeWhatsapp(input.customerWhatsapp);
  if (!normalizedWhatsapp) {
    throw new ReservationError(400, "BAD_REQUEST", "Invalid payload", {
      customerWhatsapp: "Invalid format",
    });
  }
  if (!input.date || /^\d{4}-\d{2}-\d{2}$/.test(input.date) === false) {
    throw new ReservationError(400, "BAD_REQUEST", "Invalid payload", {
      date: "Required format YYYY-MM-DD",
    });
  }
  if (!input.time || /^([01]\d|2[0-3]):([0-5]\d)$/.test(input.time) === false) {
    throw new ReservationError(400, "BAD_REQUEST", "Invalid payload", {
      time: "Required format HH:MM",
    });
  }
  if (!isValidReservationBusinessHour(input.time)) {
    throw new ReservationError(422, "VALIDATION_ERROR", "Invalid payload", {
      time: "Reservations are available from 12:00 to 20:00",
    });
  }
  if (typeof input.partySize !== "number" || input.partySize < 1) {
    throw new ReservationError(422, "VALIDATION_ERROR", "Invalid payload", {
      partySize: "Must be >= 1",
    });
  }
  if (!input.tableId?.trim()) {
    throw new ReservationError(400, "BAD_REQUEST", "Invalid payload", {
      tableId: "Required",
    });
  }

  const table = await repository.findTableById(input.tableId);
  if (!table) {
    throw new ReservationError(404, "NOT_FOUND", "Table not found");
  }
  if (!table.isActive) {
    throw new ReservationError(409, "CONFLICT", "Table is not active");
  }
  if (table.capacity < input.partySize) {
    throw new ReservationError(
      422,
      "VALIDATION_ERROR",
      "Party size exceeds table capacity",
      {
        partySize: `Maximum capacity for this table is ${table.capacity}`,
      },
    );
  }

  const existing = await repository.findReservationsByTableAndDate(
    input.tableId,
    input.date,
  );
  const hasConflict = existing.some(
    (r) =>
      BLOCKING_RESERVATION_STATUSES.includes(r.status) &&
      hasReservationTimeOverlap(
        r.time,
        input.time,
        DEFAULT_RESERVATION_DURATION_MINUTES,
      ),
  );
  if (hasConflict) {
    throw new ReservationError(
      409,
      "CONFLICT",
      "Table is not available for the selected date/time",
    );
  }

  const customerName = input.customerName.trim();
  let customerId: string | null = null;
  try {
    customerId = await resolveCustomerId({
      fullName: customerName,
      whatsappNormalized: normalizedWhatsapp,
    });
  } catch {
    console.warn(
      `[customer-auto-link] resolve_customer_failed whatsapp=${maskWhatsapp(normalizedWhatsapp)}`,
    );
  }

  const reservationLookupToken = reservationLookupTokenGenerator();
  const reservationLookupTokenHash =
    hashReservationLookupToken(reservationLookupToken);

  const MAX_RESERVATION_NUMBER_ATTEMPTS = 5;
  let reservation:
    | Awaited<ReturnType<ReservationRepository["createReservation"]>>
    | null = null;

  for (let attempt = 0; attempt < MAX_RESERVATION_NUMBER_ATTEMPTS; attempt += 1) {
    const reservationNumber = reservationNumberGenerator();

    try {
      reservation = await repository.createReservation({
        customerName,
        customerWhatsapp: normalizedWhatsapp,
        customerId,
        reservationNumber,
        reservationLookupTokenHash,
        date: input.date,
        time: input.time,
        partySize: input.partySize,
        tableId: input.tableId,
        tableLabel: table.label,
        notes: input.notes ?? null,
      });
      break;
    } catch (error) {
      if (isReservationNumberConflict(error)) {
        continue;
      }
      throw error;
    }
  }

  if (!reservation) {
    throw new ReservationError(
      409,
      "CONFLICT",
      "Could not generate reservation reference",
    );
  }

  await publish("ReservationCreated", { reservation });

  return {
    data: {
      id: reservation.id,
      status: reservation.status,
      customerName: reservation.customerName,
      customerWhatsapp: reservation.customerWhatsapp,
      customerId: reservation.customerId,
      reservationNumber: reservation.reservationNumber,
      reservationLookupToken,
      date: reservation.date,
      time: reservation.time,
      partySize: reservation.partySize,
      tableId: reservation.tableId,
      tableLabel: reservation.tableLabel,
      notes: reservation.notes,
      createdAt: reservation.createdAt,
      updatedAt: reservation.updatedAt,
    },
    meta: { sourceOfTruth: "backend" as const },
  };
}

function isReservationNumberConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as {
    code?: unknown;
    meta?: { target?: unknown };
  };
  if (maybeError.code !== "P2002") return false;
  if (!maybeError.meta?.target) return true;
  if (!Array.isArray(maybeError.meta.target)) return true;
  return maybeError.meta.target.includes("reservationNumber");
}
