import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export default function AdminNotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-2xl items-center justify-center">
      <Card className="w-full">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl text-ink">Página no encontrada</CardTitle>
          <CardDescription>
            La ruta que intentaste abrir no existe dentro del panel admin.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/admin/menu"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-4 py-2 font-medium text-ink-inverse transition-colors hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 motion-reduce:transition-none sm:w-auto"
          >
            Ir al menú
          </Link>
          <Link
            href="/admin/orders"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-line-subtle bg-transparent px-4 py-2 font-medium text-ink transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 motion-reduce:transition-none sm:w-auto"
          >
            Ir a órdenes
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
