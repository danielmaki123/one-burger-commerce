"use client";

import * as React from "react";

import { posDraftTotals } from "@/modules/pos/domain/pos-draft";
import {
  MAX_POS_HELDS,
  posHoldTitle,
  posHoldUnits,
  type PosHeldSale,
} from "@/modules/pos/domain/pos-holds";
import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { formatRelativeTime } from "@/shared/lib/relative-time";
import { Button } from "@/shared/ui/button";
import { Modal } from "@/shared/ui/modal";

/**
 * Tareas 9.4 y 9.5 del roadmap del POS (Fase 2) — **«En espera»** en la venta rápida.
 *
 * El mostrador atiende de a uno y el cliente no siempre está listo: cuando se va a buscar la billetera o
 * vuelve en diez minutos, el cajero **no puede** dejar la pantalla ocupada. Acá se deja la venta a un lado y
 * se la retoma completa (el trabajo de guardar y leer vive en `use-pos-holds` y en el dominio).
 *
 * **Qué cambió en la Fase 1**: el bloque permanente se fue. Sin nada que revisar, «En espera» no ocupa la
 * venta; con algo, la capa se abre desde su disparador. El contenido (guardar, retomar, descartar) es el
 * mismo de siempre.
 *
 * Tres decisiones que no son obvias:
 *
 * 1. **Una cosa por vez.** Con una venta armada no se puede retomar otra (se perdería la que está en
 *    curso): el botón queda bloqueado y se dice por qué. El camino es el real —cobrar o dejar en espera—.
 * 2. **Descartar pregunta.** Es lo único que no se deshace: se pierde la venta de un cliente que está ahí
 *    parado. Se confirma en el `Modal` del sistema, no con un click accidental.
 * 3. **Guardar sigue estando a un toque** dentro de la capa: dejar la venta en espera es una acción del
 *    momento, no algo que se descubra abriendo un menú.
 */

type PosHoldsPanelProps = {
  /** El local cuyas esperas se muestran: el total de cada una se calcula con el mismo local. */
  locationId: string;
  holds: PosHeldSale[];
  /** `true` cuando ya no entra otra espera (el tope vive en el dominio, `MAX_POS_HELDS`). */
  full: boolean;
  /** La venta en curso tiene productos: se puede dejar en espera (y no se puede retomar otra). */
  saleInProgress: boolean;
  currency: CurrencyFormat;
  onHold: () => void;
  onResume: (hold: PosHeldSale) => void;
  onDiscard: (hold: PosHeldSale) => void;
};

export default function PosHoldsPanel({
  locationId,
  holds,
  full,
  saleInProgress,
  currency,
  onHold,
  onResume,
  onDiscard,
}: PosHoldsPanelProps) {
  const [discarding, setDiscarding] = React.useState<PosHeldSale | null>(null);
  // El «hace 2 h» se calcula al dibujar: el POS se refresca solo cada pocos segundos, así que no hace
  // falta un reloj propio que además habría que apagar al salir de la pantalla.
  const nowIso = new Date().toISOString();
  const canResume = !saleInProgress;

  return (
    <section className="space-y-2" aria-label="Ventas en espera">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-st-body text-ink-secondary">
          {holds.length === 0
            ? "No hay ventas en espera."
            : `${holds.length} ${holds.length === 1 ? "venta esperando" : "ventas esperando"}.`}
        </p>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!saleInProgress || full}
          onClick={onHold}
        >
          Guardar en espera
        </Button>
      </div>

      {full ? (
        <p className="text-st-body font-medium text-status-sla-text">
          {`Ya hay ${MAX_POS_HELDS} ventas en espera. Retomá o descartá una para dejar otra.`}
        </p>
      ) : saleInProgress ? null : (
        <p className="text-st-body text-ink-secondary">
          Agregá productos para dejar la venta en espera.
        </p>
      )}

      {holds.length > 0 ? (
        <ul className="space-y-2" aria-label="Ventas en espera">
          {holds.map((hold) => {
            const title = posHoldTitle(hold);
            const units = posHoldUnits(hold);
            const relative = hold.savedAt === "" ? "" : formatRelativeTime(hold.savedAt, nowIso);
            const total = posDraftTotals({ locationId, lines: hold.lines }).total;

            return (
              <li key={hold.id} className="space-y-2 rounded-stitch-md border border-line-subtle p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-st-body font-semibold text-ink">{title}</p>
                  <p className="font-mono text-st-body font-bold tabular-nums text-ink">
                    {formatCurrency(total, currency)}
                  </p>
                </div>

                <p className="text-st-caption text-ink-secondary">
                  {`${units} ${units === 1 ? "producto" : "productos"}${
                    relative === "" ? "" : ` · ${relative}`
                  }`}
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-11"
                    disabled={!canResume}
                    aria-label={`Retomar la venta de ${title}`}
                    onClick={() => onResume(hold)}
                  >
                    Retomar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11"
                    aria-label={`Descartar la venta de ${title}`}
                    onClick={() => setDiscarding(hold)}
                  >
                    Descartar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {saleInProgress && holds.length > 0 ? (
        <p className="text-st-body text-ink-secondary">
          Para retomar otra venta, cobrá o dejá en espera la que está en curso.
        </p>
      ) : null}

      <Modal
        open={discarding !== null}
        onClose={() => setDiscarding(null)}
        title="Descartar la venta en espera"
        size="sm"
      >
        <p className="text-st-body text-ink-secondary">
          Se pierde la venta de {discarding ? posHoldTitle(discarding) : ""} sin cobrar, y no se puede
          deshacer.
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" className="min-h-11" onClick={() => setDiscarding(null)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            className="min-h-11"
            onClick={() => {
              if (discarding) onDiscard(discarding);
              setDiscarding(null);
            }}
          >
            Sí, descartar
          </Button>
        </div>
      </Modal>
    </section>
  );
}
