import { NextResponse } from "next/server";

import { canViewAdminOverview } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { getAdminOverviewOperations } from "@/modules/dashboard/features/get-admin-overview-operations/get-admin-overview-operations";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export async function GET() {
  try {
    const session = await requireAdminSession();
    if (!canViewAdminOverview(session.user.role)) {
      throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
    }

    return NextResponse.json(await getAdminOverviewOperations());
  } catch (error) {
    return createErrorResponse(error);
  }
}
