"use client";

import * as React from "react";

import type { PosHeldSale } from "@/modules/pos/domain/pos-holds";
import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";

import PosCouponPanel from "../pos-coupon-panel";
import PosDiscountPanel, { type AppliedManualDiscount } from "../pos-discount-panel";
import { PosOptionsDisclosure } from "./pos-disclosure";
import PosHoldsPanel from "./pos-holds";

/**
 * Las **opciones secundarias** de la venta: promo, descuento manual, dividir el pago y ventas en espera.
 *
 * Es la pieza que implementa la ley de progressive disclosure (`CONTENT.md` §9) en el POS: nada de esto
 * ocupa una venta normal —el cajero que solo cobra no los ve— y cada cosa se pide cuando hace falta.
 *
 * Cuatro decisiones:
 *
 * 1. **Lo aplicado se ve sin abrir nada.** Si la venta lleva promo o descuento, el resumen queda a la vista
 *    con su monto y su botón de quitar: un descuento escondido detrás de un disclosure es un descuento que
 *    el cajero no sabe que está dando.
 * 2. **El aviso de la cotización vencida y el error del código salen afuera del disclosure.** Si la venta
 *    cambió, el cajero tiene que enterarse aunque no tenga el panel abierto.
 * 3. **El descuento manual solo existe para quien puede darlo** (`canDiscountPosSale`: owner y manager). El
 *    cajero no lo ve y la ruta además lo rechaza: acá no es una frontera de autorización, es no mostrar lo
 *    que no se puede usar.
 * 4. **Cada capa conserva su estado** (`PosOptionsDisclosure` no desmonta): el código a medio escribir y la
 *    confirmación de descarte no se pierden por cerrar el panel.
 */
export function PosSaleOptions({
  currency,
  saleSubtotal,
  couponApplied,
  couponStale,
  couponBusy,
  couponError,
  onApplyCoupon,
  onRemoveCoupon,
  canDiscount,
  manualDiscount,
  onChangeManualDiscount,
  holdsCount,
  holds,
  holdsFull,
  saleInProgress,
  locationId,
  onHold,
  onResume,
  onDiscard,
}: {
  currency: CurrencyFormat;
  /** El subtotal de la venta: base del descuento manual (lo resuelve el dominio). */
  saleSubtotal: number;
  couponApplied: { code: string; label: string; discount: number } | null;
  couponStale: boolean;
  couponBusy: boolean;
  couponError: string | null;
  onApplyCoupon: (code: string) => void;
  onRemoveCoupon: () => void;
  canDiscount: boolean;
  manualDiscount: AppliedManualDiscount | null;
  onChangeManualDiscount: (discount: AppliedManualDiscount | null) => void;
  holdsCount: number;
  holds: PosHeldSale[];
  holdsFull: boolean;
  saleInProgress: boolean;
  locationId: string;
  onHold: () => void;
  onResume: (hold: PosHeldSale) => void;
  onDiscard: (hold: PosHeldSale) => void;
}) {
  const [promoOpen, setPromoOpen] = React.useState(false);
  const [discountOpen, setDiscountOpen] = React.useState(false);
  const [holdsOpen, setHoldsOpen] = React.useState(false);

  return (
    <div className="space-y-1">
      <PosOptionsDisclosure label="Aplicar promo" open={promoOpen} onToggle={() => setPromoOpen((v) => !v)}>
        <PosCouponPanel
          applied={couponApplied}
          stale={false}
          busy={couponBusy}
          error={null}
          currency={currency}
          onApply={onApplyCoupon}
          onRemove={onRemoveCoupon}
        />
      </PosOptionsDisclosure>

      <PosOptionsDisclosure
        label="Aplicar descuento"
        open={discountOpen}
        onToggle={() => setDiscountOpen((v) => !v)}
      >
        {canDiscount ? (
          <PosDiscountPanel
            subtotal={saleSubtotal}
            currency={currency}
            applied={manualDiscount}
            onChange={onChangeManualDiscount}
          />
        ) : (
          <p className="text-st-body text-ink-secondary">
            Un descuento manual lo autoriza el dueño o el encargado.
          </p>
        )}
      </PosOptionsDisclosure>

      <PosOptionsDisclosure
        label={`En espera (${holdsCount})`}
        open={holdsOpen}
        onToggle={() => setHoldsOpen((v) => !v)}
      >
        <PosHoldsPanel
          locationId={locationId}
          holds={holds}
          full={holdsFull}
          saleInProgress={saleInProgress}
          currency={currency}
          onHold={onHold}
          onResume={onResume}
          onDiscard={onDiscard}
        />
      </PosOptionsDisclosure>

      {/*
        El aviso y el error del cupón viven afuera del disclosure: la cotización vencida y el código que no
        existe tienen que verse sin abrir el panel (el descuento ya no vale y el cajero tiene que saberlo).
      */}
      {couponStale ? (
        <p className="text-st-body text-ink-secondary">
          La venta cambió: volvé a aplicar el código para recalcular el descuento.
        </p>
      ) : null}
      {couponError ? (
        <p role="alert" className="text-st-body font-medium text-status-sla-text">
          {couponError}
        </p>
      ) : null}

      {/*
        Lo aplicado, siempre a la vista: el cajero tiene que saber que esta venta lleva promo o descuento
        aunque los paneles estén cerrados.
      */}
      {couponApplied ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-stitch-md border border-line-subtle px-3 py-2">
          <p className="min-w-0 text-st-body text-ink">
            {`Promo ${couponApplied.code}`}
            <span className="block text-st-caption text-ink-secondary">{couponApplied.label}</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="font-mono text-st-body font-bold tabular-nums text-brand-primary">
              {`−${formatCurrency(couponApplied.discount, currency)}`}
            </span>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              aria-label={`Quitar promo ${couponApplied.code}`}
              onClick={onRemoveCoupon}
            >
              Quitar
            </Button>
          </p>
        </div>
      ) : null}

      {manualDiscount ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-stitch-md border border-line-subtle px-3 py-2">
          <p className="min-w-0 text-st-body text-ink">
            {manualDiscount.kind === "percentage"
              ? `Descuento manual · ${manualDiscount.value} %`
              : `Descuento manual · ${formatCurrency(manualDiscount.amount, currency)}`}
            <span className="block text-st-caption text-ink-secondary">{manualDiscount.reason}</span>
          </p>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            aria-label="Quitar descuento manual"
            onClick={() => onChangeManualDiscount(null)}
          >
            Quitar
          </Button>
        </div>
      ) : null}
    </div>
  );
}
