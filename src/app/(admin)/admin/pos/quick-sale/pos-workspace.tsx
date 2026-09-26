"use client";

import * as React from "react";
import { X } from "lucide-react";

import type { PosDraftLine } from "@/modules/pos/domain/pos-draft";
import type { PosCatalogCategoryChip, PosCatalogProduct } from "@/modules/pos/ports/pos-catalog";
import type { CurrencyFormat } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";
import { Select } from "@/shared/ui/select";

import PosCatalogGrid from "../pos-catalog-grid";
import PosChargePanel from "../pos-charge-panel";
import type { PosLocationOption, PosPaymentDraft } from "../pos-types";
import PosCustomerFields, { type PosCustomerDraft } from "./pos-customer";
import PosPaymentFields from "./pos-payment";
import PosSaleLines from "./pos-sale-lines";
import PosSaleSummary, { PosMobileSaleBar, type PosSaleTotals } from "./pos-sale-summary";
import { POS_TWO_PANE_QUERY, useMediaQuery } from "./use-media-query";

/**
 * El **workspace** de la venta rápida: `CATÁLOGO | VENTA`.
 *
 * Es la composición que reemplaza el formulario vertical largo. Tres cosas que resuelve y que no son
 * cosméticas:
 *
 * 1. **El catálogo siempre utilizable y el ticket siempre accesible.** En `lg` (≥1024 px) son dos columnas y
 *    el panel de venta es `sticky` con su propio scroll: el cajero navega el catálogo sin perder de vista ni
 *    el total ni el botón de cobrar. Abajo de `lg` la venta **no se apila debajo**: pasa a un sheet que se
 *    abre desde la barra inferior.
 * 2. **Una sola acción primaria.** `Cobrar C$…` es el único `primary` del panel de venta y vive en su pie,
 *    no al final de un scroll largo.
 * 3. **El sheet no es una trampa.** Cerrado **no hay formulario en el DOM** (los campos se desmontan) y en
 *    móvil el panel vive fuera de la pantalla: un formulario invisible que se puede tabular es una trampa de
 *    teclado. Abierto es un `<dialog open>` con su nombre accesible, recibe el foco y **Escape** lo cierra,
 *    devolviendo el foco al disparador. El corte entre columna y sheet se lee con `matchMedia`
 *    (`useMediaQuery`) porque lo que cambia no es cosmético.
 *
 * **Un solo nodo para la columna y el sheet.** La venta no se duplica en el DOM: dos formularios con los
 * mismos campos serían dos fuentes de verdad, dos juegos de `id` y un `getByLabelText` ambiguo. Lo que
 * cambia entre escritorio y celular es el layout, no el árbol.
 */

/**
 * Dónde anclar el panel de venta en escritorio, medido de la **columna** que le reserva el lugar.
 *
 * Un `<dialog open>` no se pega con `position: sticky` (medido en Chromium: se va con el scroll), así que el
 * panel se ancla con `position: fixed` y estas medidas. El ancla se recalcula al montar, cuando cambia el
 * tamaño de la ventana o de la columna (`ResizeObserver`: el catálogo cambia de alto con los filtros) y
 * cuando el panel cambia de alto (una opción secundaria abierta puede mover el ancla).
 */
function useSaleColumnAnchor(
  columnRef: React.RefObject<HTMLDivElement | null>,
  active: boolean,
  panelRef: React.RefObject<HTMLDialogElement | null>,
): { anchorTop: number | undefined; anchorRight: number | undefined; anchorWidth: number } {
  const [rect, setRect] = React.useState({ top: 0, right: 0, width: 0 });

  React.useEffect(() => {
    if (!active) return;

    const measure = () => {
      const column = columnRef.current;
      if (!column) return;

      const box = column.getBoundingClientRect();
      setRect((current) =>
        current.top === box.top && current.right === box.right && current.width === box.width
          ? current
          : { top: box.top, right: window.innerWidth - box.right, width: box.width },
      );
    };

    measure();

    window.addEventListener("resize", measure);
    // `ResizeObserver` no existe en jsdom: sin guarda, el render de los tests rompe (el navegador real
    // siempre lo tiene, así que no es una rama de producto).
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (columnRef.current) observer?.observe(columnRef.current);
    if (panelRef.current) observer?.observe(panelRef.current);

    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [active, columnRef, panelRef]);

  return {
    anchorTop: active ? Math.max(0, Math.round(rect.top)) : undefined,
    anchorRight: active ? Math.round(rect.right) : undefined,
    anchorWidth: rect.width,
  };
}

export type PosWorkspaceCatalog = {
  locationId: string;
  locations: PosLocationOption[];
  onLocationChange: (locationId: string) => void;
  /** Las terminales activas del local; con una sola no hay nada que elegir y no se dibuja. */
  terminals: { id: string; label: string }[];
  terminalId: string | null;
  onTerminalChange: (terminalId: string) => void;
  products: PosCatalogProduct[];
  categories: PosCatalogCategoryChip[];
  query: string;
  onQueryChange: (query: string) => void;
  activeCategoryId: string | null;
  onCategorySelect: (categoryId: string | null) => void;
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  currency: CurrencyFormat;
  onAdd: (product: PosCatalogProduct) => void;
};

export type PosWorkspaceSale = {
  lines: PosDraftLine[];
  changeQuantity: (lineKey: string, quantity: number) => void;
  removeLine: (lineKey: string) => void;
  totals: PosSaleTotals;
  appliedCoupon: { code: string; discount: number } | null;
  manualDiscountAmount: number;
  currency: CurrencyFormat;
  customer: PosCustomerDraft;
  setCustomer: React.Dispatch<React.SetStateAction<PosCustomerDraft>>;
  payments: PosPaymentDraft[];
  setPayments: React.Dispatch<React.SetStateAction<PosPaymentDraft[]>>;
  fieldErrors: Record<string, string>;
  currencyCode: string;
  usdExchangeRate: number | null;
  /** Agrega una fila de cobro con otro medio (efectivo + transferencia, dos tarjetas). */
  addPaymentRow: () => void;
  /** Saca una fila del cobro partido. */
  removePaymentRow: (paymentId: string) => void;
  canCharge: boolean;
  needsOpenShift: boolean;
  blockedReason: string | null;
  total: number;
  charging: boolean;
  saleError: string | null;
  restoredSale: boolean;
  onCharge: () => void;
  /** Las opciones secundarias (promo, descuento, esperas), ya armadas por la pantalla. */
  options: React.ReactNode;
  /** El resultado del último cobro (confirmación, recibo y tickets). */
  confirmation: React.ReactNode;
};

/**
 * La barra de contexto del POS: local, terminal y estado de caja.
 *
 * Es el **estado operativo** (qué local, qué caja, qué conexión) y por eso está arriba y compacto: la ley del
 * primer viewport pide que el estado crítico y la acción principal entren juntos.
 */
function PosContextBar({
  catalog,
  contextBar,
}: {
  catalog: PosWorkspaceCatalog;
  contextBar: React.ReactNode;
}) {
  return (
    <section aria-label="Contexto del mostrador">
      {/*
        Dos filas a partir de `sm` y una sola en el celular: local y terminal arriba (con ancho propio) y el
        estado del turno abajo, ocupando lo que sobra.

        **Por qué no una grilla de tres columnas**: el estado de la caja termina en un botón («Cobrar pedido
        del menú») cuyo ancho mínimo lo impone su contenido, así que una tercera columna `1fr` no se encoge
        por debajo de eso y **desborda la pantalla** (medido a 768 px: 42 px de scroll horizontal). El `flex`
        con `flex-wrap` deja que el bloque de estado baje de línea en vez de empujar la página.
      */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 sm:flex-none sm:basis-56">
          <Select
            label="Local"
            value={catalog.locationId}
            onChange={(event) => catalog.onLocationChange(event.target.value)}
            options={catalog.locations.map((location) => ({
              value: location.id,
              label: location.name,
            }))}
          />
        </div>

        {catalog.terminals.length > 1 ? (
          <div className="min-w-0 flex-1 sm:flex-none sm:basis-44">
            <Select
              label="Terminal"
              value={catalog.terminalId ?? ""}
              onChange={(event) => catalog.onTerminalChange(event.target.value)}
              options={catalog.terminals.map((terminal) => ({
                value: terminal.id,
                label: terminal.label,
              }))}
            />
          </div>
        ) : null}

        <div className="min-w-0 basis-full">{contextBar}</div>
      </div>
    </section>
  );
}

export function PosWorkspace({
  catalog,
  sale,
  contextBar,
}: {
  catalog: PosWorkspaceCatalog;
  sale: PosWorkspaceSale;
  contextBar: React.ReactNode;
}) {
  const twoPane = useMediaQuery(POS_TWO_PANE_QUERY);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const panelRef = React.useRef<HTMLDialogElement>(null);
  const columnRef = React.useRef<HTMLDivElement>(null);

  const sheetDismissible = !twoPane;
  const sheetHidden = sheetDismissible && !sheetOpen;
  /** Con el sheet cerrado no hay formulario en el DOM (ver el comentario del panel). */
  const contentMounted = !sheetHidden;

  /**
   * Dónde se ancla el panel en escritorio: la columna que reserva el lugar está en el flujo del layout, así
   * que su rectángulo es la respuesta. Se mide al montar, cuando cambia el tamaño de la ventana o de la
   * columna (`ResizeObserver`: el catálogo cambia de alto con los filtros) y cuando el panel cambia de alto
   * (una opción secundaria abierta puede mover el ancla).
   */
  const { anchorTop, anchorRight, anchorWidth } = useSaleColumnAnchor(
    columnRef,
    !sheetDismissible,
    panelRef,
  );
  /** El alto que le queda al panel desde su ancla hasta el pie del viewport (con 16 px de aire). */
  const anchorMaxHeight =
    anchorTop === undefined ? undefined : `calc(100vh - ${anchorTop + 16}px)`;

  /**
   * El foco entra al sheet al abrirlo y **vuelve al disparador** al cerrarlo: sin eso, el cajero que cierra
   * con Escape queda con el foco en el `body` y el próximo Tab lo lleva al principio del panel.
   */
  React.useEffect(() => {
    if (!sheetDismissible) return;

    if (sheetOpen) {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]",
      );
      (focusable ?? panelRef.current)?.focus();
      return;
    }

    // El disparador se busca por su nombre accesible: el `Button` del sistema no reenvía `ref`.
    document.querySelector<HTMLButtonElement>('[data-pos-sale-sheet-trigger="true"]')?.focus();
  }, [sheetDismissible, sheetOpen]);

  /** Escape cierra el sheet y no toca nada más de la pantalla. */
  React.useEffect(() => {
    if (!sheetDismissible || !sheetOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheetOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sheetDismissible, sheetOpen]);

  const unitsCount = sale.lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div className="space-y-4 pb-24 lg:pb-0">
      <PosContextBar catalog={catalog} contextBar={contextBar} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,27rem)] lg:items-start">
        {/*
          `min-w-0`: sin eso la columna del catálogo se estira con su contenido (la fila de chips con scroll
          horizontal la dejaba más ancha que la pantalla y aparecía scroll horizontal a 375 px).
        */}
        <div className="min-w-0">
          <PosCatalogGrid
            products={catalog.products}
            categories={catalog.categories}
            query={catalog.query}
            onQueryChange={catalog.onQueryChange}
            activeCategoryId={catalog.activeCategoryId}
            onCategorySelect={catalog.onCategorySelect}
            loading={catalog.loading}
            loadError={catalog.loadError}
            onRetry={catalog.onRetry}
            currency={catalog.currency}
            onAdd={catalog.onAdd}
          />
        </div>

        {/*
          La **columna** de la venta en escritorio: reserva su ancho y dice dónde se ancla el panel.

          Se reserva porque el panel se ancla con `position: fixed` (ver el `<dialog>` de abajo) y un elemento
          fuera del flujo no ocupa lugar: sin esta columna, el catálogo se comería el ancho y el panel lo
          taparía.
        */}
        <div className="relative hidden lg:block" data-testid="pos-sale-column">
          <div
            ref={columnRef}
            className="pointer-events-none absolute inset-y-0 left-0 w-[min(27rem,100%)]"
          />
        </div>

        {/*
          El panel de venta es un **`<dialog>` nativo**. En `lg` es la columna de la venta y abajo de `lg` el
          sheet de checkout (`fixed` al pie, `open` solo cuando se abre). Se usa el elemento de la plataforma
          y no un `div` con el rol de diálogo escrito a mano (la ley del DS v4 prohíbe el rol manual donde
          hay primitivo) — y **no** `showModal()`: el POS necesita el mismo nodo en el flujo del layout en
          escritorio, y el modo modal del navegador lo saca a la capa de arriba.

          **Por qué `fixed` y no `sticky` en escritorio**: un `<dialog>` con `open` y `position: sticky`
          **no se pega** (medido en Chromium: se va con el scroll), así que el ticket —total y `Cobrar C$…`—
          quedaba fuera de la pantalla. El ancla se calcula con la columna de arriba, que sí está en el flujo:
          el panel queda pegado al viewport mientras el catálogo scrollea.
        */}
        <dialog
          ref={panelRef}
          open={!sheetHidden}
          data-testid="pos-sale-pane"
          aria-label="Venta en curso"
          onKeyDown={(event) => {
            if (event.key === "Escape" && sheetOpen) setSheetOpen(false);
          }}
          className={[
            "m-0 flex w-full flex-col gap-3 border-line-medium bg-surface-card p-4 focus:outline-none",
            "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-auto max-lg:z-50 max-lg:max-h-[92vh] max-lg:max-w-none",
            "max-lg:rounded-t-stitch-2xl max-lg:border-t max-lg:shadow-elevation-4",
            "max-lg:transition-transform max-lg:duration-200 max-lg:ease-out max-lg:motion-reduce:transition-none",
            sheetOpen ? "max-lg:translate-y-0" : "max-lg:translate-y-full",
            "lg:fixed lg:right-7 lg:left-auto lg:w-[min(27rem,calc((100vw-17rem-1.75rem)*0.35))]",
            "lg:max-h-[calc(100vh-2rem)] lg:overflow-hidden lg:rounded-stitch-lg lg:border lg:shadow-elevation-2",
          ].join(" ")}
          style={
            sheetDismissible
              ? undefined
              : // `bottom: auto` y un `max-height` calculado desde el ancla: el `dialog` trae `inset: 0` del
                // navegador y un `max-height` en `vh` no descuenta el alto de la cabecera del POS, así que el
                // pie con `Cobrar C$…` quedaba fuera de la pantalla.
                {
                  top: anchorTop,
                  bottom: "auto",
                  right: anchorRight,
                  width: anchorWidth || undefined,
                  maxHeight: anchorMaxHeight,
                }
          }
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-panel-overline font-bold uppercase tracking-wider text-ink-muted">Venta</p>            {sheetDismissible ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="min-h-11 min-w-11 lg:hidden"
                aria-label="Cerrar venta"
                onClick={() => setSheetOpen(false)}
              >
                <X aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
              </Button>
            ) : null}
          </div>

          {/*
            El contenido **se desmonta** cuando el sheet está cerrado. No es una optimización: en el celular el
            panel vive fuera de la pantalla (`translate-y-full`), y un formulario que existe pero no se ve es
            una trampa de teclado y de lector de pantalla. Con el contenido desmontado no hay nada que
            alcanzar, y el `inert`/`aria-hidden` quedan como refuerzo para el navegador, no como la garantía.
          */}
          {contentMounted ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <PosSaleLines
                lines={sale.lines}
                currency={sale.currency}
                onChangeQuantity={sale.changeQuantity}
                onRemove={sale.removeLine}
              />

              <PosSaleSummary
                linesCount={sale.lines.length}
                totals={sale.totals}
                appliedCoupon={sale.appliedCoupon}
                manualDiscountAmount={sale.manualDiscountAmount}
                currency={sale.currency}
              />

              <PosCustomerFields
                customer={sale.customer}
                setCustomer={sale.setCustomer}
                fieldErrors={sale.fieldErrors}
              />

              <PosPaymentFields
                payments={sale.payments}
                setPayments={sale.setPayments}
                fieldErrors={sale.fieldErrors}
                currencyCode={sale.currencyCode}
                currency={sale.currency}
                total={sale.totals.total}
                usdExchangeRate={sale.usdExchangeRate}
                onAddPayment={sale.addPaymentRow}
                onRemovePayment={sale.removePaymentRow}
              />

              {sale.options}
            </div>
          ) : (
            <p className="text-st-body text-ink-secondary">
              {`${sale.lines.length} ${
                sale.lines.length === 1 ? "producto" : "productos"
              } en la venta · abrila para cobrar.`}
            </p>
          )}

          {contentMounted ? (
            <div className="space-y-2 border-t border-line-subtle pt-3">
              {/*
                El cobro, con el aviso de caja cerrada, el de **sin conexión** (con el botón bloqueado: un
                cobro que no se registra es un pedido perdido) y el de la venta recuperada del dispositivo.
              */}
              <PosChargePanel
                needsOpenShift={sale.needsOpenShift}
                canCharge={sale.canCharge}
                blockedReason={sale.blockedReason}
                total={sale.total}
                currency={sale.currency}
                charging={sale.charging}
                saleError={sale.saleError}
                restoredSale={sale.restoredSale}
                onCharge={sale.onCharge}
              />
              {sale.confirmation}
            </div>
          ) : null}
        </dialog>
      </div>

      {/* El fondo oscurecido del sheet: es una capa de cierre, no una acción (no lleva primitivo). */}
      {sheetOpen ? (
        <div
          data-testid="pos-sale-sheet-backdrop"
          onClick={() => setSheetOpen(false)}
          className="fixed inset-0 z-40 bg-canvas/70 lg:hidden"
        />
      ) : null}

      {/*
        La barra inferior del celular: `N productos · Total` y «Ver venta», arriba de la navegación del panel.
        Es la pieza que deja el ticket a un toque desde el primer viewport, sin apilar la venta abajo.

        Con el sheet **abierto** la barra no se dibuja: el ticket ya está en pantalla con su total y su botón
        de cobrar, y dejar la barra encima taparía el CTA principal (medido a 375 px: la barra caía justo
        sobre «Cobrar C$…»).
      */}
      {sheetDismissible && !sheetOpen ? (
        <div className="fixed inset-x-0 bottom-16 z-30 px-3 pb-[env(safe-area-inset-bottom)] lg:hidden">
          <PosMobileSaleBar
            linesCount={sale.lines.length}
            unitsCount={unitsCount}
            total={sale.totals.total}
            currency={sale.currency}
            onOpen={() => setSheetOpen(true)}
          />
        </div>
      ) : null}
    </div>
  );
}
