"use client";

import type { CurrencyFormat } from "@/shared/lib/format-currency";
import { formatCurrency } from "@/shared/lib/format-currency";
import { useOnlineStatus } from "@/shared/lib/online-status";
import { Button } from "@/shared/ui/button";

/**
 * Bloque 12.3/12.4 del roadmap del POS (Fase 2) — cobrar, con lo que hace falta para cobrar.
 *
 * Tres cosas viven juntas porque son la misma decisión (¿se puede cobrar ahora?): que haya caja abierta,
 * que haya **red** y que la venta en curso esté a la vista. Sin red el botón se bloquea con el motivo
 * escrito —el POS cobra contra el servidor: un cobro que no se registra es un pedido perdido— y la venta
 * armada queda guardada en el dispositivo (Bloque 12.3) para retomarla al volver la conexión.
 *
 * Vive en su propio archivo porque el `pos-client.tsx` es deuda con techo congelado: no puede crecer.
 *
 * **Mejoras visuales (2026-09-19)**: la caja cerrada (y el bloqueo por una caja de otro día) pasan de ser
 * una línea más a una **tarjeta de alerta con borde ámbar**, que es lo primero que el cajero ve cuando
 * toca «Cobrar» y no puede. El ámbar acá es el del sistema (`--brand-amber`), no un color suelto.
 */
export default function PosChargePanel({
  canCharge,
  blockedReason = null,
  total,
  currency,
  charging,
  saleError,
  restoredSale,
  onCharge,
}: {
  /**
   * Hay caja abierta y el turno permite cobrar. El **motivo** de que no se pueda (sin caja, o caja de otro
   * día) lo explica `PosCashAction`, en el mismo bloque del checkout: acá no se repite el diagnóstico.
   */
  canCharge: boolean;
  /**
   * Tarea 3 del brief (2026-09-17) — por qué **no** se puede cobrar aunque haya caja: hoy, la sucursal
   * exige cerrar la caja todos los días y la caja quedó abierta de otro día. El motivo lo arma la regla
   * pura (`shift-close-policy.ts`), no la pantalla.
   */
  blockedReason?: string | null;
  total: number;
  currency: CurrencyFormat;
  charging: boolean;
  saleError: string | null;
  /** La venta que se ve se recuperó del dispositivo después de una recarga. */
  restoredSale: boolean;
  onCharge: () => void;
}) {
  const online = useOnlineStatus();

  return (
    <>
      {/*
        Bloque 12.4: sin red el cobro no se registra. Se dice antes de que el cajero cobre, no después:
        el aviso usa el estado de alerta del sistema (y es el único caso, con el SLA vencido, donde el
        sistema permite animar).
      */}
      {!online ? (
        <p
          role="alert"
          className="animate-pulse rounded-stitch-lg border border-status-sla-border bg-status-sla-bg px-3 py-2 text-st-body font-semibold text-status-sla-text"
        >
          Sin conexión: el cobro no se va a registrar. La venta en curso queda guardada en este
          dispositivo; recuperá la red y volvé a cobrar.
        </p>
      ) : null}

      {restoredSale ? (
        <p
          role="status"
          className="rounded-stitch-lg border border-line-subtle bg-surface-elevated px-3 py-2 text-st-body text-ink-secondary"
        >
          Recuperamos la venta que estaba en curso. Revisá los productos antes de cobrar.
        </p>
      ) : null}

      <Button
        type="button"
        className="min-h-12 w-full"
        disabled={charging || !canCharge || !online || Boolean(blockedReason)}
        onClick={onCharge}
      >
        {charging ? (
          "Cobrando…"
        ) : (
          <>
            Cobrar <span className="font-mono">{formatCurrency(total, currency)}</span>
          </>
        )}
      </Button>

      {saleError ? (
        <p role="alert" className="text-st-body font-medium text-status-sla-text">
          {saleError}
        </p>
      ) : null}
    </>
  );
}
