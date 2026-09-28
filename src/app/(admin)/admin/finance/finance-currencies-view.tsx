"use client";

import * as React from "react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { Select } from "@/shared/ui/select";
import { Toggle } from "@/shared/ui/toggle";

import { AdminEmptyState } from "../_components/admin-operational-ui";
import { AdminTable, AdminTableCell, AdminTableRow } from "./finance-table";
import type { FinanceViewProps } from "./finance-view-types";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-018`, `D-019`, `A-72`) — la vista **Monedas y tasas**.
 *
 * Composición congelada por la referencia: **dos tarjetas de resumen** (moneda base y formato regional, cada
 * una con su operación) y la tabla **código · moneda · símbolo · tasa vigente · estado · acciones**.
 *
 * Cuatro reglas de la pantalla, y las cuatro son de dinero:
 *
 * 1. **La moneda base no se edita en el formulario de la moneda**: tiene su propia operación («Cambiar moneda
 *    base»), con su confirmación y su alcance informado. Cambiarla abre un período nuevo y **no recalcula**
 *    nada: los hechos históricos conservan su moneda, su tasa y su equivalente (`D-018`).
 * 2. **Registrar una tasa crea historia**: cierra la vigente y agrega una fila, y la pantalla lo dice en vez
 *    de que el dueño lo suponga.
 * 3. **El catálogo conocido es conveniencia, no una restricción**: una moneda personalizada con código
 *    interno es válida (`D-019`), así que el formulario acepta un código que no esté en la lista.
 * 4. **Los números van en `font-mono` con `tabular-nums`**: una tasa que cambia de ancho mueve la tabla.
 *
 * La tasa vigente sale de `rateHistory` (las **filas**), no de `activeRates` (el **mapa** de la conversión):
 * confundir las dos formas rompía esta vista con un `activeRates.find is not a function` apenas hubiera una
 * tasa registrada.
 */
export default function FinanceCurrenciesView({ config, api, run }: FinanceViewProps) {
  const [currencyDraft, setCurrencyDraft] = React.useState<null | {
    code: string;
    name: string;
    symbol: string;
    decimals: number;
    isActive: boolean;
    existing: boolean;
  }>(null);
  const [rateDraft, setRateDraft] = React.useState<null | { fromCurrencyCode: string; rate: string }>(null);
  const [baseDraft, setBaseDraft] = React.useState<null | { code: string }>(null);
  const [localeDraft, setLocaleDraft] = React.useState<null | { locale: string }>(null);

  const base = config.settings.baseCurrencyCode;
  const baseCurrency = config.settings.currencies.find((currency) => currency.code === base);

  const rateFor = (code: string) =>
    config.settings.rateHistory.find((candidate) => candidate.fromCurrencyCode === code) ?? null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="space-y-2">
          <p className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">Moneda base</p>
          <p className="font-mono text-st-h2 tabular-nums text-ink">
            {baseCurrency ? `${baseCurrency.code} · ${baseCurrency.name}` : base}
          </p>
          <p className="text-st-caption text-ink-muted">
            Los hechos históricos conservan su moneda y equivalencia original.
          </p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => setBaseDraft({ code: base })}
          >
            Cambiar moneda base
          </Button>
        </Card>

        <Card className="space-y-2">
          <p className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
            Formato regional
          </p>
          <p className="font-mono text-st-h2 tabular-nums text-ink">{config.settings.locale}</p>
          <p className="text-st-caption text-ink-muted">
            Editable independientemente de la moneda: cambia cómo se ve la plata, no su valor.
          </p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => setLocaleDraft({ locale: config.settings.locale })}
          >
            Cambiar formato
          </Button>
        </Card>
      </div>

      <div className="space-y-4 rounded-stitch-lg border border-line-subtle bg-surface-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-st-h2 text-ink">Monedas y tasas</h2>
            <p className="text-st-body text-ink-secondary">
              Moneda base, monedas aceptadas y tipos de cambio vigentes.
            </p>
          </div>
          <Button
            type="button"
            className="min-h-11"
            onClick={() =>
              setCurrencyDraft({
                code: "",
                name: "",
                symbol: "",
                decimals: 2,
                isActive: true,
                existing: false,
              })
            }
          >
            + Agregar moneda
          </Button>
        </div>

        <p className="text-st-caption text-ink-muted">
          El catálogo conocido es conveniencia, no una restricción. Una moneda personalizada puede usar un
          código interno. En runtime, guardar una tasa nueva crea historia; no reescribe cobros anteriores.
        </p>

        {config.settings.currencies.length === 0 ? (
          <AdminEmptyState
            title="Todavía no hay monedas cargadas"
            description="Sin monedas, el sistema no sabe en qué cobrar."
          />
        ) : (
          <AdminTable
            label="Monedas y tasas"
            columns={["Código", "Moneda", "Símbolo", "Tasa vigente", "Estado", ""]}
            gridClassName="md:grid-cols-[70px_minmax(160px,1.1fr)_80px_minmax(150px,1fr)_100px_34px]"
          >
            {config.settings.currencies.map((currency) => {
              const rate = rateFor(currency.code);

              return (
                <AdminTableRow
                  key={currency.code}
                  gridClassName="md:grid-cols-[70px_minmax(160px,1.1fr)_80px_minmax(150px,1fr)_100px_34px]"
                >
                  <AdminTableCell label="Código" mono>
                    <strong>{currency.code}</strong>
                  </AdminTableCell>

                  <AdminTableCell label="Moneda">
                    <strong className="block text-st-body font-semibold">{currency.name}</strong>
                    <span className="mt-1 block text-st-caption text-ink-muted">
                      {currency.code === base ? "Moneda base" : currency.isActive ? "Aceptada" : "Disponible"}
                    </span>
                  </AdminTableCell>

                  <AdminTableCell label="Símbolo">{currency.symbol}</AdminTableCell>

                  <AdminTableCell label="Tasa vigente" mono>
                    {currency.code === base
                      ? "Moneda base"
                      : rate
                        ? `1 ${currency.code} = ${rate.rate} ${base}`
                        : "Sin tasa"}
                  </AdminTableCell>

                  <AdminTableCell label="Estado">
                    {currency.code === base ? (
                      <Badge variant="default">BASE</Badge>
                    ) : (
                      <Toggle
                        label={`${currency.code}: ${currency.isActive ? "activa" : "apagada"}`}
                        checked={currency.isActive}
                        onChange={(next) =>
                          void run(
                            () =>
                              api.saveCurrency({
                                code: currency.code,
                                name: currency.name,
                                symbol: currency.symbol,
                                decimals: currency.decimals,
                                isActive: next,
                                mode: "update",
                              }),
                            `${currency.code}: ${next ? "activa" : "apagada"}.`,
                          )
                        }
                      />
                    )}
                  </AdminTableCell>

                  <AdminTableCell label="Acciones">
                    <div className="flex items-center gap-1">
                      {currency.code !== base ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11 md:min-h-9 md:px-2"
                          aria-label={`Guardar tasa de ${currency.code}`}
                          onClick={() => setRateDraft({ fromCurrencyCode: currency.code, rate: "" })}
                        >
                          Tasa
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 md:min-h-9 md:px-2"
                        aria-label={`Editar ${currency.code}`}
                        onClick={() =>
                          setCurrencyDraft({
                            code: currency.code,
                            name: currency.name,
                            symbol: currency.symbol,
                            decimals: currency.decimals,
                            isActive: currency.isActive,
                            existing: true,
                          })
                        }
                      >
                        ···
                      </Button>
                    </div>
                  </AdminTableCell>
                </AdminTableRow>
              );
            })}
          </AdminTable>
        )}

        <p className="text-st-caption text-ink-muted">
          Historia protegida. Los movimientos anteriores conservarán moneda, tasa y equivalente con los que
          fueron registrados.
        </p>
      </div>

      <Modal
        open={currencyDraft !== null}
        title={currencyDraft?.existing ? "Editar moneda" : "Agregar moneda"}
        onClose={() => setCurrencyDraft(null)}
      >
        {currencyDraft ? (
          <div className="space-y-3">
            {!currencyDraft.existing ? (
              <Select
                label="Buscar conocida"
                value=""
                placeholder="Buscar conocida…"
                options={config.knownCurrencies.map((currency) => ({
                  value: currency.code,
                  label: `${currency.code} — ${currency.name}`,
                }))}
                onChange={(event) => {
                  const known = config.knownCurrencies.find(
                    (candidate) => candidate.code === event.target.value,
                  );

                  setCurrencyDraft({
                    ...currencyDraft,
                    code: known?.code ?? "",
                    name: known?.name ?? "",
                    symbol: known?.symbol ?? "",
                    decimals: known?.decimals ?? 2,
                  });
                }}
              />
            ) : null}

            <Input
              label="Código"
              value={currencyDraft.code}
              disabled={currencyDraft.existing}
              onChange={(event) =>
                setCurrencyDraft({ ...currencyDraft, code: event.target.value.toUpperCase() })
              }
            />
            <Input
              label="Nombre"
              value={currencyDraft.name}
              onChange={(event) => setCurrencyDraft({ ...currencyDraft, name: event.target.value })}
            />
            <Input
              label="Símbolo"
              value={currencyDraft.symbol}
              onChange={(event) => setCurrencyDraft({ ...currencyDraft, symbol: event.target.value })}
            />
            <Input
              label="Decimales"
              inputMode="numeric"
              value={String(currencyDraft.decimals)}
              onChange={(event) =>
                setCurrencyDraft({
                  ...currencyDraft,
                  decimals: Number(event.target.value.replace(/\D/g, "") || 0),
                })
              }
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className="min-h-11"
                onClick={() =>
                  void run(
                    () =>
                      api.saveCurrency({
                        code: currencyDraft.code,
                        name: currencyDraft.name || null,
                        symbol: currencyDraft.symbol || null,
                        decimals: currencyDraft.decimals,
                        isActive: currencyDraft.isActive,
                        mode: currencyDraft.existing ? "update" : "create",
                      }),
                    "Moneda guardada.",
                  ).then((ok) => {
                    if (ok) setCurrencyDraft(null);
                  })
                }
              >
                Guardar moneda
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setCurrencyDraft(null)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={rateDraft !== null} title="Tipo de cambio" onClose={() => setRateDraft(null)}>
        {rateDraft ? (
          <div className="space-y-3">
            <p className="text-st-body text-ink-secondary">
              Cuántos <span className="font-mono tabular-nums">{base}</span> vale una unidad de{" "}
              <span className="font-mono tabular-nums">{rateDraft.fromCurrencyCode}</span>. Registrar la tasa
              cierra la vigente y agrega un hecho nuevo con su fecha.
            </p>
            <Input
              label={`Tasa (${base} por 1 ${rateDraft.fromCurrencyCode})`}
              inputMode="decimal"
              value={rateDraft.rate}
              onChange={(event) => setRateDraft({ ...rateDraft, rate: event.target.value })}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className="min-h-11"
                onClick={() =>
                  void run(
                    () =>
                      api.registerRate({
                        fromCurrencyCode: rateDraft.fromCurrencyCode,
                        rate: Number(rateDraft.rate),
                      }),
                    "Tasa registrada.",
                  ).then((ok) => {
                    if (ok) setRateDraft(null);
                  })
                }
              >
                Guardar tasa
              </Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setRateDraft(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={baseDraft !== null} title="Cambiar moneda base" onClose={() => setBaseDraft(null)}>
        {baseDraft ? (
          <div className="space-y-3">
            <p className="text-st-body text-ink-secondary">
              Los hechos históricos conservan su moneda, su tasa y su equivalente. Nada ya registrado se
              recalcula.
            </p>
            <Select
              label="Nueva moneda base"
              value={baseDraft.code}
              options={config.settings.currencies
                .filter((currency) => currency.isActive)
                .map((currency) => ({
                  value: currency.code,
                  label: `${currency.code} — ${currency.name}`,
                }))}
              onChange={(event) => setBaseDraft({ code: event.target.value })}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className="min-h-11"
                disabled={baseDraft.code === base}
                onClick={() =>
                  void run(
                    () => api.changeBaseCurrency({ code: baseDraft.code }),
                    "Moneda base cambiada.",
                  ).then((ok) => {
                    if (ok) setBaseDraft(null);
                  })
                }
              >
                Cambiar moneda base
              </Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setBaseDraft(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={localeDraft !== null} title="Cambiar formato" onClose={() => setLocaleDraft(null)}>
        {localeDraft ? (
          <div className="space-y-3">
            <Select
              label="Formato regional"
              value={localeDraft.locale}
              options={config.knownLocales}
              onChange={(event) => setLocaleDraft({ locale: event.target.value })}
            />
            <p className="text-st-caption text-ink-muted">
              Cambia cómo se ve la plata, no su valor. Ningún monto guardado se altera.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className="min-h-11"
                onClick={() =>
                  void run(
                    () => api.changeBaseCurrency({ code: base, locale: localeDraft.locale }),
                    "Formato actualizado.",
                  ).then((ok) => {
                    if (ok) setLocaleDraft(null);
                  })
                }
              >
                Guardar formato
              </Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setLocaleDraft(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
