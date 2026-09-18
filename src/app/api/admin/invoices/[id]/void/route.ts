import { NextResponse } from "next/server";

import {
  assertCanVoidInvoice,
  historyErrorResponse,
} from "@/app/api/admin/invoices/invoice-route-helpers";
import { parseVoidInvoicePayload } from "@/app/api/admin/invoices/void-invoice-payload";
import { invoiceVoidAudit } from "@/app/api/admin/audit-action-helpers";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaInvoiceRepository } from "@/modules/invoices/adapters/prisma-invoice-repository";
import { voidInvoice } from "@/modules/invoices/features/void-invoice/void-invoice";

export const dynamic = "force-dynamic";

/**
 * Punto 2 del roadmap (2026-09-18) — `POST /api/admin/invoices/[id]/void`: anular una factura.
 *
 * Solo el **dueño**, con motivo obligatorio. La factura no se borra: queda marcada con cuándo, quién y
 * por qué, y la anulación deja asiento en el log de acciones sensibles (`invoice.void`). El caso de uso
 * es el que decide (permiso, motivo, ya anulada); acá se corta el permiso antes y se arma el asiento.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession();
    assertCanVoidInvoice(session.user.role);

    const { id } = await context.params;
    const payload = parseVoidInvoicePayload(await request.json().catch(() => ({})));

    const invoice = await voidInvoice(
      {
        invoiceId: id,
        actorRole: session.user.role,
        actorUserId: session.user.id,
        reason: payload.reason,
        note: payload.note,
      },
      {
        invoiceRepository: new PrismaInvoiceRepository(),
        recordVoidAudit: (input) => invoiceVoidAudit(input),
      },
    );

    return NextResponse.json({ data: invoice }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return historyErrorResponse(error);
  }
}
