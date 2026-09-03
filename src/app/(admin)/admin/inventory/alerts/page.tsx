"use client";

import * as React from "react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import Link from "next/link";

interface InventoryAlert {
  inventoryItemId: string;
  name?: string;
  unit?: string;
  currentEstimatedStock: number;
  lowStockThreshold: number;
  severity: "warning" | "critical";
}

type FetchStatus = "loading" | "ready" | "error" | "auth";

export default function StockAlertsPage() {
  const [alerts, setAlerts] = React.useState<InventoryAlert[]>([]);
  const [fetchStatus, setFetchStatus] = React.useState<FetchStatus>("loading");

  const fetchAlerts = async () => {
    setFetchStatus("loading");
    try {
      const res = await fetch("/api/admin/inventory/alerts");
      if (res.status === 401 || res.status === 403) {
        setFetchStatus("auth");
        return;
      }
      if (!res.ok) {
        setFetchStatus("error");
        return;
      }
      const json = await res.json();
      setAlerts(json.data || []);
      setFetchStatus("ready");
    } catch {
      setFetchStatus("error");
    }
  };

  React.useEffect(() => {
    fetchAlerts();
  }, []);

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Alertas de Stock</h1>
          <p className="text-muted-foreground">Items que requieren reposición inmediata.</p>
        </div>
        <Button onClick={fetchAlerts} variant="outline" disabled={fetchStatus === "loading"}>
          {fetchStatus === "loading" ? "Actualizando..." : "Actualizar"}
        </Button>
      </div>

      {fetchStatus === "auth" ? (
        <div className="rounded-lg border border-warning-strong/30 bg-warning px-4 py-8 text-center text-sm text-warning-foreground">
          No tienes permisos para ver las alertas. Inicia sesión con una cuenta autorizada.
        </div>
      ) : fetchStatus === "error" ? (
        <div className="rounded-lg border border-danger-strong/30 bg-danger px-4 py-8 text-center text-sm text-danger-foreground">
          Error al cargar las alertas.{" "}
          <button className="underline underline-offset-2" onClick={fetchAlerts}>
            Reintentar
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {fetchStatus === "ready" && (
            <div
              className={`rounded-lg border p-4 ${
                criticalCount > 0
                  ? "border-danger-strong/30 bg-danger"
                  : alerts.length > 0
                  ? "border-warning-strong/30 bg-warning"
                  : "border-border bg-muted"
              }`}
            >
              <span className="text-sm font-medium text-muted-foreground">Resumen: </span>
              <span className="font-bold text-foreground">
                {alerts.length === 0
                  ? "Sin alertas activas"
                  : `${alerts.length} ítem(s) con stock bajo`}
              </span>
              {criticalCount > 0 && (
                <span className="ml-2 text-sm font-semibold text-danger-foreground">
                  ({criticalCount} crítico{criticalCount > 1 ? "s" : ""})
                </span>
              )}
            </div>
          )}

          {fetchStatus === "loading" ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">Cargando alertas...</div>
          ) : alerts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center">
              <p className="text-muted-foreground">Todo en orden. No hay alertas activas.</p>
            </div>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-label="Ítems con alerta">
              <div className="divide-y divide-border">
                {alerts.map((alert) => (
                  <div key={alert.inventoryItemId} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{alert.name || `Item ${alert.inventoryItemId}`}</p>
                        <Badge variant={alert.severity === "critical" ? "danger" : "warning"}>
                          {alert.severity === "critical" ? "Crítico" : "Advertencia"}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>Stock actual: <strong className="text-danger-foreground">{alert.currentEstimatedStock} {alert.unit ?? ""}</strong></span>
                        <span>Umbral: <strong className="text-foreground">{alert.lowStockThreshold} {alert.unit ?? ""}</strong></span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Link href="/admin/inventory/receive">
                        <Button variant="outline" size="sm">Recibir</Button>
                      </Link>
                      <Button variant="secondary" size="sm" disabled>Ordenar</Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
