"use client";

import * as React from "react";

import type { PosTerminalRecord } from "@/modules/cash-config/domain/cash-config.types";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";

/**
 * Fase 6 del rediseño de Caja (2026-09-23) — la sección **Terminales** de Config de Caja.
 *
 * Las terminales son las **estaciones físicas** del local («Caja 1», «Barra»): cada una abre su propia caja y
 * la cierra con su conteo. Con dos cargadas, la pantalla de Caja ofrece elegir en cuál está el cajero; con
 * ninguna, el local sigue teniendo una sola caja (que es como se comporta una sucursal chica).
 *
 * Tres decisiones, las mismas que el catálogo de bancos:
 *
 * - Una terminal **no se borra: se apaga** (un turno viejo la referencia y el `onDelete: Restrict` de la base
 *   lo exige).
 * - El guardado manda el estado **completo de la sucursal** elegida: el servidor sube lo que viene y apaga
 *   lo que falta.
 * - El `id` de una terminal nueva lo genera la pantalla (`term_<uuid>`): el servidor hace `upsert` por id, y
 *   sin id no habría a qué apuntar cuando se guarde la asignación.
 */
export default function CashTerminalsSection({
  locations,
  initialTerminals,
}: {
  locations: { id: string; name: string }[];
  /** Todas las terminales del alcance; la sección filtra por la sucursal elegida. */
  initialTerminals: PosTerminalRecord[];
}) {
  const [locationId, setLocationId] = React.useState(() => locations[0]?.id ?? "");
  const [terminals, setTerminals] = React.useState<PosTerminalRecord[]>(initialTerminals);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const rows = React.useMemo(
    () =>
      terminals
        .filter((terminal) => terminal.locationId === locationId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [terminals, locationId],
  );

  function patchRow(id: string, patch: Partial<PosTerminalRecord>) {
    setTerminals((current) =>
      current.map((terminal) => (terminal.id === id ? { ...terminal, ...patch } : terminal)),
    );
    setNotice(null);
  }

  function addRow() {
    const id = `term_${crypto.randomUUID()}`;

    setTerminals((current) => [
      ...current,
      {
        id,
        locationId,
        label: "",
        isActive: true,
        // El orden sigue a las que ya están: la nueva entra al final.
        sortOrder: rows.length,
      },
    ]);
    setNotice(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/cash/terminals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, terminals: rows }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        data?: { terminals: PosTerminalRecord[] };
        error?: { message?: string; fields?: Record<string, string> };
      };

      const saved = body.data;
      if (!response.ok || !saved) {
        // Un solo canal de error: si el servidor señala una fila, ese mensaje es el útil.
        const fields = body.error?.fields ?? {};
        setError(
          fields[Object.keys(fields)[0] ?? ""] ?? body.error?.message ?? "No se pudo guardar.",
        );
        return;
      }

      // El servidor devuelve la sucursal guardada: se reemplazan esas filas y se dejan las de los demás
      // locales como estaban (la pantalla no las tocó).
      setTerminals((current) => [
        ...current.filter((terminal) => terminal.locationId !== locationId),
        ...saved.terminals,
      ]);
      setNotice("Terminales guardadas.");
    } catch {
      setError("No se pudieron guardar las terminales: revisá la conexión.");
    } finally {
      setSaving(false);
    }
  }

  const activeCount = rows.filter((terminal) => terminal.isActive).length;

  return (
    <section
      aria-label="Terminales"
      className="space-y-4 rounded-stitch-lg border border-line-subtle bg-surface-card p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-st-h2 text-ink">Terminales</h2>
        <p className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
          {activeCount === 1 ? "1 terminal" : `${activeCount} terminales`}
        </p>
      </div>

      <p className="text-st-body text-ink-secondary">
        Las estaciones físicas del local. Cada una abre y cierra **su** caja, con su conteo y su arqueo. Sin
        terminales cargadas el local tiene una sola caja, como hasta ahora.
      </p>

      {locations.length > 1 ? (
        <Select
          label="Sucursal"
          value={locationId}
          onChange={(event) => {
            setLocationId(event.target.value);
            setNotice(null);
          }}
          options={locations.map((location) => ({ value: location.id, label: location.name }))}
        />
      ) : null}

      {rows.length === 0 ? (
        <p className="text-st-body text-ink-secondary">
          Esta sucursal todavía no tiene terminales: la caja se abre y se cierra como una sola.
        </p>
      ) : null}

      <ul className="space-y-3">
        {rows.map((terminal, index) => (
          <li
            key={terminal.id}
            className="flex flex-wrap items-end gap-3 rounded-stitch-md border border-line-subtle p-3"
          >
            <Input
              label={`Nombre de la terminal ${index + 1}`}
              value={terminal.label}
              onChange={(event) => patchRow(terminal.id, { label: event.target.value })}
              className="sm:max-w-[16rem]"
            />
            <Checkbox
              label={`${terminal.label || `Terminal ${index + 1}`} activa`}
              checked={terminal.isActive}
              onChange={(event) => patchRow(terminal.id, { isActive: event.target.checked })}
            />
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={addRow}>
          Agregar terminal
        </Button>

        <Button type="button" className="min-h-11" disabled={saving} onClick={() => void save()}>
          {saving ? "Guardando…" : "Guardar terminales"}
        </Button>

        {notice ? (
          <p role="status" className="text-st-body font-medium text-status-ready-text">
            {notice}
          </p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-st-body font-medium text-status-sla-text">
          {error}
        </p>
      ) : null}
    </section>
  );
}
