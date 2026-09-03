import Link from "next/link";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export default function AdminNotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-2xl items-center justify-center">
      <Card className="w-full">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl text-foreground">Página no encontrada</CardTitle>
          <CardDescription>
            La ruta que intentaste abrir no existe dentro del panel admin.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Link href="/admin" className="sm:w-auto">
            <Button className="w-full">Volver al dashboard</Button>
          </Link>
          <Link href="/admin/orders" className="sm:w-auto">
            <Button variant="outline" className="w-full">Ir a órdenes</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
