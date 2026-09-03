export const dynamic = "force-dynamic";
export const revalidate = 0;

import AdminShell from "./_components/admin-shell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
