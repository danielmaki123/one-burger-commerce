"use client";

import Link from "next/link";
import * as React from "react";

import {
  addPosLine,
  createPosDraft,
  removePosLine,
  setPosLineQuantity,
} from "@/modules/pos/domain/pos-draft";
import type { PosHeldSale } from "@/modules/pos/domain/pos-holds";
import type { PosPaymentMethod } from "@/modules/pos/domain/pos-sale";
import type { PosCatalogProduct } from "@/modules/pos/ports/pos-catalog";
import { hasSelectableModifiers } from "@/modules/menu/domain/modifier-selection";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import {
  renderReceiptJpeg,
  shareOrDownloadReceipt,
  type ReceiptData,
} from "@/shared/lib/receipt-image";
import { AdminEmptyState, AdminPageHeader } from "../_components/admin-operational-ui";
import { EMPTY_POS_FISCAL_DRAFT } from "./pos-fiscal-payload";
import PosModifierDialog, { type PosModifierSelection } from "./pos-modifier-dialog";
import PosOrderChargeAction from "./pos-order-charge-action";
import PosSaleConfirmation from "./pos-sale-confirmation";
import PosTicketButtons from "./pos-ticket-buttons";
import type { PosLocationOption, PosSaleSummary } from "./pos-types";
import { PosSaleOptions } from "./quick-sale/pos-sale-options";
import { PosWorkspace } from "./quick-sale/pos-workspace";
import { usePosCatalog } from "./quick-sale/use-pos-catalog";
import { usePosSale } from "./quick-sale/use-pos-sale";
import { usePosShift } from "./quick-sale/use-pos-shift";
import { usePosDraft } from "./use-pos-draft";
import { usePosHolds } from "./use-pos-holds";

/**
 * TASK-302 + TASK-303b — el mostrador: catálogo del local a un lado, venta al otro.
 *
 * Se pide y se paga **de una vez** (decisión del owner): el cajero arma la venta, deja el nombre y el número
 * del cliente (el correo es opcional) y cobra. El total que se muestra sale de la misma fórmula que usa el
 * servidor (`posDraftTotals`) y **el que manda es el del servidor**: si el menú cambió entre que se cargó el
 * catálogo y se cobró, la respuesta del servidor lo dice con el número de pedido en vez de guardar un cobro
 * que no alcanza.
 *
 * **Reparto de la Fase 1 (`SCREEN-POS-QUICK-SALE-001`)**: esta pantalla quedó como **orquestación** —estado
 * compartido, carga y composición—. La UI vive en `quick-sale/` (workspace, líneas, resumen, cliente, pago,
 * opciones y sheet del celular) y las tres responsabilidades con su propia API en sus hooks: catálogo
 * (`use-pos-catalog`), caja (`use-pos-shift`) y cobro (`use-pos-sale`). El archivo es deuda con techo
 * congelado y este cambio lo **baja**.
 */

export default function PosClient({
  locations,
  canDiscount = false,
  cashTerminalsByLocation = {},
}: {
  locations: PosLocationOption[];
  /**
   * Tarea 9.7 del roadmap del POS (Fase 2) — si esta sesión puede dar un **descuento manual**. Lo resuelve
   * el servidor (`canDiscountPosSale`: owner y manager) y la ruta lo vuelve a comprobar: acá solo decide si
   * el control se muestra.
   */
  canDiscount?: boolean;
  /**
   * Fase 6 del rediseño de Caja (2026-09-23) — las **terminales activas** de cada sucursal, resueltas en el
   * servidor. El POS hereda la terminal del turno abierto para firmar cada venta con su caja: con dos POS en
   * el mismo local, el turno de **esta** estación es el que recibe la plata.
   */
  cashTerminalsByLocation?: Record<string, { id: string; label: string }[]>;
}) {
  const currency = useCurrencyFormat();
  const settings = useBusinessSettings();

  const catalog = usePosCatalog({
    locations,
    cashTerminalsByLocation,
    currencyCode: settings.currencyCode,
    currency,
  });
  const { locationId, terminalId } = catalog;

  const {
    draft,
    setDraft,
    restored: draftRestored,
    attemptKey,
    renewAttemptKey,
    restoreAttemptKey,
  } = usePosDraft(locationId, settings.currencyCode);

  /**
   * Tareas 9.4 y 9.5 del roadmap del POS (Fase 2) — las ventas en espera de este dispositivo. Guardar libera
   * el mostrador cuando el cliente no está listo; retomar la trae completa. La lista vive acá y el trabajo de
   * guardar y leer, en el hook (y en el dominio).
   */
  const { holds, hold, discard, full: holdsFull } = usePosHolds(locationId, settings.currencyCode);

  const shiftState = usePosShift({
    locationId,
    terminalId,
    locations,
    timezone: settings.timezone,
  });

  const [customer, setCustomer] = React.useState<{
    name: string;
    whatsapp: string;
    email: string;
    fiscal: typeof EMPTY_POS_FISCAL_DRAFT;
  }>({
    name: "",
    whatsapp: "",
    email: "",
    // Punto 4: la factura con RUC arranca **apagada** (la mayoría de las ventas no llevan factura).
    fiscal: EMPTY_POS_FISCAL_DRAFT,
  });

  /**
   * El producto cuyo selector de modificadores está abierto, si hay alguno. La venta se arma con lo que el
   * cajero confirma en el selector: un producto con opciones no entra a la venta sin pasar por ahí.
   */
  const [modifierProduct, setModifierProduct] = React.useState<PosCatalogProduct | null>(null);
  const [receiptState, setReceiptState] = React.useState<"idle" | "busy" | "done" | "error">("idle");

  /**
   * El cobro: cupón, descuento manual, filas de pago, validación, idempotencia, totales y alta. El estado y
   * las llamadas viven en el hook (su propia responsabilidad); acá se conecta con el borrador y el cliente.
   */
  const sale = usePosSale({
    locationId,
    terminalId,
    currencyCode: settings.currencyCode,
    currency,
    fiscal: customer.fiscal,
    customer: { name: customer.name, whatsapp: customer.whatsapp, email: customer.email },
    attempt: { attemptKey, renewAttemptKey, restoreAttemptKey },
    draft,
    onSaleCharged: () => {
      setDraft(createPosDraft(locationId));
      setCustomer({ name: "", whatsapp: "", email: "", fiscal: { ...EMPTY_POS_FISCAL_DRAFT } });
    },
    onHold: ({ lines, payments, attemptKey: heldAttemptKey }) => {
      hold({
        lines,
        customer,
        // Los pagos del borrador ya son del dominio; el payload de la espera los tipa como texto.
        payments: payments.map((payment) => ({
          ...payment,
          method: payment.method as PosPaymentMethod,
        })),
        attemptKey: heldAttemptKey,
      });
      setDraft(createPosDraft(locationId));
      setCustomer({ name: "", whatsapp: "", email: "", fiscal: { ...EMPTY_POS_FISCAL_DRAFT } });
    },
  });

  const { startNewSale } = sale;
  const { refreshCatalog, refreshMs } = catalog;
  const { refreshShift } = shiftState;

  /**
   * Cambiar de local (o de moneda) empieza una venta nueva: el borrador lleva el local y sus precios y lo
   * resetea su hook; acá se limpia el cobro y se suelta la confirmación anterior.
   */
  React.useEffect(() => {
    startNewSale();
  }, [locationId, settings.currencyCode, startNewSale]);

  /**
   * TASK-306 — el POS se refresca solo: el catálogo (precios y disponibilidad pueden cambiar en el menú) y
   * la caja (otra terminal puede abrirla o cerrarla). **No toca el borrador, ni la búsqueda, ni el conteo**:
   * lo que el cajero está escribiendo queda donde está.
   */
  React.useEffect(() => {
    if (locationId === "") return;

    const timer = setInterval(() => {
      void refreshCatalog({ silent: true });
      void refreshShift();
    }, refreshMs);

    return () => clearInterval(timer);
  }, [locationId, refreshCatalog, refreshShift, refreshMs]);

  /**
   * Agregar un producto a la venta. Si tiene modificadores que preguntar, primero se eligen en el selector:
   * sin ellos el alta rechazaría la venta (y el precio de la línea saldría sin los extras).
   */
  const addProduct = (product: PosCatalogProduct) => {
    if (hasSelectableModifiers(product.modifierGroups)) {
      setModifierProduct(product);
      return;
    }

    addSaleLine(product, null);
  };

  /** La línea, con los modificadores elegidos (o sin ellos) y el precio que el selector calculó. */
  const addSaleLine = (product: PosCatalogProduct, selection: PosModifierSelection | null) => {
    setDraft((current) =>
      addPosLine(current, {
        productId: product.id,
        name: product.name,
        unitPrice: selection?.unitPrice ?? product.basePrice,
        packagingUnitAmount: product.packagingFeeAmount ?? 0,
        ...(selection
          ? {
              modifierOptionIds: selection.modifierOptionIds,
              modifierNames: selection.modifierNames,
            }
          : {}),
      }),
    );
  };

  /**
   * Las líneas de la venta se suman, se restan y se sacan con las reglas del dominio, direccionadas por la
   * **clave de la línea** (`producto + modificadores + nota`): el mismo plato con dos configuraciones
   * distintas son dos líneas y tocar una no puede cambiar la otra.
   */
  const changeLineQuantity = (lineKey: string, quantity: number) =>
    setDraft((current) => setPosLineQuantity(current, lineKey, quantity));
  const removeSaleLine = (lineKey: string) => setDraft((current) => removePosLine(current, lineKey));

  /** Tareas 9.4 y 9.5 — traer de vuelta la venta en espera, con su cliente, su cobro y su clave. */
  const resumeHeldSale = (heldSale: PosHeldSale) => {
    setDraft({ locationId, lines: heldSale.lines });
    // Punto 4: la factura que quedó a medio cargar vuelve con la venta; sin ella, arranca apagada.
    setCustomer({ ...heldSale.customer, fiscal: heldSale.customer.fiscal ?? EMPTY_POS_FISCAL_DRAFT });
    sale.setPayments(
      heldSale.payments.length === 0
        ? [{ id: "pay_1", method: "cash", currency: settings.currencyCode, amount: "" }]
        : heldSale.payments.map((payment, index) => ({ ...payment, id: `pay_${index + 1}` })),
    );
    // La espera trae el intento con el que se armó; un guardado viejo sin clave usa la que ya está (nueva).
    if (heldSale.attemptKey) restoreAttemptKey(heldSale.attemptKey);
    discard(heldSale.id);
    sale.setFieldErrors({});
  };

  /**
   * TASK-307 — arma el recibo del último cobro y lo ofrece: hoja de compartir (WhatsApp, imprimir) o
   * descarga del JPG. Sin API ni credenciales: la imagen se genera en el dispositivo.
   */
  const sendReceipt = async () => {
    const lastSale: PosSaleSummary | null = sale.lastSale;
    if (!lastSale) return;

    setReceiptState("busy");
    try {
      const data: ReceiptData = {
        businessName: settings.name,
        addressLine: settings.addressLine,
        phone: settings.phone,
        businessCurrencyCode: settings.currencyCode,
        orderNumber: lastSale.orderNumber,
        createdAtLabel: new Date().toLocaleString(settings.locale, {
          dateStyle: "short",
          timeStyle: "short",
        }),
        locationName: locations.find((location) => location.id === locationId)?.name ?? null,
        customerName: lastSale.receipt.customerName,
        lines: lastSale.receipt.lines,
        subtotal: lastSale.receipt.subtotal,
        packagingAmount: lastSale.receipt.packagingAmount,
        discount: 0,
        deliveryFeeAmount: 0,
        tipAmount: 0,
        total: lastSale.total,
        payments: lastSale.receipt.payments,
        change: lastSale.change,
      };

      const blob = await renderReceiptJpeg(data);
      await shareOrDownloadReceipt(blob, `recibo-${lastSale.orderNumber}.jpg`);
      setReceiptState("done");
    } catch {
      setReceiptState("error");
    }
  };

  if (locations.length === 0) {
    return (
      <div className="space-y-5 pb-8">
        <AdminPageHeader
          label="Caja"
          title="Punto de venta"
          description="El punto de venta necesita un local activo."
        />

        <AdminEmptyState
          title="Sin locales activos"
          description="El punto de venta necesita un local activo para saber qué precios cobrar."
        />
      </div>
    );
  }

  const contextBar = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${
          shiftState.shift ? "bg-status-ready-dot" : "bg-status-inactive-dot"
        }`}
      />
      <p className="text-st-body text-ink-secondary">
        {shiftState.shiftLoading ? (
          "Leyendo la caja…"
        ) : shiftState.shift ? (
          <>
            Caja abierta · fondo{" "}
            <span className="font-mono tabular-nums">
              {formatCurrency(shiftState.shift.openingAmount, currency)}
            </span>
          </>
        ) : (
          "Sin caja abierta en este local."
        )}
      </p>

      {/* Tarea 1 del brief (2026-09-17): la caja se abre y se cierra en «Caja», no acá. */}
      <Link
        href="/admin/cash"
        className="inline-flex min-h-11 items-center text-st-body font-semibold text-brand-primary underline"
      >
        {shiftState.shift ? "Ver la caja" : "Abrir la caja"}
      </Link>

      {/*
        Hallazgo N3 de la auditoría post-deploy (2026-09-23) — el pedido del menú que se paga al retirar: en
        esta fase deja de ser una tarjeta permanente y queda como **acción secundaria compacta**. Su rediseño
        funcional pertenece a la Fase 2.
      */}
      <PosOrderChargeAction
        currencies={[settings.currencyCode, "USD"]}
        currency={currency}
        terminalId={terminalId}
      />
    </div>
  );

  const confirmation = sale.lastSale ? (
    <PosSaleConfirmation
      sale={sale.lastSale}
      currency={currency}
      receiptState={receiptState}
      onSendReceipt={() => void sendReceipt()}
      tickets={<PosTicketButtons sale={sale.lastSale} />}
    />
  ) : null;

  const options = (
    <PosSaleOptions
      currency={currency}
      saleSubtotal={sale.totals.subtotal}
      couponApplied={
        sale.coupon === null
          ? null
          : {
              code: sale.coupon.code,
              label: sale.coupon.label,
              discount: sale.coupon.discount,
            }
      }
      couponStale={sale.couponStale}
      couponBusy={sale.couponBusy}
      couponError={sale.couponError}
      onApplyCoupon={(code) => void sale.applyCoupon(code)}
      onRemoveCoupon={sale.removeCoupon}
      canDiscount={canDiscount}
      manualDiscount={sale.manualDiscount}
      onChangeManualDiscount={sale.setManualDiscount}
      holdsCount={holds.length}
      holds={holds}
      holdsFull={holdsFull}
      saleInProgress={draft.lines.length > 0}
      locationId={locationId}
      onHold={sale.hold}
      onResume={resumeHeldSale}
      onDiscard={(heldSale) => discard(heldSale.id)}
    />
  );

  return (
    <div className="space-y-5 pb-8">
      <AdminPageHeader
        label="Caja"
        title="Punto de venta"
        description="Armá la venta del mostrador con el catálogo del local."
      />

      <PosWorkspace
        contextBar={contextBar}
        catalog={{
          locationId,
          locations,
          onLocationChange: catalog.setLocationId,
          terminals: catalog.terminals,
          terminalId,
          onTerminalChange: catalog.setTerminalId,
          products: catalog.products,
          categories: catalog.categories,
          query: catalog.query,
          onQueryChange: catalog.setQuery,
          activeCategoryId: catalog.activeCategoryId,
          onCategorySelect: catalog.setActiveCategoryId,
          loading: catalog.loading,
          loadError: catalog.loadError,
          onRetry: catalog.retryCatalog,
          currency,
          onAdd: addProduct,
        }}
        sale={{
          lines: draft.lines,
          changeQuantity: changeLineQuantity,
          removeLine: removeSaleLine,
          totals: sale.totals,
          appliedCoupon: sale.coupon,
          manualDiscountAmount: sale.manualDiscount?.amount ?? 0,
          currency,
          customer,
          setCustomer,
          payments: sale.payments,
          setPayments: sale.setPayments,
          fieldErrors: sale.fieldErrors,
          currencyCode: settings.currencyCode,
          usdExchangeRate: settings.usdExchangeRate,
          addPaymentRow: sale.addPaymentRow,
          removePaymentRow: sale.removePaymentRow,
          canCharge: shiftState.canCharge,
          needsOpenShift: shiftState.needsOpenShift,
          blockedReason: shiftState.blockedReason,
          total: sale.totals.total,
          charging: sale.charging,
          saleError: sale.saleError,
          restoredSale: draftRestored,
          onCharge: () => void sale.charge(),
          options,
          confirmation,
        }}
      />

      {/*
        El selector de modificadores del mostrador: se monta inline (no en un portal) para heredar el alcance
        oscuro del shell del panel. Los datos vienen del catálogo y la regla, del dominio.
      */}
      <PosModifierDialog
        product={modifierProduct}
        currency={currency}
        open={modifierProduct !== null}
        onClose={() => setModifierProduct(null)}
        onConfirm={(product, selection) => {
          addSaleLine(product, selection);
          setModifierProduct(null);
        }}
      />
    </div>
  );
}
