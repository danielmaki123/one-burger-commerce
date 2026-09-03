import { cookies } from "next/headers";

import { PrismaAdminAuthRepository } from "@/modules/auth/adapters/prisma-admin-auth-repository";
import { ADMIN_SESSION_COOKIE_NAME } from "@/modules/auth/domain/session-cookie";
import { getAdminSession } from "@/modules/auth/features/get-admin-session/get-admin-session";

export async function requireAdminSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  const repository = new PrismaAdminAuthRepository();
  const session = await getAdminSession(sessionToken, repository);
  return session;
}
