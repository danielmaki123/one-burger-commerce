import { redirect } from "next/navigation";

import { canViewAdminOverview } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";

import AdminOverviewClient from "./_components/admin-overview-client";

export default async function AdminOverviewPage() {
  const session = await requireAdminSession();

  if (!canViewAdminOverview(session.user.role)) {
    redirect("/admin/orders");
  }

  return <AdminOverviewClient />;
}
