"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { useCurrencyFormat } from "@/shared/lib/business-settings";
import {
  AdminEmptyState,
  AdminPageHeader,
} from "../../_components/admin-operational-ui";
import {
  describeModifierRule,
  formatOptionPriceDelta,
} from "./modifier-group-helpers";
import { pluralEs } from "../categories/category-list-helpers";

interface ModifierOption {
  id: string;
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
  options: ModifierOption[];
}

const MAX_VISIBLE_OPTIONS = 4;

export default function ModifierGroupsPage() {
  const [groups, setGroups] = React.useState<ModifierGroup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const currency = useCurrencyFormat();

  React.useEffect(() => {
    let cancelled = false;

    const fetchGroups = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch("/api/admin/menu/modifier-groups");
        if (!res.ok) throw new Error("No se pudieron cargar los modificadores. Intenta nuevamente.");
        const json = await res.json();
        if (!cancelled) setGroups(json.data || []);
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "No se pudieron cargar los modificadores.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchGroups();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const totalOptions = groups.reduce((sum, group) => sum + group.options.length, 0);

  return (
    <div className="space-y-5 pb-8">
      <AdminPageHeader
        label="Catálogo"
        title="Modificadores"
        description="Los extras y opciones que el cliente elige al pedir: término de la carne, tamaño, extras."
        actions={
          <Link href="/admin/menu/modifier-groups/new">
            <Button className="min-h-11">Nuevo grupo</Button>
          </Link>
        }
      />

      {loading ? (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-border bg-card text-sm text-muted-foreground">
          Cargando modificadores…
        </div>
      ) : loadError ? (
        <AdminEmptyState
          title="No se pudieron cargar los modificadores"
          description={loadError}
          action={
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setReloadKey((key) => key + 1)}>
              Reintentar
            </Button>
          }
        />
      ) : groups.length === 0 ? (
        <AdminEmptyState
          title="Sin grupos todavía"
          description="Crea el primero — por ejemplo “Término de la carne” — y úsalo en cualquier plato."
          action={
            <Link href="/admin/menu/modifier-groups/new">
              <Button variant="outline" className="min-h-11">Crear grupo</Button>
            </Link>
          }
        />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-label="Listado de grupos de modificadores">
          <div className="flex items-baseline justify-between px-4 pb-1 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Grupos
            </p>
            <p className="font-mono text-[11px] font-bold text-muted-foreground">
              {pluralEs(groups.length, "grupo", "grupos")} · {pluralEs(totalOptions, "opción", "opciones")}
            </p>
          </div>

          {groups.map((group) => {
            const visibleOptions = group.options.slice(0, MAX_VISIBLE_OPTIONS);
            const hiddenOptions = group.options.length - visibleOptions.length;

            return (
              <Link
                key={group.id}
                href={`/admin/menu/modifier-groups/${group.id}`}
                aria-label={`Editar ${group.name}`}
                className="grid grid-cols-[minmax(0,1fr)_auto_1.25rem] items-center gap-x-3 border-t border-border px-4 py-3 transition-colors first:border-t-0 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand motion-reduce:transition-none"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-semibold text-foreground">{group.name}</p>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold before:h-1.5 before:w-1.5 before:rounded-full before:bg-current before:content-[''] ${
                        group.isRequired
                          ? "bg-danger text-danger-foreground"
                          : "bg-accent text-brand-strong before:hidden"
                      }`}
                    >
                      {group.isRequired ? "Obligatorio" : "Opcional"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {describeModifierRule(group)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[15px] font-bold tabular-nums text-foreground">{group.options.length}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {group.options.length === 1 ? "opción" : "opciones"}
                  </p>
                </div>

                <ChevronRight aria-hidden="true" className="h-4.5 w-4.5 text-muted-foreground" />

                {group.options.length > 0 ? (
                  <div className="col-span-full mt-2 flex flex-wrap gap-1.5">
                    {visibleOptions.map((option) => {
                      const delta = formatOptionPriceDelta(option.priceDelta, currency);
                      return (
                        <span
                          key={option.id}
                          className={`inline-flex min-h-7 items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-foreground ${
                            option.isActive ? "" : "opacity-55"
                          }`}
                        >
                          <span className={option.isActive ? "" : "line-through"}>{option.name}</span>
                          {delta ? (
                            <span className="font-bold tabular-nums text-brand-strong">{delta}</span>
                          ) : null}
                        </span>
                      );
                    })}
                    {hiddenOptions > 0 ? (
                      <span className="inline-flex min-h-7 items-center rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        +{hiddenOptions} más
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <p className="col-span-full mt-2 text-xs text-muted-foreground">
                    Sin opciones — el grupo no se puede usar todavía.
                  </p>
                )}
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}
