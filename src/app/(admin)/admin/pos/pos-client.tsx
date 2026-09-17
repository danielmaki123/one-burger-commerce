"use client";

import Link from "next/link";
import * as React from "react";

import {
  addPosLine,
  createPosDraft,
  posDraftTotals,
  removePosLine,
  setPosLineQuantity,
} from "@/modules/pos/domain/pos-draft";
import type { PosHeldSale } from "@/modules/pos/domain/pos-holds";
import { POS_PAYMENT_METHODS } from "@/modules/pos/domain/pos-sale";
import { filterPosProducts } from "@/modules/pos/domain/search-pos-products";
import { mustCloseShiftBeforeCharging } from "@/modules/pos/domain/shift-close-policy";
import type { PosCatalogProduct } from "@/modules/pos/ports/pos-catalog";
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
import PosChargePanel from "./pos-charge-panel";
import PosHoldsPanel from "./pos-holds-panel";
import PosSaleLines from "./pos-sale-lines";
import PosTicketButtons from "./pos-ticket-buttons";
import type {
  PosLocationOption,
  PosPaymentDraft,
  PosSaleSummary,
  PosShift,
} from "./pos-types";
import { usePosDraft } from "./use-pos-draft";
import { usePosHolds } from "./use-pos-holds";

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

const CLOSE_SHIFT_FIRST_MESSAGE =
  "Este local exige cerrar la caja todos los días y la caja quedó abierta de otro día: cerrala en «Caja del día» y volvé a cobrar.";

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
 * Tareas 9.4/9.5 — la lista y las etiquetas salen del dominio (`POS_PAYMENT_METHODS`) y del mapa de
 * etiquetas del pedido: estaban escritas acá y en la API por separado. `mixed` no está porque el mixto es
 * un **resultado** de partir el cobro entre dos medios, no algo que el cajero elija.
 */
const PAYMENT_METHOD_CHOICES = POS_PAYMENT_METHODS.map((id) => ({
  id,
  label: PAYMENT_METHOD_TYPE_LABELS[id],
}));

function catalogUrl(locationId: string) {
  return `/api/admin/pos/catalog?locationId=${encodeURIComponent(locationId)}`;
}

export default function PosClient({ locations }: { locations: PosLocationOption[] }) {  const currency = useCurrencyFormat();
  const settings = useBusinessSettings();

  const [locationId, setLocationId] = React.useState(locations[0]?.id ?? "");
  const [products, setProducts] = React.useState<PosCatalogProduct[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const {
    draft,
    setDraft,
    restored: draftRestored,
    attemptKey,
    renewAttemptKey,
    restoreAttemptKey,
  } = usePosDraft(locationId, settings.currencyCode);
  /**
   * Tareas 9.4 y 9.5 del roadmap del POS (Fase 2) — las ventas en espera de este dispositivo.
   *
   * Guardar libera el mostrador cuando el cliente no está listo; retomar la trae completa. La lista vive
   * acá y el trabajo de guardar y leer, en el hook (y en el dominio).
   */
  const { holds, hold, discard, full: holdsFull } = usePosHolds(locationId, settings.currencyCode);
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
  /**
   * Tarea 11 del brief (2026-09-17) — la clave del intento la administra `usePosDraft`: se guarda en el
   * dispositivo junto al borrador y sobrevive a la recarga. Antes vivía acá en memoria y se perdía justo
   * en el caso que importa (el cobro que quedó a medias porque se cortó la red).
   *
   * TASK-305b + tarea 1 del brief (2026-09-17) — la caja del local.
   *
   * El POS **lee** si hay caja abierta (es lo que habilita cobrar, Bloque 9.2) y muestra el estado, pero
   * no la administra: abrir y cerrar se hace en «Caja del día».
   */
  const [shift, setShift] = React.useState<PosShift | null>(null);
  const [shiftLoading, setShiftLoading] = React.useState(true);
  const [receiptState, setReceiptState] = React.useState<"idle" | "busy" | "done" | "error">("idle");
  // El local actual, para que un refresco que llega tarde no pise el catálogo del local nuevo.
  const locationRef = React.useRef(locationId);

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
      } catch {
        // Un error de lectura deja el POS en «sin caja abierta» (no se puede cobrar) sin romper la
        // pantalla: el cajero ve el aviso y el enlace a Caja del día, que es donde se arregla.
        if (options.silent) return;

        setShift(null);
      } finally {
        if (!options.silent) setShiftLoading(false);
      }
    },
    [],
  );

  React.useEffect(() => {
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

  // Cambiar de local empieza una venta nueva: el borrador lleva el local y sus precios y lo resetea el
  // hook (que además lo guarda en el dispositivo, Bloque 12.3); acá se renueva el cobro y la confirmación.
  React.useEffect(() => {
    setPayments([{ id: "pay_1", method: "cash", currency: settings.currencyCode, amount: "" }]);
    setLastSale(null);
  }, [locationId, settings.currencyCode]);

  const visibleProducts = React.useMemo(
    () => filterPosProducts(products, query),
    [products, query],
  );
  const totals = posDraftTotals(draft);

  /**
   * Tarea 3 del brief (2026-09-17) — cierre obligatorio por sucursal (1.7).
   *
   * Si el local lo exige y la caja abierta es de **otro día del negocio**, no se cobra hasta cerrarla: el
   * POS lo dice con su motivo y el botón queda bloqueado (la regla pura vive en
   * `shift-close-policy.ts`, con la zona del negocio).
   */
  const shiftOverdue = mustCloseShiftBeforeCharging({
    requireShiftClose:
      locations.find((location) => location.id === locationId)?.requireShiftClose ?? false,
    openedAt: shift?.openedAt ?? null,
    now: new Date(),
    timezone: settings.timezone,
  });

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

  /** Las líneas de la venta se suman, se restan y se sacan con las reglas del dominio. */
  const changeLineQuantity = (productId: string, quantity: number) =>
    setDraft((current) => setPosLineQuantity(current, productId, quantity));
  const removeSaleLine = (productId: string) =>
    setDraft((current) => removePosLine(current, productId));

  /**
   * Tareas 9.4 y 9.5 del roadmap del POS (Fase 2) — dejar la venta en curso a un lado.
   *
   * Se guarda **todo** lo que el cajero armó —productos, cliente y cobros— junto con la **clave del
   * intento**: si la dejó en espera después de un cobro que quedó a medias (se cortó la red), volver a
   * cobrarla tiene que seguir siendo la misma operación para el servidor. Después se limpia el mostrador
   * —el próximo cliente ya puede empezar— y la venta que venga estrena su propia clave.
   */
  const holdCurrentSale = () => {
    hold({
      lines: draft.lines,
      customer,
      payments: payments.map((payment) => ({
        method: payment.method,
        currency: payment.currency,
        amount: payment.amount,
        ...(payment.reference ? { reference: payment.reference } : {}),
      })),
      attemptKey,
    });

    setDraft(createPosDraft(locationId));
    setCustomer({ name: "", whatsapp: "", email: "" });
    setPayments([{ id: "pay_1", method: "cash", currency: settings.currencyCode, amount: "" }]);
    renewAttemptKey();
    setSaleError(null);
    setFieldErrors({});
  };

  /** Tareas 9.4 y 9.5 — traer de vuelta la venta en espera, con su cliente, su cobro y su clave. */
  const resumeHeldSale = (heldSale: PosHeldSale) => {
    setDraft({ locationId, lines: heldSale.lines });
    setCustomer(heldSale.customer);
    setPayments(
      heldSale.payments.length === 0
        ? [{ id: "pay_1", method: "cash", currency: settings.currencyCode, amount: "" }]
        : heldSale.payments.map((payment, index) => ({ ...payment, id: `pay_${index + 1}` })),
    );
    // La espera trae el intento con el que se armó; un guardado viejo sin clave usa la que ya está (nueva).
    if (heldSale.attemptKey) restoreAttemptKey(heldSale.attemptKey);
    discard(heldSale.id);
    setSaleError(null);
    setFieldErrors({});
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
        // La hora del cobro queda fija acá: los tickets llevan la hora de la venta, no la de la
        // impresión (el cajero puede imprimir el de cliente un rato después).
        chargedAt: new Date().toISOString(),
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
      // La operación se resolvió (cobrada o reconocida): la venta que venga es otra y necesita su clave.
      renewAttemptKey();
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
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${
                shift ? "bg-status-ready-dot" : "bg-status-inactive-dot"
              }`}
            />
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

            {/* Tarea 1 del brief (2026-09-17): la caja se abre y se cierra en «Caja del día», no acá. */}
            <Link
              href="/admin/cash"
              className="inline-flex min-h-11 items-center text-st-body font-semibold text-brand-primary underline"
            >
              {shift ? "Ver la caja" : "Abrir la caja"}
            </Link>
          </div>
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

            <PosSaleLines
              lines={draft.lines}
              currency={currency}
              onChangeQuantity={changeLineQuantity}
              onRemove={removeSaleLine}
            />

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

              {/*
                Bloque 12.3/12.4 del roadmap del POS (Fase 2): el cobro, con el aviso de caja cerrada, el
                de **sin conexión** (con el botón bloqueado: un cobro que no se registra es un pedido
                perdido) y el de la venta recuperada del dispositivo.
              */}
              <PosChargePanel
                needsOpenShift={!shift && !shiftLoading}
                canCharge={Boolean(shift)}
                blockedReason={shiftOverdue ? CLOSE_SHIFT_FIRST_MESSAGE : null}
                total={totals.total}
                currency={currency}
                charging={charging}
                saleError={saleError}
                restoredSale={draftRestored}
                onCharge={() => void charge()}
              />

              {/*
                Tareas 9.4/9.5 del roadmap del POS (Fase 2): dejar la venta a un lado y retomarla. Está al
                lado del cobro —donde el cajero decide— y no en otra pantalla: la espera aparece ahí mismo.
              */}
              <PosHoldsPanel
                locationId={locationId}
                holds={holds}
                full={holdsFull}
                saleInProgress={draft.lines.length > 0}
                currency={currency}
                onHold={holdCurrentSale}
                onResume={resumeHeldSale}
                onDiscard={(heldSale) => discard(heldSale.id)}
              />

              {lastSale ? (
                <div
                  role="status"
                  className="rounded-stitch-lg border border-status-ready-border bg-status-ready-bg px-3 py-2 text-st-body text-status-ready-text"
                >
                  Venta <span className="font-mono">{lastSale.orderNumber}</span> cobrada por <span className="font-mono">{formatCurrency(lastSale.total, currency)}</span>
                  {lastSale.change !== null && lastSale.change > 0
                    ? ` · Cambio ${formatCurrency(lastSale.change, currency)}`
                    : " · Sin cambio"}

                  {/* Tarea 11 del brief (2026-09-17): el reintento de un cobro que sí llegó al servidor.
                      Se dice con todas las letras porque lo que viene después es volver a cobrar. */}
                  {lastSale.reused ? (
                    <p className="mt-1 font-semibold">
                      Esa venta ya estaba registrada con esta clave: no se cobró de nuevo.
                    </p>
                  ) : null}

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
                      Bloque 10.1/10.2 del roadmap del POS (Fase 2) — los dos papeles de la venta:
                      el de cocina (sin importes) y el del cliente (el comprobante con precios, total
                      y con qué pagó). Se imprimen con la hoja del sistema, en texto plano: sin
                      dependencia ni impresora de red, que es la decisión para este bloque.
                    */}
                    <PosTicketButtons sale={lastSale} />
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
