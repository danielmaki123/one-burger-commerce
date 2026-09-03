import { NextResponse } from "next/server";

import { canViewDashboardSummary } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { getDashboardSummary } from "@/modules/dashboard/features/get-dashboard-summary/get-dashboard-summary";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export async function GET() {
  try {
    const session = await requireAdminSession();
    if (!canViewDashboardSummary(session.user.role)) {
      throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
    }

    const result = await getDashboardSummary();
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
