"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";

interface DeliveryZone {
  id: string;
  name: string;
  description: string | null;
  baseFee: number;
  isActive: boolean;
  sortOrder: number;
}

export default function DeliveryZoneFormPage() {
  const params = useParams();
  const router = useRouter();
  const isNew = params.id === "new";

  const [loading, setLoading] = React.useState(!isNew);
  const [saving, setSaving] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    baseFee: 0,
    isActive: true,
    sortOrder: 0,
  });

  React.useEffect(() => {
    if (isNew) return;

    const fetchZone = async () => {
      try {
        const res = await fetch(`/api/admin/delivery-zones/${params.id}`);
        if (!res.ok) {
          setActionError("No se pudo cargar la zona de entrega.");
          setLoading(false);
          return;
        }
        const json = await res.json();
        const zone: DeliveryZone = json.data;
        setFormData({
          name: zone.name,
          description: zone.description ?? "",
          baseFee: zone.baseFee,
          isActive: zone.isActive,
          sortOrder: zone.sortOrder,
        });
      } catch (err) {
        console.error("Error fetching delivery zone:", err);
        setActionError("Error de conexion al cargar la zona.");
      } finally {
        setLoading(false);
      }
    };

    fetchZone();
  }, [isNew, params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setActionError(null);

    try {
      const payload = {
        name: formData.name,
        description: formData.description.trim() || null,
        baseFee: Number(formData.baseFee),
        isActive: formData.isActive,
        sortOrder: Number(formData.sortOrder),
      };

      const url = isNew
        ? "/api/admin/delivery-zones"
        : `/api/admin/delivery-zones/${params.id}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push("/admin/delivery-zones");
      } else {
        const errorData = await res.json();
        setActionError(errorData.error?.message || "Ocurrio un problema al guardar.");
      }
    } catch (err) {
      console.error("Error saving delivery zone:", err);
      setActionError("Error de conexion.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex h-40 items-center justify-center text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Link href="/admin/delivery-zones">
          <Button variant="ghost" size="sm">← Volver</Button>
        </Link>
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          {isNew ? "Nueva Zona de Entrega" : "Editar Zona"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información de la Zona</CardTitle>
              <CardDescription>Configura el nombre, tarifa y visibilidad.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Nombre de la zona"
                placeholder="Ej. Centro, Norte, Sur..."
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                required
              />
              <Input
                label="Descripción"
                placeholder="Ej. Colonias incluidas, referencias..."
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Tarifa base ($)"
                  type="number"
                  step="0.01"
                  min={0}
                  value={formData.baseFee}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, baseFee: parseFloat(e.target.value) || 0 }))
                  }
                  required
                />
                <Input
                  label="Orden"
                  type="number"
                  min={0}
                  value={formData.sortOrder}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, sortOrder: parseInt(e.target.value, 10) || 0 }))
                  }
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-border text-foreground focus:ring-brand"
                />
                <span className="text-sm font-medium text-foreground">Zona activa</span>
              </label>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {actionError && (
                <div className="w-full rounded-md border border-danger-strong/30 bg-danger p-3 text-sm text-danger-foreground">
                  {actionError}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Guardando..." : "Guardar Zona"}
              </Button>
              <Link href="/admin/delivery-zones" className="w-full">
                <Button type="button" variant="outline" className="w-full">Cancelar</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="font-medium text-foreground">Nombre:</span>{" "}
                {formData.name || "(sin nombre)"}
              </p>
              <p>
                <span className="font-medium text-foreground">Tarifa base:</span>{" "}
                ${Number(formData.baseFee).toFixed(2)}
              </p>
              <p>
                <span className="font-medium text-foreground">Estado:</span>{" "}
                {formData.isActive ? "Activa" : "Inactiva"}
              </p>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
