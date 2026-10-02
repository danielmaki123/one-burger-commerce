import { NextResponse } from "next/server";

import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { registerOutboxEventBusHandlers } from "@/modules/notifications/adapters/outbox-subscriber";
import { createErrorResponse } from "@/shared/lib/http/error-response";

import { applyOrderStatusChange } from "../../order-status-composition";
import {
  createOrderStatusRepository,
  resolveOrderStatusChange,
} from "../../order-status-request";

registerOutboxEventBusHandlers();

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §18, §19) — **el cambio de estado del pedido**, con la puerta
 * nominal de la entrega.
 *
 * El handler quedó en lo que tiene que ser: sesión, resolución del preámbulo (payload, capacidad, alcance y
 * transición real, todo en `order-status-request.ts`) y la llamada a la composición. El preámbulo se movió a
 * composición al agregar la puerta de la entrega: esta ruta es **legacy con techo medido** y agregar la
 * capacidad nominal **sin subir el techo** era el punto.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession();
    const { id } = await params;

    const resolved = await resolveOrderStatusChange({
      body: await request.json().catch(() => ({})),
      orderId: id,
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
      repository: createOrderStatusRepository(),
    });

    if (!resolved.ok) {
      return NextResponse.json(resolved.body, { status: resolved.status });
    }

    // B5: quién lo cambió, para el historial. Bloque 3.5: la composición deja la devolución pendiente al
    // cancelar un pedido cobrado (A-15) y aplica la capacidad de Cocina con el rol que firma.
    const result = await applyOrderStatusChange({
      orderId: id,
      status: resolved.context.request.status,
      note: resolved.context.request.note,
      changedByUserId: session.user.id,
      actorRole: session.user.role,
      order: resolved.context.order,
    });

    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
