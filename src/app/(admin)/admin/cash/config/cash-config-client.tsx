"use client";

import * as React from "react";

import type { CashConfigRecord } from "@/modules/cash-config/domain/cash-config.types";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";

/**
 * Fase 2 del rediseño de Caja (2026-09-22) — la pantalla de **Config de Caja** (reemplaza el placeholder).
 *
 * Una sola sucursal por vez (arriba), porque la config es de la sucursal: qué monedas cuenta y si el cajero
 * ve el esperado. Los **billetes** son del negocio y valen para todos los locales —los de córdoba son los
 * mismos en las tres—, así que se editan una vez y se muestran siempre.
 *
 * Tres decisiones de la pantalla:
 *
 * - Un billete no se **borra**: se apaga. Los cierres viejos guardan con qué billetes se contó
 *   (`ShiftCashCount`), así que sacar la fila borraría la explicación de un arqueo ya firmado.
 * - El guardado manda **todo** lo que se está viendo (los dos flags y la lista completa de billetes): el
 *   servidor reemplaza la lista y apaga lo que no venga.
 * - La moneda del negocio no se puede apagar (no hay control para eso): se cuenta siempre.
 */
const BASE_CURRENCY = "NIO";

type DenominationRow = CashConfigRecord["denominations"][number];

export default function CashConfigClient({
  locations,
  initialConfig,
}: {
  locations: { id: string; name: string }[];
  initialConfig: CashConfigRecord;
}) {
  const [locationId, setLocationId] = React.useState(initialConfig.locationId);
  const [config, setConfig] = React.useState<CashConfigRecord>(initialConfig);
  const [draft, setDraft] = React.useState<DenominationRow[]>(initialConfig.denominations);
  const [newValue, setNewValue] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const applyConfig = React.useCallback((next: CashConfigRecord) => {
    setConfig(next);
    setDraft(next.denominations);
    setNewValue("");
    setError(null);
  }, []);

  const load = React.useCallback(
    async (target: string) => {
      setLoading(true);
      setNotice(null);

      try {
        const response = await fetch(
          `/api/admin/cash/config?locationId=${encodeURIComponent(target)}`,
          { cache: "no-store" },
        );
        const body = (await response.json().catch(() => ({}))) as {
          data?: CashConfigRecord;
          error?: { message?: string };
        };

        if (!response.ok || !body.data) {
          setError(body.error?.message ?? "No se pudo leer la configuración de caja.");
          return;
        }

        applyConfig({ ...body.data, locationId: target });
      } catch {
        setError("No se pudo leer la configuración de caja: revisá la conexión.");
      } finally {
        setLoading(false);
      }
    },
    [applyConfig],
  );

  const currencies = React.useMemo(() => {
    const fromDraft = [...new Set(draft.map((row) => row.currency))];
    return [BASE_CURRENCY, ...fromDraft.filter((currency) => currency !== BASE_CURRENCY), "USD"].filter(
      (currency, index, all) => all.indexOf(currency) === index,
    );
  }, [draft]);

  const rowsFor = (currency: string) =>
    draft
      .filter((row) => row.currency === currency)
      .sort((a, b) => b.value - a.value);

  function toggleDenomination(currency: string, value: number, isActive: boolean) {
    setDraft((current) =>
      current.map((row) =>
        row.currency === currency && row.value === value ? { ...row, isActive } : row,
      ),
    );
  }

  function addDenomination(currency: string) {
    const value = Number(newValue);

    if (!Number.isFinite(value) || value <= 0) {
      setError("Escribí un valor mayor que cero");
      return;
    }

    if (draft.some((row) => row.currency === currency && row.value === value)) {
      setError(`${currency} ${value} ya está en la lista`);
      return;
    }

    const sortOrder = rowsFor(currency).length;
    setDraft((current) => [...current, { currency, value, isActive: true, sortOrder }]);
    setNewValue("");
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/cash/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          usdEnabled: config.usdEnabled,
          blindCount: config.blindCount,
          denominations: draft.map(({ currency, value, isActive }) => ({
            currency,
            value,
            isActive,
          })),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        data?: CashConfigRecord;
        error?: { message?: string; fields?: Record<string, string> };
      };

      if (!response.ok || !body.data) {
        // Un solo canal de error: si el servidor señala un campo, ese mensaje es el útil.
        setError(
          body.error?.fields?.denominations ??
            body.error?.message ??
            "No se pudo guardar la configuración de caja.",
        );
        return;
      }

      applyConfig({ ...body.data, locationId });
      setNotice("Configuración guardada.");
    } catch {
      setError("No se pudo guardar la configuración de caja: revisá la conexión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {locations.length > 1 ? (
        <Select
          label="Sucursal"
          value={locationId}
          onChange={(event) => {
            setLocationId(event.target.value);
            void load(event.target.value);
          }}
          options={locations.map((location) => ({ value: location.id, label: location.name }))}
        />
      ) : null}

      {loading ? (
        <p role="status" className="text-st-body text-ink-secondary">
          Leyendo la configuración…
        </p>
      ) : null}

      <section
        aria-label="Monedas y arqueo"
        className="space-y-3 rounded-stitch-lg border border-line-subtle bg-surface-card p-4"
      >
        <h2 className="text-st-h2 text-ink">Monedas y arqueo</h2>

        <Checkbox
          label="Esta sucursal cuenta dólares"
          checked={config.usdEnabled}
          onChange={(event) =>
            setConfig((current) => ({ ...current, usdEnabled: event.target.checked }))
          }
        />

        <Checkbox
          label="Arqueo ciego: el cajero no ve el esperado ni la diferencia"
          checked={config.blindCount}
          onChange={(event) =>
            setConfig((current) => ({ ...current, blindCount: event.target.checked }))
          }
        />

        <p className="text-st-caption text-ink-secondary">
          Los córdobas se cuentan siempre. El arqueo ciego se aplica en la pantalla del turno en la Fase 4
          del rediseño.
        </p>
      </section>

      <section
        aria-label="Billetes y monedas"
        className="space-y-4 rounded-stitch-lg border border-line-subtle bg-surface-card p-4"
      >
        <h2 className="text-st-h2 text-ink">Billetes y monedas</h2>
        <p className="text-st-body text-ink-secondary">
          Valen para todas las sucursales. Un billete que se apaga deja de ofrecerse en el conteo; no se
          borra, para que los cierres viejos sigan diciendo con qué se contó.
        </p>

        {currencies.map((currency) => (
          <div key={currency} className="space-y-2">
            <h3 className="text-st-h3 text-ink">{currency}</h3>

            <ul className="flex flex-wrap gap-x-4 gap-y-2">
              {rowsFor(currency).map((row) => (
                <li key={`${row.currency}-${row.value}`}>
                  <Checkbox
                    label={String(row.value)}
                    checked={row.isActive}
                    onChange={(event) =>
                      toggleDenomination(currency, row.value, event.target.checked)
                    }
                  />
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-end gap-2">
              <Input
                label={`Agregar billete de ${currency}`}
                type="number"
                inputMode="decimal"
                min={0}
                value={newValue}
                onChange={(event) => setNewValue(event.target.value)}
                className="sm:max-w-[10rem]"
              />
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => addDenomination(currency)}
              >
                Agregar
              </Button>
            </div>
          </div>
        ))}

        {error ? (
          <p role="alert" className="text-st-body font-medium text-status-sla-text">
            {error}
          </p>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" className="min-h-11" disabled={saving} onClick={() => void save()}>
          {saving ? "Guardando…" : "Guardar configuración"}
        </Button>

        {notice ? (
          <p role="status" className="text-st-body font-medium text-status-ready-text">
            {notice}
          </p>
        ) : null}
      </div>
    </div>
  );
}
