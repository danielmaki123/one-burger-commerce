"use client";

import * as React from "react";

import type { CashCountConfig } from "@/modules/cash-config/domain/cash-config.types";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import { convertToBusinessCurrency } from "@/shared/lib/money-conversion";
import { roundCurrency } from "@/shared/lib/order-totals";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { Select } from "@/shared/ui/select";

import { CashCountGrid, toCashCountRows, type CashCountValues } from "../pos/cash-count-grid";
import type { BankCloseDraft, CashCountRow } from "./use-cash-shift";

/**
 * Fase 3 del rediseño de Caja (2026-09-23) — el **modal del cierre**: el conteo del cajón y el cuadre por
 * banco, con el consolidado y la diferencia.
 *
 * Tres cosas que decide esta pantalla:
 *
 * - **Una fila por banco y moneda**: el mismo banco puede liquidar córdobas y dólares, y el servidor
 *   rechaza dos filas iguales (el índice único de la base). El monto viaja **como fila**, no como total:
 *   el servidor es el que suma y el que compara contra lo que cobró.
 * - **Lo cobrado sale del corte X del local** (`/api/admin/pos/shift/x`), la misma cuenta que el cierre: la
 *   diferencia que se ve acá es la que se va a firmar. Sin esa lectura (falla de red) el cierre sigue
 *   disponible y el modal dice que no pudo comparar.
 * - **La diferencia no bloquea**: cerrar con el lote torcido es posible a propósito. Lo que la hace
 *   visible es el aviso al dueño (el mensaje del cierre), no un botón deshabilitado que deja la caja
 *   abierta toda la noche.
 * - **El arqueo ciego manda**: quien no audita declara su lote pero no ve lo cobrado ni la diferencia.
 */
export default function CashCloseModal({
  open,
  locationId,
  countConfig,
  banks,
  canSeeDifference,
  busy,
  onCancel,
  onClose,
}: {
  open: boolean;
  locationId: string;
  countConfig: CashCountConfig;
  /** Los bancos que liquida esta sucursal (`LocationBank` activos). */
  banks: { id: string; name: string; code: string | null }[];
  /** `false` = arqueo ciego: no se muestra lo cobrado ni la diferencia. */
  canSeeDifference: boolean;
  busy: boolean;
  onCancel: () => void;
  onClose: (counts: CashCountRow[], bankCloses: BankCloseDraft[]) => void;
}) {
  const currencyFormat = useCurrencyFormat();
  const settings = useBusinessSettings();
  const [countValues, setCountValues] = React.useState<CashCountValues>({});
  const [rows, setRows] = React.useState<BankCloseDraft[]>([]);
  const [charged, setCharged] = React.useState<Record<string, number> | null>(null);
  const [readError, setReadError] = React.useState<string | null>(null);

  const baseCurrency = countConfig.currencies[0] ?? settings.currencyCode;

  React.useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setReadError(null);
    setCharged(null);

    void (async () => {
      try {
        const response = await fetch(
          `/api/admin/pos/shift/x?locationId=${encodeURIComponent(locationId)}`,
          { cache: "no-store" },
        );
        const body = (await response.json().catch(() => ({}))) as {
          data?: { nonCashByCurrency?: Record<string, number> } | null;
        };

        if (cancelled) return;

        if (!response.ok || !body.data) {
          setReadError("No se pudo leer lo cobrado en el turno; el cuadre se compara al cerrar.");
          return;
        }

        setCharged(body.data.nonCashByCurrency ?? {});
      } catch {
        if (!cancelled) {
          setReadError("No se pudo leer lo cobrado en el turno; el cuadre se compara al cerrar.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, locationId]);

  // Una fila por banco al abrir: el cierre arranca con todos los bancos de la sucursal ofrecidos.
  React.useEffect(() => {
    if (!open) {
      setRows([]);
      setCountValues({});
      return;
    }

    setRows(
      banks.map((bank) => ({
        key: bank.id,
        bankId: bank.id,
        currency: baseCurrency,
        declaredAmount: "",
        lote: "",
        terminalLabel: "",
        notes: "",
      })),
    );
  }, [open, banks, baseCurrency]);

  const declaredByCurrency = React.useMemo(() => totalsByCurrency(rows), [rows]);

  const differenceByCurrency = React.useMemo(() => {
    if (!charged) return null;

    const currencies = new Set([...Object.keys(declaredByCurrency), ...Object.keys(charged)]);
    const difference: Record<string, number> = {};

    for (const currency of currencies) {
      difference[currency] = roundCurrency(
        (declaredByCurrency[currency] ?? 0) - (charged[currency] ?? 0),
      );
    }

    return difference;
  }, [declaredByCurrency, charged]);

  const differenceInBusinessCurrency = React.useMemo(() => {
    if (!differenceByCurrency) return null;

    return roundCurrency(
      Object.entries(differenceByCurrency).reduce((sum, [code, amount]) => {
        const converted = convertToBusinessCurrency({
          amount,
          currency: code,
          businessCurrencyCode: settings.currencyCode,
          usdExchangeRate: settings.usdExchangeRate,
        });

        // Una moneda sin tasa no se inventa acá: el servidor rechaza el cierre y el modal dice que no
        // pudo comparar.
        return converted.ok ? sum + converted.amount : sum;
      }, 0),
    );
  }, [differenceByCurrency, settings.currencyCode, settings.usdExchangeRate]);

  function patchRow(key: string, patch: Partial<BankCloseDraft>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    const used = new Set(rows.map((row) => row.bankId));
    const free = banks.find((bank) => !used.has(bank.id));

    setRows((current) => [
      ...current,
      {
        // Un banco sin fila todavía: si ya están todos, la fila nueva repite el primero y el servidor la
        // rechaza por duplicada (con su mensaje, que es el que explica qué pasó).
        key: free?.id ?? `${banks[0]?.id ?? "bank"}-${current.length}`,
        bankId: free?.id ?? banks[0]?.id ?? "",
        currency: baseCurrency,
        declaredAmount: "",
        lote: "",
        terminalLabel: "",
        notes: "",
      },
    ]);
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  const bankName = (bankId: string) => banks.find((bank) => bank.id === bankId)?.name ?? bankId;

  return (
    <Modal open={open} onClose={onCancel} title="Cerrar caja">
      <div className="space-y-4">
        <p className="text-st-body text-ink-secondary">
          Contá lo que hay en la caja y, si el local liquida con banco, anotá el monto y el lote que
          reportó cada terminal.
        </p>

        <CashCountGrid
          currencies={countConfig.currencies}
          denominations={countConfig.denominations}
          values={countValues}
          onChange={(key, quantity) =>
            setCountValues((current) => ({ ...current, [key]: quantity }))
          }
          disabled={busy}
          formatAmount={(value) => formatCurrency(value, currencyFormat)}
        />

        <section aria-label="Cuadre por banco" className="space-y-3">
          <h3 className="text-st-h3 text-ink">Cuadre por banco</h3>

          {banks.length === 0 ? (
            <p className="text-st-body text-ink-secondary">
              Este local no tiene bancos asignados: la caja se cierra solo con el conteo. Se asignan en
              Config de Caja → Bancos.
            </p>
          ) : null}

          <ul className="space-y-3">
            {rows.map((row) => (
              <li
                key={row.key}
                className="space-y-2 rounded-stitch-md border border-line-subtle p-3"
              >
                <div className="flex flex-wrap items-end gap-2">
                  <Input
                    label={`Monto declarado de ${bankName(row.bankId)}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={row.declaredAmount}
                    onChange={(event) => patchRow(row.key, { declaredAmount: event.target.value })}
                    className="sm:max-w-[10rem]"
                  />

                  <Select
                    label={`Moneda de ${bankName(row.bankId)}`}
                    value={row.currency}
                    onChange={(event) => patchRow(row.key, { currency: event.target.value })}
                    options={countConfig.currencies.map((code) => ({ value: code, label: code }))}
                    className="sm:max-w-[8rem]"
                  />

                  <Input
                    label={`Lote de ${bankName(row.bankId)}`}
                    value={row.lote}
                    onChange={(event) => patchRow(row.key, { lote: event.target.value })}
                    className="sm:max-w-[10rem]"
                  />

                  <Input
                    label={`Terminal de ${bankName(row.bankId)}`}
                    value={row.terminalLabel}
                    onChange={(event) => patchRow(row.key, { terminalLabel: event.target.value })}
                    className="sm:max-w-[10rem]"
                  />
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <Input
                    label={`Notas de ${bankName(row.bankId)}`}
                    value={row.notes}
                    onChange={(event) => patchRow(row.key, { notes: event.target.value })}
                    className="sm:max-w-[20rem]"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => removeRow(row.key)}
                  >
                    Quitar fila
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          {banks.length > 0 ? (
            <Button type="button" variant="outline" className="min-h-11" onClick={addRow}>
              Agregar banco
            </Button>
          ) : null}
        </section>

        {canSeeDifference ? (
          <section
            aria-label="Consolidado del cuadre"
            className="space-y-1 rounded-stitch-md bg-surface-raised p-3"
          >
            <h3 className="text-st-h3 text-ink">Consolidado</h3>
            <p className="text-st-body text-ink-secondary">
              Declarado:{" "}
              <span className="font-mono tabular-nums text-ink">
                {formatByList(declaredByCurrency, settings.currencyCode, currencyFormat)}
              </span>
            </p>

            {readError ? (
              <p role="status" className="text-st-caption text-ink-muted">
                {readError}
              </p>
            ) : (
              <>
                <p className="text-st-body text-ink-secondary">
                  Cobrado sin pasar por el cajón:{" "}
                  <span className="font-mono tabular-nums text-ink">
                    {formatByList(charged ?? {}, settings.currencyCode, currencyFormat)}
                  </span>
                </p>
                <p className="text-st-body font-semibold text-ink">
                  Diferencia del cuadre:{" "}
                  <span className="font-mono tabular-nums">
                    {differenceInBusinessCurrency === null
                      ? "—"
                      : signedCurrency(differenceInBusinessCurrency, currencyFormat)}
                  </span>
                </p>
                <p className="text-st-caption text-ink-muted">
                  El cierre no se bloquea por la diferencia: queda asentada en el turno y se avisa al
                  dueño en el mensaje del cierre.
                </p>
              </>
            )}
          </section>
        ) : (
          <p className="text-st-body text-ink-secondary">
            Con el arqueo ciego no ves lo cobrado ni la diferencia: queda asentada y se le avisa al
            dueño al cerrar.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="min-h-11"
            disabled={busy}
            onClick={() =>
              onClose(
                toCashCountRows(countValues, countConfig.currencies, countConfig.denominations),
                rows.filter(isDeclared),
              )
            }
          >
            {busy ? "Guardando…" : "Cerrar caja"}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy}
            onClick={onCancel}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Lo declarado por moneda, sumando solo las filas con monto (una fila vacía no es un cuadre de cero). */
function totalsByCurrency(rows: readonly BankCloseDraft[]): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const row of rows) {
    const amount = Number(row.declaredAmount);

    if (!Number.isFinite(amount) || amount === 0) continue;

    const code = row.currency.trim().toUpperCase();
    totals[code] = roundCurrency((totals[code] ?? 0) + amount);
  }

  return totals;
}

/** Una fila entra al payload si tiene monto o si trae el lote/terminal (el servidor descarta las vacías). */
function isDeclared(row: BankCloseDraft): boolean {
  return (
    Number(row.declaredAmount) > 0 ||
    row.lote.trim().length > 0 ||
    row.terminalLabel.trim().length > 0 ||
    row.notes.trim().length > 0
  );
}

/** `C$550.00 · USD 20.00`, en la moneda de cada monto (el símbolo local en dólares sería un número falso). */
function formatByList(
  totals: Record<string, number>,
  businessCurrencyCode: string,
  format: { symbol: string; locale: string },
): string {
  const entries = Object.entries(totals).filter(([, amount]) => amount !== 0);

  if (entries.length === 0) return "—";

  return entries
    .map(([code, amount]) =>
      code.toUpperCase() === businessCurrencyCode.toUpperCase()
        ? formatCurrency(amount, format)
        : formatCurrency(amount, { symbol: `${code.toUpperCase()} `, locale: format.locale }),
    )
    .join(" · ");
}

function signedCurrency(amount: number, format: { symbol: string; locale: string }): string {
  if (amount === 0) return `${formatCurrency(0, format)} (cuadra)`;

  return `${amount > 0 ? "+" : "-"}${formatCurrency(Math.abs(amount), format)}`;
}
