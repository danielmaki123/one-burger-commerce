"use client";

import * as React from "react";
import { ChevronDown, ShoppingCart, Wallet } from "lucide-react";

import {
  addPosLine,
  createPosDraft,
  posDraftTotals,
  removePosLine,
  setPosLineQuantity,
  type PosDraft,
} from "@/modules/pos/domain/pos-draft";
import { filterPosProducts } from "@/modules/pos/domain/search-pos-products";
import type { PosCatalogProduct } from "@/modules/pos/ports/pos-catalog";
import { buildKitchenTicketLines } from "@/shared/lib/kitchen-ticket";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { PAYMENT_METHOD_TYPE_LABELS } from "@/modules/orders/domain/order.types";
import {
  renderReceiptJpeg,
  shareOrDownloadReceipt,
  type ReceiptData,
} from "@/shared/lib/receipt-image";
import { AdminEmptyState, AdminPageHeader } from "../_components/admin-operational-ui";
import {
  CashCountGrid,
  toCashCountRows,
  type CashCountValues,
} from "./cash-count-grid";

/**
 * TASK-302 + TASK-303b — el mostrador: catálogo del local a un lado, venta al otro.
 *
 * Se pide y se paga **de una vez** (decisión del owner): el cajero arma la venta, deja el nombre y el
 * número del cliente (el correo es opcional) y cobra. El total que se muestra sale de la misma
 * fórmula que usa el servidor (`posDraftTotals`) y **el que manda es el del servidor**: si el menú
 * cambió entre que se cargó el catálogo y se cobró, la respuesta del servidor lo dice con el número
 * de pedido en vez de guardar un cobro que no alcanza.
 *
 * La búsqueda filtra en memoria con la regla compartida (`filterPosProducts`): el catálogo del local
 * se trae **una vez** y escribir no dispara una consulta por tecla.
 */

export type PosLocationOption = { id: string; name: string };

/**
 * Bloque 4 del roadmap del POS (Fase 2) — una fila de cobro del mostrador.
 *
 * El monto vive como **texto** para que el input controlado no pelee con el cajero (mismo patrón que
 * el monto único de TASK-303b); la conversión a número pasa al armar el payload.
 */
export type PosPaymentDraft = {
  id: string;
  method: "cash" | "card" | "transfer" | "other";
  currency: string;
  amount: string;
  /** Referencia del voucher o de la transferencia (Bloque 4.1). */
  reference?: string;
};

/**
 * TASK-306 — cada cuánto se refresca el mostrador solo.
 *
 * Decisión del owner (2026-09-14): **polling**, no SSE. Con una sola réplica y un catálogo chico, dos
 * consultas cada 3 s no necesitan conexiones largas ni tocar los timeouts del proxy.
 */
export const POS_REFRESH_MS = 3000;

/**
 * Bloque 4 del roadmap del POS (Fase 2) — los medios que ofrece el mostrador.
 *
 * `mixed` no está: el mixto es un **resultado** de partir el cobro entre dos medios, no algo que el
 * cajero elija. Sale del primero al construir el payload del pedido.
 */
const PAYMENT_METHOD_CHOICES = [
  { id: "cash", label: "Efectivo" },
  { id: "card", label: "Tarjeta" },
  { id: "transfer", label: "Transferencia" },
  { id: "other", label: "Otro" },
] as const;

type PosShift = {
  id: string;
  openedAt: string;
  openingAmount: number;
  cashCounts?: { kind: "opening" | "closing"; currency: string; denomination: number; quantity: number }[];
};

type ClosedShiftSummary = {
  closingAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;
  expectedByCurrency: Record<string, number>;
};

type PosSaleSummary = {
  orderNumber: string;
  total: number;
  change: number | null;
  /** Lo que hace falta para reimprimir el recibo cuando el cajero lo pide (TASK-307). */
  receipt: {
    customerName: string;
    lines: { name: string; quantity: number; unitPrice: number; lineTotal: number }[];
    subtotal: number;
    packagingAmount: number;
    payments: { methodLabel: string; amount: number; currency: string | null }[];
  };
};

function catalogUrl(locationId: string) {
  return `/api/admin/pos/catalog?locationId=${encodeURIComponent(locationId)}`;
}

/**
 * Bloque 10.1 del roadmap del POS (Fase 2) — imprime el ticket de cocina con la hoja del sistema.
 *
 * El **texto** sale de `buildKitchenTicketLines` (función pura, probada): negocio, «COCINA», número de
 * pedido, hora prometida, cada ítem con sus modificadores y notas, y las aclaraciones — **sin
 * importes**. Acá solo se abre una ventana con ese texto y se llama a `print()`: sin dependencias ni
 * impresora de red (la decisión del owner para este bloque). Si el navegador bloquea la ventana no se
 * rompe nada: el cobro ya quedó hecho.
 */
function openKitchenTicket(
  sale: {
    orderNumber: string;
    pickupTime: string;
    pickupScheduled: boolean;
    pickupNotes: string | null;
    notes: string | null;
    receipt: {
      packagingAmount: number;
      payments: { methodLabel: string; amount: number; currency: string | null }[];
    };
    lines: { name: string; quantity: number; notes: string | null; modifiers?: { name: string }[] }[];
  },
  options: { businessName: string; timezone: string; locale: string },
) {
  if (typeof window === "undefined") return;

  const lineas = buildKitchenTicketLines(
    {
      orderNumber: sale.orderNumber,
      pickupTime: sale.pickupTime,
      pickupScheduled: sale.pickupScheduled,
      pickupNotes: sale.pickupNotes,
      notes: sale.notes,
      items: sale.lines.map((line) => ({
        name: line.name,
        quantity: line.quantity,
        notes: line.notes,
        modifiers: line.modifiers ?? [],
      })),
    },
    { ...options, label: "COCINA" },
  );

  const ventana = window.open("", "_blank", "width=380,height=600");
  if (!ventana) return;

  ventana.document.write(
    `<pre style="font: 14px/1.5 ui-monospace, monospace; margin: 0; padding: 12px;">${lineas.join("\n")}</pre>`,
  );
  ventana.document.close();
  ventana.focus();
  ventana.print();
}

export default function PosClient({ locations }: { locations: PosLocationOption[] }) {  const currency = useCurrencyFormat();
  const settings = useBusinessSettings();

  const [locationId, setLocationId] = React.useState(locations[0]?.id ?? "");
  const [products, setProducts] = React.useState<PosCatalogProduct[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [draft, setDraft] = React.useState<PosDraft>(() => createPosDraft(locations[0]?.id ?? ""));
  const [reloadKey, setReloadKey] = React.useState(0);
  const [customer, setCustomer] = React.useState({ name: "", whatsapp: "", email: "" });
  /**
   * Bloque 4 del roadmap del POS (Fase 2) — el cobro es una **lista**.
   *
   * Antes era un monto, un medio y una moneda: el contrato ya aceptaba N cobros y el caso de uso los
   * registraba, pero el cajero no tenía forma de armar dos (efectivo + transferencia, dos tarjetas).
   * El primero se edita con los controles de siempre y «Partir el cobro» agrega filas.
   */
  const [payments, setPayments] = React.useState<PosPaymentDraft[]>(() => [
    { id: "pay_1", method: "cash", currency: settings.currencyCode, amount: "" },
  ]);
  const [charging, setCharging] = React.useState(false);
  const [saleError, setSaleError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [lastSale, setLastSale] = React.useState<PosSaleSummary | null>(null);
  // La clave de la operación se renueva solo cuando la venta salió bien: si el cobro falla y el cajero
  // reintenta, el servidor reconoce el mismo intento y no crea dos pedidos (TASK-101).
  const [attemptKey, setAttemptKey] = React.useState(() => crypto.randomUUID());
  // TASK-305b — la caja del local.
  const [shift, setShift] = React.useState<PosShift | null>(null);
  // La referencia del POS deja el arqueo plegado en la cabecera: el catálogo manda en la pantalla.
  const [cashDrawerOpen, setCashDrawerOpen] = React.useState(false);
  const [shiftLoading, setShiftLoading] = React.useState(true);
  const [shiftError, setShiftError] = React.useState<string | null>(null);
  const [countValues, setCountValues] = React.useState<CashCountValues>({});
  const [shiftBusy, setShiftBusy] = React.useState(false);
  const [closedShift, setClosedShift] = React.useState<ClosedShiftSummary | null>(null);
  const [receiptState, setReceiptState] = React.useState<"idle" | "busy" | "done" | "error">("idle");
  // El local actual, para que un refresco que llega tarde no pise el catálogo del local nuevo.
  const locationRef = React.useRef(locationId);

  const cashCurrencies = React.useMemo(    () => [settings.currencyCode, ...(settings.usdExchangeRate !== null ? ["USD"] : [])],
    [settings.currencyCode, settings.usdExchangeRate],
  );

  /** Lo que el cajero lleva cobrado sumando todas las filas (en moneda del negocio, sin convertir). */  const paidTotal = React.useMemo(
    () =>
      payments.reduce(
        (sum, payment) => sum + (Number.isFinite(Number(payment.amount)) ? Number(payment.amount) : 0),
        0,
      ),
    [payments],
  );

  const loadShift = React.useCallback(
    async (targetLocationId: string, options: { silent?: boolean } = {}) => {
      if (targetLocationId === "") {
        setShiftLoading(false);
        return;
      }

      if (!options.silent) {
        setShiftLoading(true);
        setShiftError(null);
      }

      try {
        const response = await fetch(
          `/api/admin/pos/shift?locationId=${encodeURIComponent(targetLocationId)}`,
        );
        const body = (await response.json()) as {
          data?: PosShift | null;
          error?: { message?: string };
        };

        if (!response.ok) throw new Error(body.error?.message ?? "No se pudo leer la caja.");
        setShift(body.data ?? null);
      } catch (error) {
        // El refresco de fondo no pisa una pantalla que está funcionando: el error de la caja se
        // muestra cuando la acción es del cajero (abrir o cerrar), no cuando la dispara el reloj.
        if (options.silent) return;

        setShift(null);
        setShiftError(error instanceof Error ? error.message : "No se pudo leer la caja.");
      } finally {
        if (!options.silent) setShiftLoading(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    setCountValues({});
    setClosedShift(null);
    void loadShift(locationId);
  }, [locationId, loadShift]);

  /**
   * Trae el catálogo del local. `silent` es el refresco de fondo (TASK-306): no muestra "Cargando…"
   * ni borra lo que el cajero ya tiene en pantalla si la red falla.
   */
  const applyCatalog = React.useCallback(
    async (targetLocationId: string, options: { silent?: boolean } = {}) => {
      if (targetLocationId === "") {
        setLoading(false);
        return;
      }

      if (!options.silent) {
        setLoading(true);
        setLoadError(null);
      }

      try {
        const response = await fetch(catalogUrl(targetLocationId));
        if (!response.ok) throw new Error("No se pudo cargar el catálogo de ese local.");

        const body = (await response.json()) as { data: { products: PosCatalogProduct[] } };
        // Una respuesta de un local que el cajero ya dejó no puede pisar el catálogo del actual.
        if (locationRef.current !== targetLocationId) return;

        // Solo se reemplaza si cambió: refrescar cada 3 s no tiene que re-renderizar la pantalla.
        setProducts((current) =>
          JSON.stringify(current) === JSON.stringify(body.data.products)
            ? current
            : body.data.products,
        );
      } catch (error) {
        if (options.silent) return;

        setProducts([]);
        setLoadError(error instanceof Error ? error.message : "No se pudo cargar el catálogo.");
      } finally {
        if (!options.silent) setLoading(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    locationRef.current = locationId;
    void applyCatalog(locationId);
  }, [locationId, reloadKey, applyCatalog]);

  /**
   * TASK-306 — el POS se refresca solo cada 3 s: el catálogo (precios y disponibilidad pueden
   * cambiar en el menú) y la caja (otra terminal puede abrirla o cerrarla). **No toca el borrador, ni
   * la búsqueda, ni el conteo**: lo que el cajero está escribiendo queda donde está.
   */
  React.useEffect(() => {
    if (locationId === "") return;

    const timer = setInterval(() => {
      void applyCatalog(locationId, { silent: true });
      void loadShift(locationId, { silent: true });
    }, POS_REFRESH_MS);

    return () => clearInterval(timer);
  }, [locationId, applyCatalog, loadShift]);

  // Cambiar de local empieza una venta nueva: el borrador lleva el local y sus precios.
  React.useEffect(() => {
    setDraft(createPosDraft(locationId));
    setPayments([{ id: "pay_1", method: "cash", currency: settings.currencyCode, amount: "" }]);
    setLastSale(null);
  }, [locationId, settings.currencyCode]);

  const visibleProducts = React.useMemo(
    () => filterPosProducts(products, query),
    [products, query],
  );
  const totals = posDraftTotals(draft);

  const addProduct = (product: PosCatalogProduct) => {
    setDraft((current) =>
      addPosLine(current, {
        productId: product.id,
        name: product.name,
        unitPrice: product.price,
        packagingUnitAmount: product.packagingFeeAmount,
      }),
    );
  };

  /**
   * TASK-307 — arma el recibo del último cobro y lo ofrece: hoja de compartir (WhatsApp, imprimir) o
   * descarga del JPG. Sin API ni credenciales: la imagen se genera en el dispositivo.
   */
  const sendReceipt = async () => {
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

  const openBox = async () => {
    setShiftBusy(true);
    setShiftError(null);

    try {
      const response = await fetch("/api/admin/pos/shift/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          counts: toCashCountRows(countValues, cashCurrencies),
        }),
      });
      const body = (await response.json()) as {
        data?: PosShift;
        error?: { message?: string; fields?: Record<string, string> };
      };

      if (!response.ok || !body.data) {
        setShiftError(body.error?.message ?? "No se pudo abrir la caja.");
        return;
      }

      setShift(body.data);
      setCountValues({});
    } catch {
      setShiftError("No se pudo abrir la caja: revisá la conexión.");
    } finally {
      setShiftBusy(false);
    }
  };

  const closeBox = async () => {
    setShiftBusy(true);
    setShiftError(null);

    try {
      const response = await fetch("/api/admin/pos/shift/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          counts: toCashCountRows(countValues, cashCurrencies),
        }),
      });
      const body = (await response.json()) as {
        data?: ClosedShiftSummary;
        meta?: { expectedByCurrency?: Record<string, number> };
        error?: { message?: string; fields?: Record<string, string> };
      };

      if (!response.ok || !body.data) {
        setShiftError(body.error?.message ?? "No se pudo cerrar la caja.");
        return;
      }

      setClosedShift({ ...body.data, expectedByCurrency: body.meta?.expectedByCurrency ?? {} });
      setShift(null);
      setCountValues({});
    } catch {
      setShiftError("No se pudo cerrar la caja: revisá la conexión.");
    } finally {
      setShiftBusy(false);
    }
  };

  const charge = async () => {
    const problems: Record<string, string> = {};
    const filled = payments.filter((payment) => Number(payment.amount) > 0);
    if (draft.lines.length === 0) problems.lines = "Agregá al menos un producto.";
    if (customer.name.trim() === "") problems.name = "Escribí el nombre del cliente.";
    if (customer.whatsapp.trim() === "") problems.whatsapp = "Escribí el número del cliente.";
    if (filled.length === 0) problems.amount = "Escribí con cuánto paga el cliente.";
    // Bloque 4: cada fila del cobro partido tiene que tener monto, o el total cobrado no cierra.
    else if (filled.length !== payments.length) {
      problems.amount = "Completá el monto de todos los cobros.";
    }

    setFieldErrors(problems);
    setSaleError(null);

    if (Object.keys(problems).length > 0) {
      setSaleError("Revisá los datos marcados.");
      return;
    }

    setCharging(true);
    try {
      const response = await fetch("/api/admin/pos/sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          customer: {
            name: customer.name,
            whatsapp: customer.whatsapp,
            email: customer.email.trim() === "" ? null : customer.email,
          },
          lines: draft.lines,
          payments: filled.map((payment) => ({
            method: payment.method,
            currency: payment.currency,
            amount: Number(payment.amount),
            ...(payment.reference ? { reference: payment.reference } : {}),
          })),
          idempotencyKey: attemptKey,
        }),
      });

      const body = (await response.json()) as {
        data?: PosSaleSummary & {
          payments?: { method: string; amount: number; currency: string | null }[];
        };
        error?: { message?: string; fields?: Record<string, string> };
      };

      if (!response.ok || !body.data) {
        setFieldErrors(body.error?.fields ?? {});
        setSaleError(body.error?.message ?? "No se pudo cobrar la venta.");
        return;
      }

      setLastSale({
        ...body.data,
        // El recibo se arma con lo que se acaba de cobrar: el borrador se limpia enseguida.
        receipt: {
          customerName: customer.name,
          lines: draft.lines.map((line) => ({
            name: line.name,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.unitPrice * line.quantity,
          })),
          subtotal: totals.subtotal,
          packagingAmount: totals.packagingAmount,
          payments: (body.data.payments ?? []).map((payment) => ({
            methodLabel: PAYMENT_METHOD_TYPE_LABELS[payment.method as keyof typeof PAYMENT_METHOD_TYPE_LABELS],
            amount: payment.amount,
            currency: payment.currency,
          })),
        },
      });
      setDraft(createPosDraft(locationId));
      setCustomer({ name: "", whatsapp: "", email: "" });
      setPayments([{ id: "pay_1", method: "cash", currency: settings.currencyCode, amount: "" }]);
      setAttemptKey(crypto.randomUUID());
    } catch {
      setSaleError("No se pudo cobrar: revisá la conexión y reintentá.");
    } finally {
      setCharging(false);
    }
  };

  return (
    <div className="space-y-5 pb-8">
      <AdminPageHeader
        label="Caja"
        title="Punto de venta"
        description="Armá la venta del mostrador con el catálogo del local."
      />

      {locations.length === 0 ? null : (
        <section className="space-y-3" aria-label="Caja">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 gap-2"
              aria-expanded={cashDrawerOpen}
              aria-controls="pos-caja-arqueo"
              onClick={() => setCashDrawerOpen((open) => !open)}
            >
              <Wallet aria-hidden="true" className="h-5 w-5 text-brand-amber" />
              Apertura / Arqueo
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${
                  shift ? "bg-status-ready-dot" : "bg-status-inactive-dot"
                }`}
              />
              <ChevronDown
                aria-hidden="true"
                className={`h-4 w-4 transition-transform motion-reduce:transition-none ${
                  cashDrawerOpen ? "rotate-180" : ""
                }`}
              />
            </Button>

            <p className="text-st-body text-ink-secondary">
              {shiftLoading ? (
                "Leyendo la caja…"
              ) : shift ? (
                <>
                  Caja abierta · fondo{" "}
                  <span className="font-mono tabular-nums">
                    {formatCurrency(shift.openingAmount, currency)}
                  </span>
                </>
              ) : (
                "Sin caja abierta en este local."
              )}
            </p>
          </div>

          {cashDrawerOpen ? (
            <div
              id="pos-caja-arqueo"
              className="space-y-3 rounded-stitch-lg border border-line-subtle bg-surface-card p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-st-h2 text-ink">Apertura y arqueo de caja</h2>
                <p className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
                  Efectivo en córdobas
                </p>
              </div>

              {shiftLoading ? null : (
                <>
                  <p className="text-st-body text-ink-secondary">
                    {shift
                      ? "Contá lo que hay en la caja para cerrarla."
                      : "Contá con cuánto abrís la caja."}
                  </p>
                  <CashCountGrid
                    currencies={cashCurrencies}
                    values={countValues}
                    onChange={(key, quantity) =>
                      setCountValues((current) => ({ ...current, [key]: quantity }))
                    }
                    disabled={shiftBusy}
                    formatAmount={(value) => formatCurrency(value, currency)}
                  />
                  <Button
                    type="button"
                    variant={shift ? "outline" : "primary"}
                    className="min-h-11"
                    disabled={shiftBusy}
                    onClick={() => void (shift ? closeBox() : openBox())}
                  >
                    {shiftBusy ? "Guardando…" : shift ? "Cerrar caja" : "Abrir caja"}
                  </Button>
                </>
              )}
            </div>
          ) : null}

          {closedShift ? (
            <div
              role="status"
              className="rounded-stitch-lg border border-status-ready-border bg-status-ready-bg px-3 py-2 text-st-body text-status-ready-text"
            >
              Caja cerrada · contado <span className="font-mono">{formatCurrency(closedShift.closingAmount ?? 0, currency)}</span> ·
              esperado <span className="font-mono">{formatCurrency(closedShift.expectedAmount ?? 0, currency)}</span> ·{" "}
              {closedShift.difference === 0
                ? "sin diferencia"
                : `diferencia ${formatCurrency(closedShift.difference ?? 0, currency)}`}
            </div>
          ) : null}

          {shiftError ? (
            <p role="alert" className="text-st-body font-medium text-status-sla-text">
              {shiftError}
            </p>
          ) : null}
        </section>
      )}

      {locations.length === 0 ? (
        <AdminEmptyState
          title="Sin locales activos"
          description="El punto de venta necesita un local activo para saber qué precios cobrar."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <section className="space-y-4" aria-label="Catálogo">
            <Select
              label="Local"
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
              options={locations.map((location) => ({ value: location.id, label: location.name }))}
            />

            <Input
              label="Buscar en el catálogo"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Taco, bebida, postre…"
            />

            {loading ? (
              <p className="rounded-stitch-lg border border-line-subtle bg-surface-card px-4 py-6 text-st-body text-ink-secondary">
                Cargando el catálogo…
              </p>
            ) : loadError ? (
              <AdminEmptyState
                title="No se pudo cargar el catálogo"
                description={loadError}
                action={
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => setReloadKey((key) => key + 1)}
                  >
                    Reintentar
                  </Button>
                }
              />
            ) : visibleProducts.length === 0 ? (
              <AdminEmptyState
                title={products.length === 0 ? "El local no tiene productos vendibles" : "Sin resultados"}
                description={
                  products.length === 0
                    ? "Cargá la carta del local en Menú y volvé a entrar."
                    : "Probá con otro nombre o con la categoría."
                }
              />
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Productos del local">
                {visibleProducts.map((product) => (
                  <li
                    key={product.id}
                    className="flex min-h-24 flex-col justify-between gap-2 rounded-stitch-lg border border-line-subtle bg-surface-card p-3"
                  >
                    <div>
                      <p className="text-st-body font-semibold text-ink">{product.name}</p>
                      <p className="text-st-overline font-bold uppercase tracking-wider text-brand-amber">
                        {product.categoryName}
                      </p>
                      <p className="mt-1 font-mono text-st-body font-bold tabular-nums text-ink">
                        {formatCurrency(product.price, currency)}
                      </p>
                    </div>

                    {product.requiresOptions ? (
                      // No se puede vender de un toque: la carta obliga a elegir. Sin botón que mienta.
                      <p className="text-st-caption font-medium text-ink-secondary">Se elige en la carta</p>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 w-full"
                        aria-label={`Agregar ${product.name} a la venta`}
                        onClick={() => addProduct(product)}
                      >
                        Agregar
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            className="h-fit space-y-3 rounded-stitch-xl border border-line-subtle bg-surface-card p-4"
            aria-label="Venta en curso"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-st-h2 text-ink">Venta en curso</h2>
              <p className="text-st-caption font-semibold uppercase tracking-wide text-ink-secondary">
                {draft.lines.length === 0
                  ? "Sin productos"
                  : `${draft.lines.length} ${draft.lines.length === 1 ? "producto" : "productos"}`}
              </p>
            </div>

            {draft.lines.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-low">
                  <ShoppingCart aria-hidden="true" className="h-6 w-6 text-ink-muted" />
                </span>
                <p className="max-w-56 text-st-body text-ink-secondary">
                  Agregá productos del catálogo para armar la venta.
                </p>
              </div>
            ) : (
              <ul className="space-y-3" aria-label="Productos de la venta">
                {draft.lines.map((line) => (
                  <li
                    key={`${line.productId}-${line.notes ?? ""}`}
                    className="flex items-center justify-between gap-3 border-b border-line-subtle pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-st-body font-medium text-ink">{line.name}</p>
                      <p className="font-mono text-st-caption tabular-nums text-ink-secondary">
                        {formatCurrency(line.unitPrice, currency)} × {line.quantity}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="min-h-11 min-w-11"
                        aria-label={`Quitar una unidad de ${line.name}`}
                        onClick={() =>
                          setDraft((current) =>
                            setPosLineQuantity(current, line.productId, line.quantity - 1),
                          )
                        }
                      >
                        −
                      </Button>
                      <span className="w-8 text-center text-st-body font-bold tabular-nums text-ink">
                        {line.quantity}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="min-h-11 min-w-11"
                        aria-label={`Agregar una unidad de ${line.name}`}
                        onClick={() =>
                          setDraft((current) =>
                            setPosLineQuantity(current, line.productId, line.quantity + 1),
                          )
                        }
                      >
                        +
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-11"
                        aria-label={`Sacar ${line.name} de la venta`}
                        onClick={() =>
                          setDraft((current) => removePosLine(current, line.productId))
                        }
                      >
                        Sacar
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <dl className="space-y-1 border-t border-line-subtle pt-3 text-st-body">
              <div className="flex items-baseline justify-between">
                <dt className="text-ink-secondary">Subtotal</dt>
                <dd className="font-mono tabular-nums text-ink">{formatCurrency(totals.subtotal, currency)}</dd>
              </div>
              {totals.packagingAmount > 0 ? (
                <div className="flex items-baseline justify-between">
                  <dt className="text-ink-secondary">Empaque</dt>
                  <dd className="font-mono tabular-nums text-ink">
                    {formatCurrency(totals.packagingAmount, currency)}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between">
                <dt className="font-medium text-ink">Total</dt>
                <dd className="font-mono text-st-display font-bold tabular-nums text-brand-primary" aria-live="polite">
                  {formatCurrency(totals.total, currency)}
                </dd>
              </div>
            </dl>

            {fieldErrors.lines ? (
              <p className="text-st-body font-medium text-status-sla-text">{fieldErrors.lines}</p>
            ) : null}

            <div className="space-y-3 border-t border-line-subtle pt-3">
              <Input
                label="Nombre del cliente"
                value={customer.name}
                error={fieldErrors.name ?? fieldErrors.customerName}
                onChange={(event) =>
                  setCustomer((current) => ({ ...current, name: event.target.value }))
                }
              />
              <Input
                label="Número del cliente"
                inputMode="tel"
                value={customer.whatsapp}
                error={fieldErrors.whatsapp ?? fieldErrors.customerWhatsapp}
                onChange={(event) =>
                  setCustomer((current) => ({ ...current, whatsapp: event.target.value }))
                }
              />
              <Input
                label="Correo (opcional)"
                type="email"
                value={customer.email}
                error={fieldErrors.customerEmail}
                onChange={(event) =>
                  setCustomer((current) => ({ ...current, email: event.target.value }))
                }
              />

              {payments.map((payment, index) => (
                <div key={payment.id} className="space-y-3 rounded-stitch-md border border-line-subtle p-3">
                  {index > 0 ? (
                    <p className="text-st-body font-semibold text-ink">Cobro {index + 1}</p>
                  ) : null}

                  <div className="space-y-1.5">
                    <p className="text-st-body font-medium leading-none text-ink">¿Cómo paga?</p>
                    <div className="flex flex-wrap gap-2">
                      {PAYMENT_METHOD_CHOICES.map((option) => (
                        <Button
                          key={option.id}
                          type="button"
                          size="pill"
                          variant={payment.method === option.id ? "primary" : "secondary"}
                          aria-pressed={payment.method === option.id}
                          onClick={() =>
                            setPayments((current) =>
                              current.map((item) =>
                                item.id === payment.id ? { ...item, method: option.id } : item,
                              ),
                            )
                          }
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {settings.usdExchangeRate !== null ? (
                    <Select
                      label="Moneda del cobro"
                      value={payment.currency}
                      onChange={(event) =>
                        setPayments((current) =>
                          current.map((item) =>
                            item.id === payment.id ? { ...item, currency: event.target.value } : item,
                          ),
                        )
                      }
                      options={[
                        { value: settings.currencyCode, label: settings.currencyCode },
                        { value: "USD", label: "USD" },
                      ]}
                    />
                  ) : null}

                  <Input
                    label={
                      payment.currency === settings.currencyCode
                        ? "Con cuánto paga"
                        : `Con cuánto paga (en ${payment.currency})`
                    }
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={payment.amount}
                    error={fieldErrors.amount ?? fieldErrors.payments}
                    onChange={(event) =>
                      setPayments((current) =>
                        current.map((item) =>
                          item.id === payment.id ? { ...item, amount: event.target.value } : item,
                        ),
                      )
                    }
                  />

                  {payment.method === "transfer" ? (
                    <Input
                      label="Referencia de la transferencia (opcional)"
                      value={payment.reference ?? ""}
                      onChange={(event) =>
                        setPayments((current) =>
                          current.map((item) =>
                            item.id === payment.id ? { ...item, reference: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  ) : null}

                  {index > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11"
                      onClick={() =>
                        setPayments((current) => current.filter((item) => item.id !== payment.id))
                      }
                    >
                      Quitar este cobro
                    </Button>
                  ) : null}
                </div>
              ))}

              {/* Bloque 4: partir el cobro entre medios (efectivo + transferencia, dos tarjetas). */}
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() =>
                  setPayments((current) => [
                    ...current,
                    {
                      id: `pay_${current.length + 1}_${Date.now()}`,
                      method: "transfer",
                      currency: settings.currencyCode,
                      amount: "",
                    },
                  ])
                }
              >
                Partir el cobro
              </Button>

              {payments.length > 1 ? (
                <p className="text-st-body text-ink-secondary">
                  Cobrado{" "}
                  <span className="font-mono tabular-nums text-ink">
                    {formatCurrency(paidTotal, currency)}
                  </span>{" "}
                  de <span className="font-mono tabular-nums">{formatCurrency(totals.total, currency)}</span>
                  . En un cobro partido no hay vuelto.
                </p>
              ) : null}

              {!shift && !shiftLoading ? (
                <p
                  role="status"
                  className="rounded-stitch-lg border border-status-prep-border bg-status-prep-bg px-3 py-2 text-st-body text-status-prep-text"
                >
                  Abrí la caja para poder cobrar: un cobro con la caja cerrada no entra a ningún
                  arqueo.
                </p>
              ) : null}

              <Button
                type="button"
                className="min-h-12 w-full"
                disabled={charging || !shift}
                onClick={() => void charge()}
              >
                {charging ? ("Cobrando…") : (<>Cobrar <span className="font-mono">{formatCurrency(totals.total, currency)}</span></>)}
              </Button>

              {saleError ? (
                <p role="alert" className="text-st-body font-medium text-status-sla-text">
                  {saleError}
                </p>
              ) : null}

              {lastSale ? (
                <div
                  role="status"
                  className="rounded-stitch-lg border border-status-ready-border bg-status-ready-bg px-3 py-2 text-st-body text-status-ready-text"
                >
                  Venta <span className="font-mono">{lastSale.orderNumber}</span> cobrada por <span className="font-mono">{formatCurrency(lastSale.total, currency)}</span>
                  {lastSale.change !== null && lastSale.change > 0
                    ? ` · Cambio ${formatCurrency(lastSale.change, currency)}`
                    : " · Sin cambio"}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={receiptState === "busy"}
                      onClick={() => void sendReceipt()}
                    >
                      {receiptState === "busy" ? "Generando…" : "Enviar recibo"}
                    </Button>
                    {receiptState === "done" ? (
                      <span className="text-st-body">Recibo listo para enviar o imprimir.</span>
                    ) : null}
                    {receiptState === "error" ? (
                      <span className="text-st-body font-medium text-status-sla-text">
                        No se pudo generar el recibo en este dispositivo.
                      </span>
                    ) : null}
                    {/*
                      Bloque 10.1 del roadmap del POS (Fase 2) — el ticket de cocina.
                      Se imprime con la hoja del sistema (decisión: sin dependencia ni impresora de
                      red), en texto plano y **sin importes**: la cocina necesita qué preparar y para
                      cuándo, no cuánto costó.
                    */}
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={() =>
                        openKitchenTicket(
                          {
                            orderNumber: lastSale.orderNumber,
                            // El KDS y el ticket comparten la hora prometida; el POS arma una venta
                            // "lo antes posible", que es lo que el servidor resolvió al crear.
                            pickupTime: new Date().toISOString(),
                            pickupScheduled: false,
                            pickupNotes: null,
                            notes: null,
                            receipt: lastSale.receipt,
                            lines: lastSale.receipt.lines.map((line) => ({
                              name: line.name,
                              quantity: line.quantity,
                              notes: null,
                            })),
                          },
                          {
                            businessName: settings.name,
                            timezone: settings.timezone,
                            locale: settings.locale,
                          },
                        )
                      }
                    >
                      Ticket de cocina
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
