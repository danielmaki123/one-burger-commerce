import { NextResponse } from "next/server";
import { z } from "zod";

import { canViewActivityFeed } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { getRecentActivity } from "@/modules/dashboard/features/get-recent-activity/get-recent-activity";
import { createErrorResponse } from "@/shared/lib/http/error-response";

const querySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 20))
    .pipe(z.number().min(1).max(100)),
});

export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();
    if (!canViewActivityFeed(session.user.role)) {
      throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
    }

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      limit: searchParams.get("limit") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Invalid query params",
            fields: Object.fromEntries(
              Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [
                k,
                Array.isArray(v) ? v[0] : String(v),
              ]),
            ),
          },
        },
        { status: 400 },
      );
    }

    const result = await getRecentActivity(parsed.data.limit);
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
