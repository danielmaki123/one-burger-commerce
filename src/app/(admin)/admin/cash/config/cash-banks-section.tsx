"use client";

import * as React from "react";

import type { BankCatalogEntry } from "@/modules/banks/domain/bank.types";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";

/**
 * Fase 3 del rediseño de Caja (2026-09-23) — la sección **Bancos** de Config de Caja.
 *
 * Con qué bancos liquida cada sucursal es lo que decide **contra qué se cuadra el lote** de la terminal
 * en el cierre. Por eso vive acá, con la config del arqueo, y por eso es del dueño.
 *
 * Tres decisiones de la pantalla:
 *
 * - Un banco **no se borra**: se apaga. Los cierres viejos guardan contra qué banco se cuadró
 *   (`ShiftBankClose`) y el `onDelete: Restrict` de la base lo haría fallar de todos modos.
 * - La asignación se edita por sucursal (una casilla por local) y el guardado manda el **catálogo
 *   completo**: el servidor reemplaza la lista y apaga lo que no venga.
 * - Sin bancos cargados la sección lo dice: el cierre de esa sucursal no va a ofrecer ningún bloque.
 */
export default function CashBanksSection({
  locations,
  initialBanks,
}: {
  locations: { id: string; name: string }[];
  initialBanks: BankCatalogEntry[];
}) {
  const [banks, setBanks] = React.useState<BankCatalogEntry[]>(initialBanks);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  function addBank() {
    setBanks((current) => [
      ...current,
      {
        id: "",
        name: "",
        code: null,
        isActive: true,
        sortOrder: current.length,
        locationIds: [],
      },
    ]);
    setNotice(null);
  }

  function patchBank(index: number, patch: Partial<BankCatalogEntry>) {
    setBanks((current) =>
      current.map((bank, position) => (position === index ? { ...bank, ...patch } : bank)),
    );
  }

  function toggleLocation(index: number, locationId: string, assigned: boolean) {
    const bank = banks[index];
    const next = assigned
      ? [...new Set([...bank.locationIds, locationId])]
      : bank.locationIds.filter((id) => id !== locationId);

    patchBank(index, { locationIds: next });
  }

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/cash/banks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banks }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        data?: { banks: BankCatalogEntry[] };
        error?: { message?: string; fields?: Record<string, string> };
      };

      if (!response.ok || !body.data) {
        const fields = body.error?.fields ?? {};
        // Un solo canal de error: si el servidor señala una fila, ese mensaje es el útil.
        setError(fields[Object.keys(fields)[0] ?? ""] ?? body.error?.message ?? "No se pudo guardar.");
        return;
      }

      setBanks(body.data.banks);
      setNotice("Bancos guardados.");
    } catch {
      setError("No se pudieron guardar los bancos: revisá la conexión.");
    } finally {
      setSaving(false);
    }
  }

  const activeCount = banks.filter((bank) => bank.isActive).length;

  return (
    <section
      aria-label="Bancos"
      className="space-y-4 rounded-stitch-lg border border-line-subtle bg-surface-card p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-st-h2 text-ink">Bancos</h2>
        <p className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
          {activeCount === 1 ? "1 banco" : `${activeCount} bancos`}
        </p>
      </div>

      <p className="text-st-body text-ink-secondary">
        Con estos bancos liquida la sucursal. En el cierre, cada uno pide el monto que reportó y el lote
        de su terminal. Un banco que se apaga deja de ofrecerse; no se borra, para que los cierres viejos
        sigan diciendo contra quién se cuadró.
      </p>

      {banks.length === 0 ? (
        <p className="text-st-body text-ink-secondary">
          Todavía no hay bancos cargados: el cierre no va a ofrecer ningún bloque hasta que agregues uno.
        </p>
      ) : null}

      <ul className="space-y-4">
        {banks.map((bank, index) => (
          <li
            key={bank.id || `nuevo-${index}`}
            className="space-y-3 rounded-stitch-md border border-line-subtle p-3"
          >
            <div className="flex flex-wrap items-end gap-2">
              <Input
                label={`Nombre del banco ${index + 1}`}
                value={bank.name}
                onChange={(event) => patchBank(index, { name: event.target.value })}
                className="sm:max-w-[16rem]"
              />
              <Input
                label={`Código ${index + 1} (opcional)`}
                value={bank.code ?? ""}
                onChange={(event) => patchBank(index, { code: event.target.value || null })}
                className="sm:max-w-[8rem]"
              />
              <Checkbox
                label={`${bank.name || `Banco ${index + 1}`} activo`}
                checked={bank.isActive}
                onChange={(event) => patchBank(index, { isActive: event.target.checked })}
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
                Liquida en
              </legend>

              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {locations.map((location) => (
                  <Checkbox
                    key={location.id}
                    label={`${bank.name || `Banco ${index + 1}`} en ${location.name}`}
                    checked={bank.locationIds.includes(location.id)}
                    onChange={(event) =>
                      toggleLocation(index, location.id, event.target.checked)
                    }
                  />
                ))}
              </div>
            </fieldset>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={addBank}>
          Agregar banco
        </Button>

        <Button type="button" className="min-h-11" disabled={saving} onClick={() => void save()}>
          {saving ? "Guardando…" : "Guardar bancos"}
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
