import { PrismaClientInitializationError } from "@prisma/client/runtime/library";
import { NextResponse } from "next/server";

import { AuthError } from "@/modules/auth/domain/auth-errors";
import { BusinessSettingsError } from "@/modules/business-settings/domain/business-settings-errors";
import { CustomerAuthError } from "@/modules/customers/domain/customer-auth-errors";
import { MenuError } from "@/modules/menu/domain/menu-errors";
import { OutboxError } from "@/modules/notifications/domain/outbox-errors";
import { OrderError } from "@/modules/orders/domain/order-errors";
import { ShiftError } from "@/modules/orders/domain/shift-errors";
import { InventoryError } from "@/modules/inventory/domain/inventory-errors";
import { LocationError } from "@/modules/locations/domain/location-errors";
import { AuditError } from "@/modules/audit/domain/audit-errors";
import { PosError } from "@/modules/pos/domain/pos-errors";
import { ReservationError } from "@/modules/reservations/domain/reservation-errors";

export function createErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof BusinessSettingsError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof CustomerAuthError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof MenuError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof LocationError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof OrderError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof OutboxError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof ReservationError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof InventoryError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      },
      { status: error.status },
    );
  }

  // TASK-104: los errores del turno de caja (una caja ya abierta, un local que no existe).
  if (error instanceof ShiftError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      },
      { status: error.status },
    );
  }

  // TASK-301: los errores del POS (borrador inválido; el POS apagado en ese local sale 403).
  if (error instanceof PosError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      },
      { status: error.status },
    );
  }

  // Bloque 13.1 del POS: una acción fuera de la lista de acciones auditables.
  if (error instanceof AuditError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof PrismaClientInitializationError) {    return NextResponse.json(
      {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Database connection failed",
        },
      },
      { status: 503 },
    );
  }

  console.error(error);

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected server error",
      },
    },
    { status: 500 },
  );
}

