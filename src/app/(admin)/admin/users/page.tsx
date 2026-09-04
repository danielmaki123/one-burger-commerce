import { redirect } from "next/navigation";

import { canManageUsers } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";

import AdminUsersClientPage from "./users-client";

export default async function AdminUsersPage() {
  const session = await requireAdminSession();

  if (!canManageUsers(session.user.role)) {
    redirect("/admin/orders");
  }

  return <AdminUsersClientPage />;
}
