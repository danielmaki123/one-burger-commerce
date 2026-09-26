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
import type { PosCashState } from "./pos-cash-action";
import PosCashAction from "./pos-cash-action";
import PosCustomerFields, { type PosCustomerDraft } from "./pos-customer";
import PosPaymentFields from "./pos-payment";
import PosSaleLines from "./pos-sale-lines";
import PosSaleSummary, { PosMobileSaleBar, type PosSaleTotals } from "./pos-sale-summary";
import { POS_TWO_PANE_QUERY, useMediaQuery } from "./use-media-query";

/**
 * El **workspace** de la venta rápida: `CATÁLOGO | VENTA`, a alto útil de viewport.
 *
 * `SCREEN-POS-QUICK-SALE-001.1` (spec + `reference.html`) es el contrato de composición, jerarquía, densidad
 * y responsive de esta pantalla. Lo que esta pieza implementa, y por qué:
 *
 * 1. **Barra operativa de una línea.** `POS · Local · Terminal · ● Caja abierta` (el título lo pone la
 *    pantalla). Sin hero, sin descripción y **sin acciones de caja permanentes**: el estado se muestra; las
 *    acciones viven en el checkout, donde el cobro está bloqueado.
 * 2. **Alto útil, no página larga.** En `lg` el workspace ocupa el alto del viewport: el catálogo scrollea
 *    **dentro** de su panel y el ticket nunca se va de la pantalla. El scroll de página en una venta normal
 *    (1–3 productos) es un defecto, no una consecuencia.
 * 3. **El ticket usa todo su alto.** Las líneas se llevan el espacio libre: con 0–3 productos no queda una
 *    zona muerta, y con muchas líneas solo la lista crece y scrollea. El `Cobrar C$…` está anclado al pie.
 * 4. **El sheet no es una trampa.** Abajo de `lg` la venta pasa a un sheet; cerrado **no hay formulario en el
 *    DOM** (un formulario invisible se puede tabular), abierto es un `<dialog open>` con nombre accesible,
 *    recibe el foco y **Escape** lo cierra devolviéndolo al disparador.
 *
 * **Un solo nodo para la columna y el sheet.** La venta no se duplica en el DOM: dos formularios con los
 * mismos campos serían dos fuentes de verdad, dos juegos de `id` y un `getByLabelText` ambiguo. Lo que cambia
 * entre escritorio y tablet/celular es el layout, no el árbol.
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
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
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
  addPaymentRow: () => void;
  removePaymentRow: (paymentId: string) => void;
  fieldErrors: Record<string, string>;
  currencyCode: string;
  usdExchangeRate: number | null;
  canCharge: boolean;
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

/** Lo que la barra y el checkout necesitan saber de la caja. */
export type PosWorkspaceCash = {
  state: PosCashState;
  loading: boolean;
  busy: boolean;
  error: string | null;
  onOpen: () => void;
  /** El cierre pertenece a Caja (firma el arqueo): desde acá se **enlaza**, no se reimplementa. */
  closeHref: string;
};

/**
 * La **barra operativa**: título, local, terminal y estado de caja, en una sola línea.
 *
 * `SCREEN-POS-QUICK-SALE-001.1` §5: la caja abierta se muestra **solo como estado** (`● Caja abierta`), sin
 * enlaces ni explicaciones permanentes, y los selectores pierden su etiqueta visible (el valor ya dice qué
 * son) para entrar en una línea.
 */
function PosToolbar({
  catalog,
  cash,
}: {
  catalog: PosWorkspaceCatalog;
  cash: PosWorkspaceCash;
}) {
  return (
    <header aria-label="Barra del mostrador" className="flex flex-wrap items-center gap-x-2 gap-y-2">
      <h1 className="mr-auto text-panel-title font-bold tracking-tight text-ink">POS</h1>

      <div className="w-44 max-lg:hidden">
        <Select
          label=""
          aria-label="Local"
          value={catalog.locationId}
          onChange={(event) => catalog.onLocationChange(event.target.value)}
          options={catalog.locations.map((location) => ({
            value: location.id,
            label: location.name,
          }))}
        />
      </div>

      {catalog.terminals.length > 1 ? (
        <div className="w-36 max-lg:hidden">
          <Select
            label=""
            aria-label="Terminal"
            value={catalog.terminalId ?? ""}
            onChange={(event) => catalog.onTerminalChange(event.target.value)}
            options={catalog.terminals.map((terminal) => ({
              value: terminal.id,
              label: terminal.label,
            }))}
          />
        </div>
      ) : null}

      {/*
        El estado de la caja es **estado**, no acción: `● Caja abierta` o `● Caja cerrada`. Cuando hay un
        turno de otro día, el estado dice que hay un cierre pendiente (el rojo del sistema, que es el único
        que el negocio no puede reescribir).
      */}
      <p
        role="status"
        className={[
          "inline-flex min-h-11 items-center gap-2 rounded-stitch-md border px-3 text-st-body font-medium",
          cash.state === "pending-close"
            ? "border-status-sla-border bg-status-sla-bg text-status-sla-text"
            : cash.state === "open"
              ? "border-status-ready-border bg-status-ready-bg text-status-ready-text"
              : "border-line-subtle bg-surface-low text-ink-secondary",
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className={`h-2 w-2 shrink-0 rounded-full ${
            cash.state === "open" ? "bg-status-ready-dot" : "bg-status-inactive-dot"
          }`}
        />
        {cash.loading
          ? "Leyendo la caja…"
          : cash.state === "open"
            ? "Caja abierta"
            : cash.state === "pending-close"
              ? "Cierre pendiente"
              : "Sin caja abierta"}
      </p>
    </header>
  );
}

export function PosWorkspace({
  catalog,
  sale,
  cash,
}: {
  catalog: PosWorkspaceCatalog;
  sale: PosWorkspaceSale;
  cash: PosWorkspaceCash;
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
   * que su rectángulo es la respuesta. Se mide al montar y cuando cambia el tamaño de la ventana, de la
   * columna (`ResizeObserver`) o del panel (una opción secundaria abierta puede mover el ancla).
   */
  const { anchorTop, anchorRight, anchorWidth } = useSaleColumnAnchor(
    columnRef,
    !sheetDismissible,
    panelRef,
  );

  /**
   * Alto máximo del panel: desde su ancla hasta el pie del viewport, con 16 px de aire.
   *
   * No alcanza con `100vh`: el panel arranca **debajo de la barra operativa** (su ancla), así que un
   * `max-height` en `vh` lo deja 60 px fuera de la pantalla y el `Cobrar C$…` del pie no se ve (medido a
   * `1280×720`).
   */
  const anchorMaxHeight =
    anchorTop === undefined ? "calc(100vh - 1.5rem)" : `calc(100vh - ${anchorTop + 16}px)`;

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
    <div className="flex flex-col gap-3 lg:h-[calc(100vh-13.5rem)] lg:min-h-[30rem]">
      <PosToolbar catalog={catalog} cash={cash} />

      <div className="grid min-h-0 gap-3 max-lg:block lg:grid-cols-[minmax(0,1fr)_minmax(340px,25rem)]">
        {/*
          `min-w-0`: sin eso la columna del catálogo se estira con su contenido (la fila de chips con scroll
          horizontal la dejaba más ancha que la pantalla y aparecía scroll horizontal a 375 px).
        */}
        <div className="min-h-0 min-w-0">
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
            className="pointer-events-none absolute inset-y-0 left-0 w-[min(25rem,100%)]"
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

          El alto arranca en el ancla y **termina en el pie del viewport** (`100vh - 1.5rem`): el ticket usa
          todo el alto útil, como el `reference.html`.
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
            "m-0 flex w-full flex-col overflow-hidden border-line-medium bg-surface-card focus:outline-none",
            "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-auto max-lg:z-50 max-lg:max-h-[92vh] max-lg:max-w-none",
            "max-lg:rounded-t-stitch-2xl max-lg:border-t max-lg:shadow-elevation-4",
            "max-lg:transition-transform max-lg:duration-200 max-lg:ease-out max-lg:motion-reduce:transition-none",
            sheetOpen ? "max-lg:translate-y-0" : "max-lg:translate-y-full",
            "lg:fixed lg:right-7 lg:left-auto lg:w-[min(25rem,calc((100vw-17rem-1.75rem)*0.35))]",
            "lg:max-h-[calc(100vh-1.5rem)] lg:rounded-stitch-lg lg:border lg:shadow-elevation-2",
          ].join(" ")}
          style={
            sheetDismissible
              ? undefined
              : // `bottom: auto` y `margin` en cero: el `dialog` trae `inset: 0` y `margin: auto` del
                // navegador, así que con `top` puesto el navegador lo **estira** hasta el fondo (el alto
                // salía 1170 px y el pie con `Cobrar` quedaba fuera de la pantalla).
                {
                  top: anchorTop,
                  bottom: "auto",
                  margin: 0,
                  right: anchorRight,
                  width: anchorWidth || undefined,
                  maxHeight: anchorMaxHeight,
                  maxWidth: "calc(100vw - 1.5rem)",
                }
          }
        >
          <div className="flex items-center justify-between gap-2 border-b border-line-subtle px-4 py-1.5">
            <div className="min-w-0">
              <h2 className="text-panel-item font-bold tracking-tight text-ink">Venta en curso</h2>
              <PosSaleSummary
                variant="meta"
                linesCount={sale.lines.length}
                totals={sale.totals}
                appliedCoupon={sale.appliedCoupon}
                manualDiscountAmount={sale.manualDiscountAmount}
                currency={sale.currency}
              />
            </div>

            {sheetDismissible ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="min-h-11 min-w-11"
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
            una trampa de teclado y de lector de pantalla.
          */}
          {contentMounted ? (
            <>
              {/*
                **Dos zonas de scroll, no una.** Arriba las **líneas** (`flex-[0_1_auto]` con su tope): con 0–3
                productos el ticket no reserva una zona alta vacía y con muchas líneas scrollea solo esta lista.
                Abajo el **checkout** —total, cliente, pago, opciones— con su propio scroll: es la parte que
                crece cuando el cajero abre una opción, y así el pie con el CTA queda siempre visible.
              */}
              <div className="min-h-0 flex-[0_1_auto] overflow-y-auto border-b border-line-subtle px-4 pt-2">
                <PosSaleLines
                  lines={sale.lines}
                  currency={sale.currency}
                  onChangeQuantity={sale.changeQuantity}
                  onRemove={sale.removeLine}
                />
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
                <PosSaleSummary
                  linesCount={sale.lines.length}
                  totals={sale.totals}
                  appliedCoupon={sale.appliedCoupon}
                  manualDiscountAmount={sale.manualDiscountAmount}
                  currency={sale.currency}
                  variant="full"
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

              <div className="max-h-[45%] shrink-0 space-y-2 overflow-y-auto border-t border-line-subtle bg-surface-low px-4 py-2">
                {/*
                  La caja, **donde el cobro está bloqueado**: sin turno se ofrece abrirla; con un turno de otro
                  día, cerrarlo (y no se ofrece abrir otra). Con la caja abierta no se dibuja nada.
                */}
                <PosCashAction
                  state={cash.state}
                  loading={cash.loading}
                  busy={cash.busy}
                  error={cash.error}
                  onAction={cash.onOpen}
                  closeHref={cash.closeHref}
                />

                {/*
                  El cobro: el aviso de **sin conexión** (con el botón bloqueado: un cobro que no se registra es
                  un pedido perdido) y el de la venta recuperada del dispositivo.
                */}
                <PosChargePanel
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
            </>
          ) : (
            <p className="px-4 py-3 text-st-body text-ink-secondary">
              {`${sale.lines.length} ${
                sale.lines.length === 1 ? "producto" : "productos"
              } en la venta · abrila para cobrar.`}
            </p>
          )}
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
        La barra inferior del celular: `N productos · Total` y «Ver venta», al pie del viewport (como el
        `reference.html`). Es la pieza que deja el ticket a un toque desde el primer viewport.

        Con el sheet **abierto** la barra no se dibuja: el ticket ya está en pantalla con su total y su botón
        de cobrar, y dejarla encima taparía el CTA principal (medido a 375 px).
      */}
      {sheetDismissible && !sheetOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
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
