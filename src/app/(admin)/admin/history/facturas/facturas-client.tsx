"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Ban, Printer, RefreshCw } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { Select } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import { formatTimeInTimeZone } from "@/modules/business-settings/domain/format-time-in-timezone";
import {
  INVOICE_VOID_NOTE_MAX_LENGTH,
  INVOICE_VOID_REASONS,
  describeInvoiceVoidReason,
} from "@/modules/invoices/domain/invoice-void";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminStatusPill,
} from "../../_components/admin-operational-ui";
import { businessDate, businessDayRange } from "../../orders/orders-page-helpers";
import { HistoryTabs } from "../history-tabs";

/**
 * Punto 2 del roadmap (2026-09-18) — **Historial › Facturas**.
 *
 * Las facturas simples emitidas, de consulta: ver el documento, reimprimirlo y —solo el dueño— anularlo.
 * Anular **no borra**: la factura queda marcada con cuándo, quién y por qué, y el motivo se elige de la
 * lista cerrada del dominio (con «Otro» pidiendo el texto). La pantalla no decide nada de eso: manda el
 * motivo y muestra lo que responde el servidor.
 */

type InvoiceRow = {
  id: string;
  number: string;
  orderId: string;
  status: "emitted" | "voided";
  customerName: string;
  branchName: string | null;
  total: number;
  issuedAt: string;
  voidReason: string | null;
};

const ALL = "all";

const LINK_BUTTON_CLASS =
  "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-stitch-md border border-line-subtle bg-surface-card px-3 text-st-body font-semibold text-ink transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary motion-reduce:transition-none";

export function FacturasClient({ canVoid }: { canVoid: boolean }) {
  const { timezone: timeZone } = useBusinessSettings();
  const currency = useCurrencyFormat();

  const [day, setDay] = useState(() => businessDate(new Date(), timeZone));
  const [status, setStatus] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [branchName, setBranchName] = useState<string>(ALL);

  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const [voidTarget, setVoidTarget] = useState<InvoiceRow | null>(null);
  const [voidReason, setVoidReason] = useState<string>(INVOICE_VOID_REASONS[0]);
  const [voidNote, setVoidNote] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);
  const [voiding, setVoiding] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    if (day) {
      const range = businessDayRange(day, timeZone);
      if (range.from) params.set("dateFrom", range.from);
      if (range.to) params.set("dateTo", range.to);
    }

    if (status !== ALL) params.set("status", status);
    if (search.trim()) params.set("search", search.trim());

    return params.toString();
  }, [day, status, search, timeZone]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/admin/invoices?${queryString}`, { cache: "no-store" });

        if (!response.ok) {
          if (!cancelled) setError("No se pudieron cargar las facturas.");
          return;
        }

        const payload = (await response.json()) as { data?: InvoiceRow[] };
        if (!cancelled) setRows(payload.data ?? []);
      } catch {
        if (!cancelled) setError("No se pudieron cargar las facturas.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [queryString, refreshToken]);

  const branchOptions = useMemo(() => {
    const seen = new Set<string>();

    for (const row of rows) {
      if (row.branchName) seen.add(row.branchName);
    }

    return [...seen];
  }, [rows]);

  const visibleRows = useMemo(
    () => (branchName === ALL ? rows : rows.filter((row) => row.branchName === branchName)),
    [rows, branchName],
  );

  const openVoid = useCallback((row: InvoiceRow) => {
    setVoidTarget(row);
    setVoidReason(INVOICE_VOID_REASONS[0]);
    setVoidNote("");
    setVoidError(null);
  }, []);

  const closeVoid = useCallback(() => {
    setVoidTarget(null);
    setVoidError(null);
  }, []);

  async function confirmVoid() {
    if (!voidTarget) return;

    setVoiding(true);
    setVoidError(null);

    try {
      const response = await fetch(`/api/admin/invoices/${voidTarget.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: voidReason,
          ...(voidReason === "otro" ? { note: voidNote } : {}),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        data?: InvoiceRow;
        error?: { message?: string };
      };

      if (!response.ok) {
        setVoidError(payload.error?.message ?? "No se pudo anular la factura.");
        return;
      }

      const voided = payload.data;

      setRows((current) =>
        current.map((row) =>
          row.id === voidTarget.id
            ? { ...row, status: "voided", voidReason: voided?.voidReason ?? voidReason }
            : row,
        ),
      );
      setNotice(`Factura ${voidTarget.number} anulada.`);
      setVoidTarget(null);
    } catch {
      setVoidError("No se pudo anular la factura.");
    } finally {
      setVoiding(false);
    }
  }

  return (
    <div className="min-w-0 space-y-4" aria-busy={loading}>
      <AdminPageHeader
        title="Historial"
        description="Consulta de cierres de caja y facturas emitidas. Solo lectura."
      />

      <HistoryTabs />

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-h-11 items-center gap-2">
          <span className="text-st-caption font-semibold uppercase tracking-wide text-ink-secondary">
            Día
          </span>
          <Input
            type="date"
            className="h-11"
            aria-label="Día de la factura"
            value={day}
            onChange={(event) => setDay(event.target.value)}
          />
        </label>

        <label className="flex min-h-11 w-full items-center gap-2 sm:w-64">
          <span className="sr-only">Buscar factura</span>
          <Input
            type="search"
            className="h-11"
            placeholder="Número o cliente"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <div className="w-[10rem]">
          <Select
            aria-label="Estado de la factura"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={[
              { value: ALL, label: "Todas" },
              { value: "emitted", label: "Emitidas" },
              { value: "voided", label: "Anuladas" },
            ]}
          />
        </div>

        {branchOptions.length > 1 ? (
          <div className="w-[12rem]">
            <Select
              aria-label="Sucursal de la factura"
              value={branchName}
              onChange={(event) => setBranchName(event.target.value)}
              options={[
                { value: ALL, label: "Todas las sucursales" },
                ...branchOptions.map((name) => ({ value: name, label: name })),
              ]}
            />
          </div>
        ) : null}

        <Button
          variant="outline"
          className="ml-auto min-h-11 gap-2"
          onClick={() => setRefreshToken((token) => token + 1)}
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {notice ? (
        <p
          role="status"
          aria-live="polite"
          data-testid="invoices-notice"
          className="rounded-stitch-lg border border-line-subtle bg-surface-card px-4 py-3 text-st-body font-semibold text-ink"
        >
          {notice}
        </p>
      ) : null}

      {error ? (
        <div className="rounded-md border border-danger-strong/30 bg-danger p-4 text-st-body text-danger-foreground">
          {error}
        </div>
      ) : null}

      {!error && !loading && visibleRows.length === 0 ? (
        <AdminEmptyState
          title="Sin facturas en este rango"
          description="No hay facturas emitidas para los filtros seleccionados."
        />
      ) : null}

      {visibleRows.length > 0 ? (
        <ul className="min-w-0 overflow-hidden rounded-stitch-lg border border-line-subtle bg-surface-card shadow-elevation-1">
          {visibleRows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-3 border-b border-line-subtle px-4 py-3 last:border-0 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="flex flex-wrap items-center gap-2 font-mono text-st-body font-semibold tabular-nums text-ink">
                  {row.number}
                  {row.status === "voided" ? (
                    <AdminStatusPill tone="danger">
                      Anulada{row.voidReason ? ` · ${row.voidReason}` : ""}
                    </AdminStatusPill>
                  ) : (
                    <AdminStatusPill tone="success">Emitida</AdminStatusPill>
                  )}
                </p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-st-caption text-ink-secondary">
                  <span>{formatTimeInTimeZone(row.issuedAt, timeZone)}</span>
                  <span>{businessDate(new Date(row.issuedAt), timeZone)}</span>
                  <span className="font-semibold text-ink">{row.customerName}</span>
                  <span>{row.branchName ?? "Sin sucursal"}</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 md:justify-end">
                <span className="font-mono text-st-body font-semibold tabular-nums text-ink">
                  {formatCurrency(row.total, currency)}
                </span>

                <Link href={`/admin/orders/${row.orderId}`} className={LINK_BUTTON_CLASS}>
                  Ver detalle
                </Link>

                <Link
                  href={`/admin/orders/${row.orderId}/invoice/print`}
                  target="_blank"
                  className={LINK_BUTTON_CLASS}
                >
                  <Printer aria-hidden="true" className="h-4 w-4" />
                  Reimprimir
                </Link>

                {canVoid && row.status !== "voided" ? (
                  <Button
                    variant="outline"
                    className="min-h-11 gap-2"
                    onClick={() => openVoid(row)}
                  >
                    <Ban aria-hidden="true" className="h-4 w-4" />
                    Anular
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <Modal open={voidTarget !== null} onClose={closeVoid} title="Anular factura" size="sm">
        <div className="space-y-3">
          <p className="text-st-body text-ink-secondary">
            {voidTarget
              ? `La factura ${voidTarget.number} queda anulada. El documento no se borra: queda el motivo y quién lo hizo.`
              : ""}
          </p>

          <div className="space-y-1">
            <label
              htmlFor="void-reason"
              className="text-st-caption font-semibold uppercase tracking-wide text-ink-secondary"
            >
              Motivo
            </label>
            <Select
              id="void-reason"
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              options={INVOICE_VOID_REASONS.map((reason) => ({
                value: reason,
                label: describeInvoiceVoidReason(reason),
              }))}
            />
          </div>

          {voidReason === "otro" ? (
            <div className="space-y-1">
              <label
                htmlFor="void-note"
                className="text-st-caption font-semibold uppercase tracking-wide text-ink-secondary"
              >
                Contá el motivo
              </label>
              <Textarea
                id="void-note"
                value={voidNote}
                maxLength={INVOICE_VOID_NOTE_MAX_LENGTH}
                onChange={(event) => setVoidNote(event.target.value)}
              />
            </div>
          ) : null}

          {voidError ? (
            <p role="alert" className="text-st-body font-semibold text-danger-foreground">
              {voidError}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" className="min-h-11" onClick={closeVoid}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              className="min-h-11"
              disabled={voiding}
              onClick={() => void confirmVoid()}
            >
              {voiding ? "Anulando…" : "Anular factura"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
