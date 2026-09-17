"use client";

import * as React from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card } from "@/shared/ui/card";

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  currentEstimatedStock: number;
}

type FetchStatus = "loading" | "ready" | "error" | "auth";
type ItemResult = { ok: boolean; msg: string };

export default function InventoryCountPage() {
  const [items, setItems] = React.useState<InventoryItem[]>([]);
  const [fetchStatus, setFetchStatus] = React.useState<FetchStatus>("loading");
  const [counts, setCounts] = React.useState<Record<string, { quantity: number; notes: string }>>({});
  const [submitting, setSubmitting] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<Record<string, ItemResult>>({});

  const fetchItems = async () => {
    setFetchStatus("loading");
    try {
      const res = await fetch("/api/admin/inventory/items?isActive=true");
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

  const handleCountChange = (itemId: string, quantity: number) => {
    setCounts((prev) => ({ ...prev, [itemId]: { ...prev[itemId], quantity } }));
    setResults((prev) => { const n = { ...prev }; delete n[itemId]; return n; });
  };

  const handleNotesChange = (itemId: string, notes: string) => {
    setCounts((prev) => ({ ...prev, [itemId]: { ...prev[itemId], notes } }));
  };

  const handleSubmitCount = async (itemId: string) => {
    const countData = counts[itemId];
    if (!countData || countData.quantity === undefined) return;

    setSubmitting(itemId);
    try {
      const res = await fetch("/api/admin/inventory/counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventoryItemId: itemId,
          countedQuantity: countData.quantity,
          notes: countData.notes || "",
        }),
      });
      if (res.status === 401 || res.status === 403) {
        setResults((prev) => ({ ...prev, [itemId]: { ok: false, msg: "Sin permisos para registrar conteo." } }));
        return;
      }
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setResults((prev) => ({
          ...prev,
          [itemId]: { ok: false, msg: (errJson as { message?: string }).message || "Error al guardar el conteo." },
        }));
        return;
      }
      setCounts((prev) => {
        const n = { ...prev };
        delete n[itemId];
        return n;
      });
      setResults((prev) => ({ ...prev, [itemId]: { ok: true, msg: "Conteo registrado." } }));
      fetchItems();
    } catch {
      setResults((prev) => ({ ...prev, [itemId]: { ok: false, msg: "Error de conexión." } }));
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Conteo Diario</h1>
        <p className="text-ink-secondary">Registra las cantidades físicas actuales en el almacén.</p>
      </div>

      {fetchStatus === "loading" ? (
        <div className="flex h-40 items-center justify-center text-ink-secondary">Cargando items...</div>
      ) : fetchStatus === "auth" ? (
        <div className="rounded-stitch-md border border-warning-strong/30 bg-warning px-4 py-8 text-center text-st-body text-status-pending-text">
          No tienes permisos para esta sección. Inicia sesión con una cuenta autorizada.
        </div>
      ) : fetchStatus === "error" ? (
        <div className="rounded-stitch-md border border-danger-strong/30 bg-danger px-4 py-8 text-center text-st-body text-danger-foreground">
          Error al cargar los items.{" "}
          <button className="underline underline-offset-2" onClick={fetchItems}>
            Reintentar
          </button>
        </div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-ink-secondary">No hay items activos para contar.</Card>
      ) : (
        <section className="overflow-hidden rounded-stitch-lg border border-line-subtle bg-surface-card shadow-elevation-1" aria-label="Conteo de inventario">
          {items.map((item) => {
            const result = results[item.id];
            return (
              <div key={item.id} className="border-b border-line-subtle px-4 py-4 last:border-b-0">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="font-semibold text-ink">{item.name}</p>
                  <p className="text-st-body text-ink-secondary">Estimado actual: {item.currentEstimatedStock} {item.unit}</p>
                </div>
                {result ? (
                  <div className={`mb-3 rounded-stitch-md border px-3 py-2 text-st-body ${result.ok ? "border-status-ready-border bg-status-ready-bg text-status-ready-text" : "border-status-sla-border bg-status-sla-bg text-status-sla-text"}`}>
                    {result.msg}
                  </div>
                ) : null}
                <div className="grid gap-3 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.5fr)_auto] md:items-end">
                  <Input
                    label={`Cantidad (${item.unit})`}
                    type="number"
                    placeholder="0"
                    value={counts[item.id]?.quantity ?? ""}
                    onChange={(e) => handleCountChange(item.id, parseFloat(e.target.value))}
                  />
                  <Input
                    label="Notas (Opcional)"
                    placeholder="Ej. Ajuste cierre"
                    value={counts[item.id]?.notes ?? ""}
                    onChange={(e) => handleNotesChange(item.id, e.target.value)}
                  />
                  <Button
                    onClick={() => handleSubmitCount(item.id)}
                    disabled={submitting === item.id || counts[item.id]?.quantity === undefined}
                    className="min-h-11 w-full md:w-auto"
                  >
                    {submitting === item.id ? "Guardando..." : "Confirmar conteo"}
                  </Button>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
