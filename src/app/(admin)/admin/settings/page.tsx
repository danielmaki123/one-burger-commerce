import { redirect } from "next/navigation";

import { canManageBusinessSettings } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { getBusinessSettings } from "@/modules/business-settings/features/get-business-settings/get-business-settings";
import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";

import AdminSettingsClientPage from "./settings-client";

export default async function AdminSettingsPage() {
  const session = await requireAdminSession();

  if (!canManageBusinessSettings(session.user.role)) {
    redirect("/admin/orders");
  }

  const settings = await getBusinessSettings({
    repository: new PrismaBusinessSettingsRepository(),
  });

  return (
    <AdminSettingsClientPage
      initialSettings={{ ...settings, updatedAt: settings.updatedAt.toISOString() }}
    />
  );
}
