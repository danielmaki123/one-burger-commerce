import { NextResponse } from "next/server";
import { z } from "zod";

import { PrismaAdminAuthRepository } from "@/modules/auth/adapters/prisma-admin-auth-repository";
import { ADMIN_ROLES } from "@/modules/auth/domain/admin-role";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { deleteAdminUser } from "@/modules/auth/features/delete-admin-user/delete-admin-user";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { updateAdminUserLocations } from "@/modules/auth/features/update-admin-user-locations/update-admin-user-locations";
import { updateAdminUserRole } from "@/modules/auth/features/update-admin-user-role/update-admin-user-role";
import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { createErrorResponse } from "@/shared/lib/http/error-response";

/**
 * Se puede cambiar el rol, las sucursales asignadas o las dos cosas. Un payload vacío se rechaza:
 * un PATCH que no cambia nada es un botón que miente.
 */
const updateUserSchema = z
  .object({
    role: z
      .enum([
        ADMIN_ROLES.owner,
        ADMIN_ROLES.manager,
        ADMIN_ROLES.kitchen,
        // TASK-105: se puede promover a un usuario a cajero y sacarlo de ahí.
        ADMIN_ROLES.cashier,
      ])
      .optional(),
    locationIds: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  })
  .refine((value) => value.role !== undefined || value.locationIds !== undefined, {
    message: "Nothing to update",
  });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdminSession();
    const { id } = await params;
    const payload = await request.json().catch(() => ({}));
    const parsed = updateUserSchema.safeParse(payload);

    if (!parsed.success) {
      throw new AuthError(400, "BAD_REQUEST", "Invalid payload", {
        role: "Rol o sucursales inválidas",
      });
    }

    const repository = new PrismaAdminAuthRepository();
    let result: { data: unknown } | null = null;

    if (parsed.data.role !== undefined) {
      result = await updateAdminUserRole(
        { userId: id, role: parsed.data.role },
        {
          repository,
          actorRole: session.user.role,
        },
      );
    }

    if (parsed.data.locationIds !== undefined) {
      result = await updateAdminUserLocations(
        { userId: id, locationIds: parsed.data.locationIds },
        {
          repository,
          locationRepository: new PrismaLocationRepository(),
          actorRole: session.user.role,
        },
      );
    }

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
