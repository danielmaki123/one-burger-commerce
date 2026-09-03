import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { PrismaAdminAuthRepository } from "@/modules/auth/adapters/prisma-admin-auth-repository";
import { ADMIN_SESSION_COOKIE_NAME } from "@/modules/auth/domain/session-cookie";
import { logoutAdmin } from "@/modules/auth/features/logout-admin/logout-admin";

export async function POST() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  const repository = new PrismaAdminAuthRepository();

  await logoutAdmin(sessionToken, repository);
  cookieStore.delete(ADMIN_SESSION_COOKIE_NAME);

  return new NextResponse(null, { status: 204 });
}

