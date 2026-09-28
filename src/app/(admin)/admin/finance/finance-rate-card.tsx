"use client";

import * as React from "react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { Select } from "@/shared/ui/select";

import { AdminEmptyState } from "../_components/admin-operational-ui";
import { createFinanceApi, type FinanceConfig } from "./finance-client-helpers";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-018`, `D-019`, `A-72`) — la vista **Monedas y tasas**.
 *
 * Las dos tarjetas de resumen que la referencia aprobada congela (moneda base y formato regional) más la
 * tabla del catálogo con su tasa vigente. Cuatro reglas de la pantalla, y las cuatro son de dinero:
 *
 * 1. **La moneda base no se edita en el formulario de la moneda**: tiene su propia operación («Cambiar moneda
 *    base»), con su confirmación y su alcance informado. Cambiarla abre un período nuevo y **no recalcula**
 *    nada: los hechos históricos conservan su moneda, su tasa y su equivalente (`D-018`).
 * 2. **Registrar una tasa crea historia**: cierra la vigente y agrega una fila. No reescribe cobros
 *    anteriores, y la pantalla lo dice en vez de que el dueño lo suponga.
 * 3. **El catálogo conocido es conveniencia, no una restricción**: una moneda personalizada con código
 *    interno es válida (`D-019`), y por eso el formulario acepta un código que no esté en la lista.
 * 4. **Los números van en `font-mono` con `tabular-nums`**: una tasa que cambia de ancho mueve la tabla.
 */
export default function FinanceRateCard({
  config,
  api,
  run,
}: {
  config: FinanceConfig;
  api: ReturnType<typeof createFinanceApi>;
  run: (
    work: () => Promise<{ ok: true } | { ok: false; message: string }>,
    done: string,
  ) => Promise<void>;
}) {
  const [currencyDraft, setCurrencyDraft] = React.useState<null | {
    code: string;
    name: string;
    symbol: string;
    decimals: number;
    isActive: boolean;
    existing: boolean;
  }>(null);
  const [rateDraft, setRateDraft] = React.useState<null | { fromCurrencyCode: string; rate: string }>(null);
  const [baseDraft, setBaseDraft] = React.useState<null | { code: string; locale: string }>(null);
  const [localeDraft, setLocaleDraft] = React.useState<null | { locale: string }>(null);

  const base = config.settings.baseCurrencyCode;
  const baseCurrency = config.settings.currencies.find((currency) => currency.code === base);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="space-y-2">
          <p className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">Moneda base</p>
          <p className="font-mono text-st-h2 tabular-nums text-ink">{base}</p>
          <p className="text-st-caption text-ink-muted">
            {baseCurrency ? `${baseCurrency.name} · ${baseCurrency.symbol}` : "Sin nombre en el catálogo"}
          </p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => setBaseDraft({ code: base, locale: config.settings.locale })}
          >
            Cambiar moneda base
          </Button>
        </Card>

        <Card className="space-y-2">
          <p className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">Formato regional</p>
          <p className="font-mono text-st-h2 tabular-nums text-ink">{config.settings.locale}</p>
          <p className="text-st-caption text-ink-muted">
            Cambia cómo se ve la plata, no su valor: ningún monto guardado se altera.
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

      <Card className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-st-h2 text-ink">Monedas y tasas</h2>
          <Button
            type="button"
            className="min-h-11"
            onClick={() =>
              setCurrencyDraft({ code: "", name: "", symbol: "", decimals: 2, isActive: true, existing: false })
            }
          >
            + Agregar moneda
          </Button>
        </div>

        <p className="text-st-body text-ink-secondary">
          El catálogo conocido es conveniencia, no una restricción. Una moneda personalizada puede usar un
          código interno. Guardar una tasa nueva crea historia: no reescribe cobros anteriores.
        </p>

        {config.settings.currencies.length === 0 ? (
          <AdminEmptyState
            title="Todavía no hay monedas cargadas"
            description="Sin monedas, el sistema no sabe en qué cobrar."
          />
        ) : (
          <ul className="space-y-2">
            {config.settings.currencies.map((currency) => {
              const rate = config.settings.activeRates.find(
                (candidate) => candidate.fromCurrencyCode === currency.code,
              );

              return (
                <li
                  key={currency.code}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-stitch-md border border-line-subtle p-3"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-st-body font-semibold text-ink">
                      <span className="font-mono tabular-nums">{currency.code}</span>
                      {currency.code === base ? " · moneda base" : ""}
                    </p>
                    <p className="text-st-caption text-ink-muted">
                      {currency.name} · {currency.symbol} · {currency.decimals} decimales
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-st-body tabular-nums text-ink-secondary">
                      {currency.code === base ? "—" : rate ? rate.rate.toFixed(4) : "sin tasa"}
                    </span>
                    <Badge variant={currency.isActive ? "success" : "secondary"}>
                      {currency.isActive ? "Activa" : "Apagada"}
                    </Badge>

                    {currency.code !== base ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        onClick={() => setRateDraft({ fromCurrencyCode: currency.code, rate: "" })}
                      >
                        Guardar tasa
                      </Button>
                    ) : null}

                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
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
                      Editar
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-st-caption text-ink-muted">
          Historia protegida. Los movimientos anteriores conservan moneda, tasa y equivalente con los que
          fueron registrados.
        </p>
      </Card>

      <Modal
        open={currencyDraft !== null}
        title={currencyDraft?.existing ? "Editar moneda" : "Agregar moneda"}
        onClose={() => setCurrencyDraft(null)}
      >
        {currencyDraft ? (
          <div className="space-y-3">
            {!currencyDraft.existing ? (
              <Select
                label="Moneda conocida"
                value=""
                placeholder="Buscar conocida…"
                options={config.knownCurrencies.map((currency) => ({
                  value: currency.code,
                  label: `${currency.code} — ${currency.name}`,
                }))}
                onChange={(event) =>
                  applyKnownCurrency(event.target.value, config, setCurrencyDraft)
                }
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
                  ).then(() => setCurrencyDraft(null))
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
                  ).then(() => setRateDraft(null))
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

      <Modal
        open={baseDraft !== null}
        title="Cambiar moneda base"
        onClose={() => setBaseDraft(null)}
      >
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
              onChange={(event) => setBaseDraft({ ...baseDraft, code: event.target.value })}
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
                  ).then(() => setBaseDraft(null))
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
                  ).then(() => setLocaleDraft(null))
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

/** Completar el formulario desde el catálogo conocido: es conveniencia, no una restricción (`D-019`). */
function applyKnownCurrency(
  code: string,
  config: FinanceConfig,
  setDraft: (draft: {
    code: string;
    name: string;
    symbol: string;
    decimals: number;
    isActive: boolean;
    existing: boolean;
  }) => void,
) {
  const known = config.knownCurrencies.find((currency) => currency.code === code);

  setDraft({
    code: known?.code ?? code,
    name: known?.name ?? "",
    symbol: known?.symbol ?? "",
    decimals: known?.decimals ?? 2,
    isActive: true,
    existing: false,
  });
}
