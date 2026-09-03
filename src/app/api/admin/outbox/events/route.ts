import { NextResponse } from "next/server";

import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaOutboxRepository } from "@/modules/notifications/adapters/prisma-outbox-repository";
import { listOutboxEvents } from "@/modules/notifications/features/list-outbox-events/list-outbox-events";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export async function GET(request: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const eventType = searchParams.get("eventType") ?? undefined;

    const repository = new PrismaOutboxRepository();
    const result = await listOutboxEvents({ status, eventType }, { repository });
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
