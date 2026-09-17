"use client";

import * as React from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  category: string;
  currentEstimatedStock: number;
  lowStockThreshold: number;
  isActive: boolean;
}

type FetchStatus = "loading" | "ready" | "error" | "auth";

const EMPTY_FORM = {
  name: "",
  unit: "",
  category: "",
  currentEstimatedStock: 0,
  lowStockThreshold: 0,
};

export default function InventoryItemsPage() {
  const [items, setItems] = React.useState<InventoryItem[]>([]);
  const [fetchStatus, setFetchStatus] = React.useState<FetchStatus>("loading");
  const [isAdding, setIsAdding] = React.useState(false);
  const [formData, setFormData] = React.useState(EMPTY_FORM);
  const [submitStatus, setSubmitStatus] = React.useState<"idle" | "loading" | "success" | "error" | "auth">("idle");
  const [submitMsg, setSubmitMsg] = React.useState("");

  const fetchItems = async () => {
    setFetchStatus("loading");
    try {
      const res = await fetch("/api/admin/inventory/items");
      if (res.status === 401 || res.status === 403) {
        setFetchStatus("auth");
        return;
      }
      if (!res.ok) {
        setFetchStatus("error");
        return;
      }
      const json = await res.json();
      setItems(json.data || []);
      setFetchStatus("ready");
    } catch {
      setFetchStatus("error");
    }
  };

  React.useEffect(() => {
    fetchItems();
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus("loading");
    setSubmitMsg("");
    try {
      const res = await fetch("/api/admin/inventory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, isActive: true }),
      });
      if (res.status === 401 || res.status === 403) {
        setSubmitStatus("auth");
        setSubmitMsg("Sin permisos para crear items. Verifica tu sesión.");
        return;
      }
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setSubmitStatus("error");
        setSubmitMsg((errJson as { message?: string }).message || "No se pudo guardar el item. Intenta nuevamente.");
        return;
      }
      setIsAdding(false);
      setFormData(EMPTY_FORM);
      setSubmitStatus("success");
      setSubmitMsg("Item guardado exitosamente.");
      fetchItems();
    } catch {
      setSubmitStatus("error");
      setSubmitMsg("Error de conexión. Intenta nuevamente.");
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Items de Inventario</h1>
          <p className="text-ink-secondary">Configura los productos base que manejas en stock.</p>
        </div>
        <Button
          onClick={() => {
            setIsAdding(!isAdding);
            setSubmitStatus("idle");
          }}
        >
          {isAdding ? "Cancelar" : "Nuevo Item"}
        </Button>
      </div>

      {submitStatus === "success" && (
        <div className="rounded-stitch-md border border-success-strong/30 bg-success px-4 py-3 text-st-body text-status-ready-text">
          {submitMsg}
        </div>
      )}
      {(submitStatus === "error" || submitStatus === "auth") && (
        <div className="rounded-stitch-md border border-danger-strong/30 bg-danger px-4 py-3 text-st-body text-danger-foreground">
          {submitMsg}
        </div>
      )}

      {isAdding && (
        <Card className="border-foreground/10 bg-surface-low/50">
          <CardHeader>
            <CardTitle>Nuevo Item de Inventario</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddItem} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Input
                label="Nombre"
                placeholder="Ej. Café molido"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                required
              />
              <Input
                label="Unidad"
                placeholder="Ej. kg, litros, unidades"
                value={formData.unit}
                onChange={(e) => setFormData((p) => ({ ...p, unit: e.target.value }))}
                required
              />
              <Input
                label="Categoría"
                placeholder="Ej. Insumos, Limpieza"
                value={formData.category}
                onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                required
              />
              <Input
                label="Stock Inicial"
                type="number"
                value={formData.currentEstimatedStock}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, currentEstimatedStock: parseFloat(e.target.value) || 0 }))
                }
                required
              />
              <Input
                label="Umbral Stock Bajo"
                type="number"
                value={formData.lowStockThreshold}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, lowStockThreshold: parseFloat(e.target.value) || 0 }))
                }
                required
              />
              <div className="flex items-end">
                <Button type="submit" className="w-full" disabled={submitStatus === "loading"}>
                  {submitStatus === "loading" ? "Guardando..." : "Guardar Item"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {fetchStatus === "loading" ? (
        <div className="flex h-40 items-center justify-center text-ink-secondary">Cargando items...</div>
      ) : fetchStatus === "auth" ? (
        <div className="rounded-stitch-md border border-warning-strong/30 bg-warning px-4 py-8 text-center text-st-body text-status-pending-text">
          No tienes permisos para ver esta sección. Inicia sesión con una cuenta autorizada.
        </div>
      ) : fetchStatus === "error" ? (
        <div className="rounded-stitch-md border border-danger-strong/30 bg-danger px-4 py-8 text-center text-st-body text-danger-foreground">
          Error al cargar los items.{" "}
          <button className="underline underline-offset-2" onClick={fetchItems}>
            Reintentar
          </button>
        </div>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-ink-secondary">No hay items configurados.</p>
          <Button variant="ghost" className="mt-2" onClick={() => setIsAdding(true)}>
            Crea el primero
          </Button>
        </Card>
      ) : (
        <section className="overflow-hidden rounded-stitch-lg border border-line-subtle bg-surface-card shadow-elevation-1" aria-label="Listado de ítems de inventario">
          <div className="divide-y divide-line-subtle">
            {items.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{item.name}</p>
                    <Badge variant={item.isActive ? "success" : "secondary"}>
                      {item.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-st-body text-ink-secondary">{item.category} · Unidad: {item.unit}</p>
                </div>
                <dl className="grid grid-cols-2 gap-x-5 text-st-body sm:min-w-64">
                  <div>
                    <dt className="text-ink-secondary">Stock actual</dt>
                    <dd className="font-semibold text-ink">{item.currentEstimatedStock} {item.unit}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-secondary">Umbral</dt>
                    <dd className={item.currentEstimatedStock <= item.lowStockThreshold ? "font-semibold text-danger-foreground" : "font-semibold text-ink"}>
                      {item.lowStockThreshold} {item.unit}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
