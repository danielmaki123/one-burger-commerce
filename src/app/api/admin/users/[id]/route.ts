import { NextResponse } from "next/server";
import { z } from "zod";

import { PrismaAdminAuthRepository } from "@/modules/auth/adapters/prisma-admin-auth-repository";
import { ADMIN_ROLES } from "@/modules/auth/domain/admin-role";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { deleteAdminUser } from "@/modules/auth/features/delete-admin-user/delete-admin-user";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { updateAdminUserRole } from "@/modules/auth/features/update-admin-user-role/update-admin-user-role";
import { createErrorResponse } from "@/shared/lib/http/error-response";

const updateRoleSchema = z.object({
  role: z.enum([ADMIN_ROLES.owner, ADMIN_ROLES.manager, ADMIN_ROLES.kitchen]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdminSession();
    const { id } = await params;
    const payload = await request.json().catch(() => ({}));
    const parsed = updateRoleSchema.safeParse(payload);

    if (!parsed.success) {
      throw new AuthError(400, "BAD_REQUEST", "Invalid payload", {
        role: "Invalid role",
      });
    }

    const repository = new PrismaAdminAuthRepository();
    const result = await updateAdminUserRole(
      { userId: id, role: parsed.data.role },
      {
        repository,
        actorRole: session.user.role,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdminSession();
    const { id } = await params;

    const repository = new PrismaAdminAuthRepository();
    const result = await deleteAdminUser(
      { userId: id },
      {
        repository,
        actorRole: session.user.role,
        actorUserId: session.user.id,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
