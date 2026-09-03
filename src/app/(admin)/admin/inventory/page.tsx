"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Boxes, ClipboardCheck, PackagePlus, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";

interface InventoryAlert {
  inventoryItemId: string;
  severity: "warning" | "critical";
}

interface Movement {
  id: string;
  type: "count" | "receive" | "waste";
  inventoryItemId: string;
  quantity: number;
  occurredAt: string;
  notes: string | null;
  reason: string | null;
}

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
}

const TYPE_LABEL: Record<string, string> = {
  count: "Conteo",
  receive: "Recepción",
  waste: "Merma",
};

const TYPE_COLOR: Record<string, string> = {
  count: "bg-accent text-brand-strong",
  receive: "bg-success-strong/20 text-success-foreground",
  waste: "bg-danger-strong/20 text-danger-foreground",
};

export default function InventoryDashboardPage() {
  const [alerts, setAlerts] = React.useState<InventoryAlert[]>([]);
  const [movements, setMovements] = React.useState<Movement[]>([]);
  const [itemMap, setItemMap] = React.useState<Record<string, InventoryItem>>({});
  const [loading, setLoading] = React.useState(true);
  const [authRequired, setAuthRequired] = React.useState(false);

  React.useEffect(() => {
    const load = async () => {
      try {
        const [alertsRes, movementsRes, itemsRes] = await Promise.all([
          fetch("/api/admin/inventory/alerts"),
          fetch("/api/admin/inventory/movements?limit=5"),
          fetch("/api/admin/inventory/items"),
        ]);
        if (alertsRes.status === 401 || movementsRes.status === 401 || itemsRes.status === 401) {
          setAuthRequired(true);
          setAlerts([]);
          setMovements([]);
          setItemMap({});
          setLoading(false);
          return;
        }
        const [alertsJson, movementsJson, itemsJson] = await Promise.all([
          alertsRes.json(),
          movementsRes.json(),
          itemsRes.json(),
        ]);
        setAlerts(alertsJson.data || []);
        setMovements(movementsJson.data || []);
        const map: Record<string, InventoryItem> = {};
        for (const item of (itemsJson.data || [])) {
          map[item.id] = item;
        }
        setItemMap(map);
      } catch {
        // dashboard is best-effort; individual pages show their own errors
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  if (authRequired) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 text-center">
        <h2 className="font-heading text-2xl font-bold">Acceso restringido</h2>
        <p className="text-muted-foreground">Inicia sesión como administrador para ver esta sección.</p>
        <Link href="/admin/login">
          <Button>Iniciar sesión</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">Gestión de Inventario</h1>
        <p className="text-muted-foreground">Monitorea niveles de stock, registra mermas y recepciones.</p>
      </div>

      {!loading && alerts.length > 0 && (
        <div
          className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
            criticalCount > 0
              ? "border-danger-strong/30 bg-danger text-danger-foreground"
              : "border-warning-strong/30 bg-warning text-warning-foreground"
          }`}
        >
          <span className="font-semibold">
            {criticalCount > 0
              ? `${criticalCount} alerta(s) crítica(s)`
              : `${warningCount} advertencia(s)`}{" "}
            de stock bajo
          </span>
          <Link href="/admin/inventory/alerts" className="ml-auto underline underline-offset-2">
            Ver alertas
          </Link>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-label="Operaciones de inventario">
        <div className="border-b border-border px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operaciones de inventario</p>
        </div>
        <div className="divide-y divide-border">
          {[
            { href: "/admin/inventory/count", label: "Conteo diario", description: "Registra niveles físicos al cierre.", action: "Registrar conteo", Icon: ClipboardCheck },
            { href: "/admin/inventory/receive", label: "Recepción", description: "Registra entrada de mercadería de proveedores.", action: "Registrar entrada", Icon: PackagePlus },
            { href: "/admin/inventory/waste", label: "Mermas", description: "Reporta producto dañado, vencido o desperdiciado.", action: "Reportar merma", Icon: Trash2 },
            { href: "/admin/inventory/alerts", label: "Alertas", description: "Ítems por debajo del umbral configurado.", action: "Ver alertas", Icon: ShieldAlert, badge: !loading && alerts.length > 0 ? alerts.length : null },
            { href: "/admin/inventory/items", label: "Ítems maestro", description: "Configuración base de productos de inventario.", action: "Gestionar ítems", Icon: Boxes },
          ].map(({ href, label, description, action, Icon, badge }) => (
            <Link key={href} href={href} className="group flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/35">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-brand"><Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-foreground">{label}</span><span className="mt-0.5 block text-sm text-muted-foreground">{description}</span></span>
              {badge ? <Badge variant={criticalCount > 0 ? "danger" : "warning"}>{badge}</Badge> : null}
              <span className="hidden items-center gap-1 text-sm font-semibold text-brand sm:inline-flex">{action}<ArrowUpRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" /></span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-brand sm:hidden" strokeWidth={2} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos Recientes</CardTitle>
          <CardDescription>Últimas 5 operaciones registradas.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin movimientos registrados aún.</p>
          ) : (
            <div className="divide-y divide-border">
              {movements.map((mov) => {
                const item = itemMap[mov.inventoryItemId];
                return (
                  <div key={mov.id} className="flex items-center justify-between py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          TYPE_COLOR[mov.type] ?? "bg-muted text-foreground"
                        }`}
                      >
                        {TYPE_LABEL[mov.type] ?? mov.type}
                      </span>
                      <span className="font-medium text-foreground">
                        {item ? item.name : mov.inventoryItemId}
                      </span>
                    </div>
                    <div className="text-right text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {mov.quantity} {item?.unit ?? ""}
                      </span>
                      <p className="text-xs">
                        {new Date(mov.occurredAt).toLocaleDateString("es-GT")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
