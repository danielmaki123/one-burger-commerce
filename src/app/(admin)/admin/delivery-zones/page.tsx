"use client";

import * as React from "react";
import Link from "next/link";
import { MapPinned } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  AdminEmptyState,
  AdminPageHeader,
} from "../_components/admin-operational-ui";

interface DeliveryZone {
  id: string;
  name: string;
  description: string | null;
  baseFee: number;
  isActive: boolean;
  sortOrder: number;
}

export default function DeliveryZonesPage() {
  const [zones, setZones] = React.useState<DeliveryZone[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchZones = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/delivery-zones");
      const json = await res.json();
      setZones(json.data || []);
    } catch (err) {
      console.error("Error fetching delivery zones:", err);
      setFeedback({ type: "error", message: "No se pudieron cargar las zonas de entrega." });
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchZones();
  }, []);

  const activeZones = zones.filter((zone) => zone.isActive).length;
  const averageFee =
    zones.length > 0
      ? zones.reduce((sum, zone) => sum + zone.baseFee, 0) / zones.length
      : 0;

  return (
    <div className="space-y-5 pb-8">
      <AdminPageHeader
        title="Zonas de entrega"
        description="Cobertura, tarifa base y orden de zonas activas."
        actions={
          <Link href="/admin/delivery-zones/new">
            <Button>Nueva zona</Button>
          </Link>
        }
      />

      {feedback ? (
        <div
          className={`rounded-md border px-4 py-3 text-st-body ${
            feedback.type === "success"
              ? "border-status-ready-border bg-status-ready-bg text-status-ready-text"
              : "border-status-sla-border bg-status-sla-bg text-status-sla-text"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <section
        aria-label="Resumen de zonas"
        className="flex flex-col gap-3 rounded-stitch-lg border border-line-subtle bg-surface-card px-4 py-3 shadow-elevation-1 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-stitch-md bg-surface-elevated text-brand">
            <MapPinned className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </span>
          <div>
            <p className="text-st-caption font-semibold uppercase tracking-wide text-ink-secondary">Resumen de zonas</p>
            <p className="mt-0.5 text-st-body text-ink-secondary"><strong className="text-2xl leading-none text-ink">{zones.length}</strong><span className="ml-2">zonas configuradas</span></p>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-st-body text-ink-secondary">
          <span><strong className="text-ink">{activeZones}</strong> activas</span>
          <span><strong className="text-ink">${averageFee.toFixed(2)}</strong> tarifa promedio</span>
        </div>
      </section>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-ink-secondary">Cargando zonas...</div>
      ) : zones.length === 0 ? (
        <AdminEmptyState
          title="No hay zonas de entrega creadas"
          description="Crea la primera zona para definir cobertura y tarifa base."
          action={
            <Link href="/admin/delivery-zones/new">
              <Button variant="ghost">Crear zona</Button>
            </Link>
          }
        />
      ) : (
        <div className="admin-compact-list overflow-hidden rounded-stitch-lg border border-line-subtle bg-surface-card shadow-elevation-1">
          <div className="hidden items-center gap-3 border-b border-line-subtle bg-surface-low px-4 py-2.5 text-st-overline font-semibold uppercase tracking-wide text-ink-secondary md:grid md:grid-cols-[minmax(0,1.6fr)_auto_auto_auto]">
            <span>Zona</span>
            <span>Estado</span>
            <span>Tarifa / orden</span>
            <span className="text-right">Acción</span>
          </div>

          {zones.map((zone) => (
            <div
              key={zone.id}
              className="grid gap-3 border-b border-line-subtle px-4 py-2.5 last:border-b-0 md:grid-cols-[minmax(0,1.6fr)_auto_auto_auto] md:items-center"
            >
              <div className="min-w-0">
                <h3 className="truncate text-st-body font-semibold text-ink">
                  {zone.name}
                </h3>
                <p className="line-clamp-2 text-st-caption leading-5 text-ink-secondary">
                  {zone.description ?? "Sin descripción"}
                </p>
              </div>

              <div>
                {zone.isActive ? (
                  <Badge variant="success" className="h-5 px-1.5 text-st-overline">Activa</Badge>
                ) : (
                  <Badge variant="secondary" className="h-5 px-1.5 text-st-overline">Inactiva</Badge>
                )}
              </div>

              <div className="text-st-body text-ink-secondary">
                <p className="font-medium text-ink">${zone.baseFee.toFixed(2)}</p>
                <p className="text-st-caption text-ink-secondary">Orden: {zone.sortOrder}</p>
              </div>

              <div className="md:justify-self-end">
                <Link href={`/admin/delivery-zones/${zone.id}`}>
                  <Button variant="outline" size="sm">Editar</Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
