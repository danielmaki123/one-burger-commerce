import { NextResponse } from "next/server";
import { z } from "zod";

import { PrismaAdminAuthRepository } from "@/modules/auth/adapters/prisma-admin-auth-repository";
import { ADMIN_ROLES } from "@/modules/auth/domain/admin-role";
import { createAdminUser } from "@/modules/auth/features/create-admin-user/create-admin-user";
import { listAdminUsers } from "@/modules/auth/features/list-admin-users/list-admin-users";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { createErrorResponse } from "@/shared/lib/http/error-response";

const createUserSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  role: z.enum([ADMIN_ROLES.owner, ADMIN_ROLES.manager, ADMIN_ROLES.kitchen]),
});

export async function GET() {
  try {
    const session = await requireAdminSession();
    const repository = new PrismaAdminAuthRepository();
    const result = await listAdminUsers({
      repository,
      actorRole: session.user.role,
    });

    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    const payload = await request.json().catch(() => ({}));
    const parsed = createUserSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Invalid payload",
            fields: Object.fromEntries(
              Object.entries(parsed.error.flatten().fieldErrors).map(([key, value]) => [
                key,
                Array.isArray(value) ? value[0] : String(value),
              ]),
            ),
          },
        },
        { status: 400 },
      );
    }

    const repository = new PrismaAdminAuthRepository();
    const result = await createAdminUser(parsed.data, {
      repository,
      actorRole: session.user.role,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return createErrorResponse(error);
  }
}
