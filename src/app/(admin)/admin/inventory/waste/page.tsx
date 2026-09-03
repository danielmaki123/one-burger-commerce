"use client";

import * as React from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
}

type FetchStatus = "loading" | "ready" | "error" | "auth";

const WASTE_REASONS = ["Expiración", "Daño", "Error", "Derrame", "Otro"];

export default function WasteEntryPage() {
  const [items, setItems] = React.useState<InventoryItem[]>([]);
  const [fetchStatus, setFetchStatus] = React.useState<FetchStatus>("loading");
  const [selectedItemId, setSelectedItemId] = React.useState("");
  const [quantity, setQuantity] = React.useState(0);
  const [reason, setReason] = React.useState("Daño");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitStatus, setSubmitStatus] = React.useState<"idle" | "success" | "error" | "auth">("idle");
  const [submitMsg, setSubmitMsg] = React.useState("");

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) return;

    setSubmitting(true);
    setSubmitStatus("idle");
    setSubmitMsg("");
    try {
      const res = await fetch("/api/admin/inventory/waste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventoryItemId: selectedItemId,
          quantity,
          reason,
          notes: notes || null,
        }),
      });
      if (res.status === 401 || res.status === 403) {
        setSubmitStatus("auth");
        setSubmitMsg("Sin permisos para registrar mermas. Verifica tu sesión.");
        return;
      }
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setSubmitStatus("error");
        setSubmitMsg((errJson as { message?: string }).message || "No se pudo registrar la merma. Intenta nuevamente.");
        return;
      }
      setSelectedItemId("");
      setQuantity(0);
      setReason("Daño");
      setNotes("");
      setSubmitStatus("success");
      setSubmitMsg("Merma registrada exitosamente.");
    } catch {
      setSubmitStatus("error");
      setSubmitMsg("Error de conexión. Intenta nuevamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedItem = items.find((i) => i.id === selectedItemId);

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Reportar Merma</h1>
        <p className="text-muted-foreground">Registra productos desperdiciados o dañados.</p>
      </div>

      {submitStatus === "success" && (
        <div className="max-w-2xl rounded-lg border border-success-strong/30 bg-success px-4 py-3 text-sm text-success-foreground">
          {submitMsg}
        </div>
      )}
      {(submitStatus === "error" || submitStatus === "auth") && (
        <div className="max-w-2xl rounded-lg border border-danger-strong/30 bg-danger px-4 py-3 text-sm text-danger-foreground">
          {submitMsg}
        </div>
      )}

      {fetchStatus === "auth" ? (
        <div className="max-w-2xl rounded-lg border border-warning-strong/30 bg-warning px-4 py-8 text-center text-sm text-warning-foreground">
          No tienes permisos para esta sección. Inicia sesión con una cuenta autorizada.
        </div>
      ) : fetchStatus === "error" ? (
        <div className="max-w-2xl rounded-lg border border-danger-strong/30 bg-danger px-4 py-8 text-center text-sm text-danger-foreground">
          Error al cargar los productos.{" "}
          <button className="underline underline-offset-2" onClick={fetchItems}>
            Reintentar
          </button>
        </div>
      ) : (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Detalles de la Merma</CardTitle>
            <CardDescription>Completa los datos del producto afectado.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-sm font-medium leading-none text-foreground">Producto</label>
                {fetchStatus === "loading" ? (
                  <div className="flex h-10 items-center text-sm text-muted-foreground">Cargando productos...</div>
                ) : (
                  <select
                    className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    required
                  >
                    <option value="">Selecciona un producto...</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.unit})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <Input
                label={`Cantidad${selectedItem ? ` (${selectedItem.unit})` : ""}`}
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                required
              />

              <div className="space-y-3">
                <label className="text-sm font-medium leading-none text-foreground">Motivo</label>
                <RadioGroup className="grid grid-cols-2 gap-4">
                  {WASTE_REASONS.map((r) => (
                    <RadioGroupItem
                      key={r}
                      value={r}
                      id={r}
                      name="waste-reason"
                      checked={reason === r}
                      onChange={(e) => setReason(e.target.value)}
                      label={r}
                    />
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium leading-none text-foreground">Notas</label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm ring-offset-white placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  placeholder="Detalles adicionales..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={submitting || !selectedItemId || fetchStatus === "loading"}
              >
                {submitting ? "Guardando..." : "Registrar Merma"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
