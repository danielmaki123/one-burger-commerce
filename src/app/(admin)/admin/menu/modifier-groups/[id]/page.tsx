"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Plus, Trash2 } from "lucide-react";

import { useCurrencyFormat } from "@/shared/lib/business-settings";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { AdminPageHeader } from "../../../_components/admin-operational-ui";
import { describeModifierRule } from "../modifier-group-helpers";

interface ModifierOptionForm {
  id?: string;
  name: string;
  priceDelta: number;
  isActive: boolean;
}

interface ModifierGroup {
  id: string;
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  options: ModifierOptionForm[];
}

const SELECT_CLASS =
  "h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

function OptionActiveSwitch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <span
        aria-hidden="true"
        className={[
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors motion-reduce:transition-none",
          checked ? "bg-brand" : "bg-secondary",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-5 w-5 transform rounded-full bg-card shadow transition-transform motion-reduce:transition-none",
            checked ? "translate-x-5.5" : "translate-x-0.5",
          ].join(" ")}
        />
      </span>
    </button>
  );
}

export default function ModifierGroupFormPage() {
  const params = useParams();
  const router = useRouter();
  const currency = useCurrencyFormat();
  const isNew = params.id === "new";

  const [loading, setLoading] = React.useState(!isNew);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    isRequired: false,
    minSelections: 0,
    maxSelections: 1,
    sortOrder: 0,
  });

  const [options, setOptions] = React.useState<ModifierOptionForm[]>([
    { name: "", priceDelta: 0, isActive: true },
  ]);

  React.useEffect(() => {
    if (isNew) return;

    const fetchGroup = async () => {
      try {
        const res = await fetch(`/api/admin/menu/modifier-groups/${params.id}`);
        if (!res.ok) {
          setLoadError("No se pudo cargar el grupo de modificadores.");
          setLoading(false);
          return;
        }
        const json = await res.json();
        const group: ModifierGroup = json.data;
        setFormData({
          name: group.name,
          isRequired: group.isRequired,
          minSelections: group.minSelections,
          maxSelections: group.maxSelections,
          sortOrder: group.sortOrder,
        });
        setOptions(
          group.options.map((opt) => ({
            id: opt.id,
            name: opt.name,
            priceDelta: opt.priceDelta,
            isActive: opt.isActive,
          })),
        );
      } catch {
        setLoadError("Error de conexión al cargar el grupo.");
      } finally {
        setLoading(false);
      }
    };

    void fetchGroup();
  }, [isNew, params.id]);

  const handleAddOption = () => {
    setOptions((prev) => [...prev, { name: "", priceDelta: 0, isActive: true }]);
  };

  const handleRemoveOption = (index: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOptionChange = (
    index: number,
    field: keyof ModifierOptionForm,
    value: string | number | boolean,
  ) => {
    setOptions((prev) =>
      prev.map((opt, i) => (i === index ? { ...opt, [field]: value } : opt)),
    );
  };

  const handleSubmit = async () => {
    setSaving(true);
    setActionError(null);

    try {
      const payload = {
        ...formData,
        options: options.map((opt, idx) => ({
          ...(opt.id ? { id: opt.id } : {}),
          name: opt.name,
          priceDelta: Number(opt.priceDelta),
          isActive: opt.isActive,
          sortOrder: idx,
        })),
      };

      const url = isNew
        ? "/api/admin/menu/modifier-groups"
        : `/api/admin/menu/modifier-groups/${params.id}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push("/admin/menu/modifier-groups");
      } else {
        const errorData = await res.json();
        setActionError(errorData.error?.message || "Ocurrió un problema al guardar.");
      }
    } catch {
      setActionError("Error de conexión. Revisa tu red e intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Cargando grupo…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4 pb-8">
        <AdminPageHeader
          label="Catálogo"
          title="Modificadores"
          description="Los extras y opciones que el cliente elige al pedir."
        />
        <div className="rounded-xl border border-danger-strong/30 bg-danger px-4 py-3 text-sm font-medium text-danger-foreground">
          {loadError}
        </div>
        <Link href="/admin/menu/modifier-groups">
          <Button variant="outline" className="min-h-11 gap-2">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Volver a modificadores
          </Button>
        </Link>
      </div>
    );
  }

  const namedOptions = options.filter((opt) => opt.name.trim().length > 0).length;
  const canSave = formData.name.trim().length > 0 && namedOptions > 0 && !saving;

  return (
    <div className="space-y-5 pb-40 md:pb-8">
      <AdminPageHeader
        label="Catálogo"
        title={isNew ? "Nuevo grupo de modificadores" : `Editar: ${formData.name || "grupo"}`}
        description="Configura la regla de selección y las opciones que verá el cliente al pedir."
        actions={
          <Link href="/admin/menu/modifier-groups">
            <Button variant="outline" className="min-h-11 gap-2">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Volver
            </Button>
          </Link>
        }
      />

      {actionError ? (
        <div className="rounded-xl border border-danger-strong/30 bg-danger px-4 py-3 text-sm font-medium text-danger-foreground">
          {actionError}
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5" aria-label="Datos del grupo">
        <div className="grid gap-4">
          <Input
            label="Nombre del grupo"
            placeholder="Ej. Término de la carne, Tamaño, Extras…"
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            required
          />

          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Regla de selección
            <select
              className={SELECT_CLASS}
              value={formData.isRequired ? "required" : "optional"}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  isRequired: e.target.value === "required",
                  minSelections:
                    e.target.value === "required" && p.minSelections === 0 ? 1 : p.minSelections,
                }))
              }
            >
              <option value="optional">Opcional — el cliente puede elegir</option>
              <option value="required">Obligatoria — el cliente debe elegir</option>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Mínimo de opciones"
              type="number"
              min={0}
              value={formData.minSelections}
              onChange={(e) =>
                setFormData((p) => ({ ...p, minSelections: parseInt(e.target.value, 10) || 0 }))
              }
            />
            <Input
              label="Máximo de opciones"
              type="number"
              min={0}
              value={formData.maxSelections}
              onChange={(e) =>
                setFormData((p) => ({ ...p, maxSelections: parseInt(e.target.value, 10) || 0 }))
              }
            />
          </div>

          <p className="rounded-lg bg-accent px-3 py-2 text-sm text-brand-strong" aria-live="polite">
            {describeModifierRule(formData)} al pedir.
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-label="Opciones del grupo">
        <div className="flex items-baseline justify-between px-4 pb-1 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Opciones
          </p>
          <p className="font-mono text-[11px] font-bold text-muted-foreground">
            {options.filter((opt) => opt.isActive).length} activas de {options.length}
          </p>
        </div>

        {options.map((opt, index) => (
          <div
            key={index}
            className="flex items-center gap-2 border-t border-border px-4 py-2 first:border-t-0"
          >
            <div className="min-w-0 flex-1">
              <Input
                label={index === 0 ? "Nombre" : undefined}
                placeholder="Ej. Grande"
                value={opt.name}
                onChange={(e) => handleOptionChange(index, "name", e.target.value)}
                aria-label={`Nombre de la opción ${index + 1}`}
                required
              />
            </div>
            <div className="w-28 shrink-0">
              <Input
                label={index === 0 ? `Recargo (${currency.symbol})` : undefined}
                type="number"
                step="0.01"
                value={opt.priceDelta}
                onChange={(e) =>
                  handleOptionChange(index, "priceDelta", parseFloat(e.target.value) || 0)
                }
                aria-label={`Recargo en córdobas de la opción ${index + 1}`}
              />
            </div>
            <div className={`flex shrink-0 items-end gap-1 ${index === 0 ? "pb-0.5" : ""}`}>
              <OptionActiveSwitch
                checked={opt.isActive}
                label={`Opción ${opt.name || index + 1} ${opt.isActive ? "activa" : "inactiva"}`}
                onChange={(value) => handleOptionChange(index, "isActive", value)}
              />
              <button
                type="button"
                aria-label={`Quitar opción ${opt.name || index + 1}`}
                onClick={() => handleRemoveOption(index)}
                disabled={options.length <= 1}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger hover:text-danger-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40 motion-reduce:transition-none"
              >
                <Trash2 aria-hidden="true" className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        ))}

        <div className="border-t border-border p-3">
          <Button type="button" variant="secondary" className="min-h-11 w-full gap-2" onClick={handleAddOption}>
            <Plus aria-hidden="true" className="h-4 w-4" /> Añadir opción
          </Button>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Recargo 0 significa que la opción no cambia el precio del plato.
      </p>

      {/* Barra de acción fija (R6): guardar sin scroll, apilada sobre la tab bar */}
      <div className="fixed inset-x-0 bottom-14 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-sm md:bottom-0">
        <div className="mx-auto flex max-w-3xl gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-12 flex-1"
            disabled={saving}
            onClick={() => router.push("/admin/menu/modifier-groups")}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="min-h-12 flex-1 gap-2"
            disabled={!canSave}
            onClick={() => void handleSubmit()}
          >
            {saving ? (
              <LoaderCircle className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : null}
            {saving ? "Guardando…" : "Guardar grupo"}
          </Button>
        </div>
      </div>
    </div>
  );
}
