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
import { mustCloseShiftBeforeCharging } from "@/modules/pos/domain/shift-close-policy";
import type {
  PosCatalogCategoryChip,
  PosCatalogProduct,
  PosCatalogView,
} from "@/modules/pos/ports/pos-catalog";
import { hasSelectableModifiers } from "@/modules/menu/domain/modifier-selection";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { describeCouponLabel } from "@/shared/lib/coupon-label";
import { formatCurrency } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";
import { Select } from "@/shared/ui/select";
import { PAYMENT_METHOD_TYPE_LABELS } from "@/modules/orders/domain/order.types";
import {
  renderReceiptJpeg,
  shareOrDownloadReceipt,
  type ReceiptData,
} from "@/shared/lib/receipt-image";
import { AdminEmptyState, AdminPageHeader } from "../_components/admin-operational-ui";
import PosCatalogGrid from "./pos-catalog-grid";
import PosChargePanel from "./pos-charge-panel";
import PosCouponPanel from "./pos-coupon-panel";
import PosCustomerFields from "./pos-customer-fields";
import type { PosCustomerDraft } from "./pos-customer-fields";
import { buildPosFiscalPayload, EMPTY_POS_FISCAL_DRAFT } from "./pos-fiscal-payload";
import PosDiscountPanel, { type AppliedManualDiscount } from "./pos-discount-panel";
import PosHoldsPanel from "./pos-holds-panel";
import PosModifierDialog, { type PosModifierSelection } from "./pos-modifier-dialog";
import PosPaymentRows from "./pos-payment-rows";
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

function catalogUrl(locationId: string) {
  return `/api/admin/pos/catalog?locationId=${encodeURIComponent(locationId)}`;
}

export default function PosClient({
  locations,
  canDiscount = false,
}: {
  locations: PosLocationOption[];
  /**
   * Tarea 9.7 del roadmap del POS (Fase 2) — si esta sesión puede dar un **descuento manual**. Lo resuelve
   * el servidor (`canDiscountPosSale`: owner y manager) y la ruta lo vuelve a comprobar: acá solo decide si
   * el control se muestra.
   */
  canDiscount?: boolean;
}) {  const currency = useCurrencyFormat();
  const settings = useBusinessSettings();

  const [locationId, setLocationId] = React.useState(locations[0]?.id ?? "");
  const [products, setProducts] = React.useState<PosCatalogProduct[]>([]);
  /**
   * Los chips de categoría, con su contador, tal como los devuelve el catálogo (el servidor los arma en
   * `categories`): la pantalla no los agrupa ni los cuenta.
   */
  const [catalogCategories, setCatalogCategories] = React.useState<PosCatalogCategoryChip[]>([]);
  /** La categoría elegida en los chips; `null` es «Todos». */
  const [activeCategoryId, setActiveCategoryId] = React.useState<string | null>(null);
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
  /**
   * Tarea 9.6 del roadmap del POS (Fase 2) — el cupón que el cliente trajo, **cotizado por el servidor**.
   *
   * Se guarda con la **firma de la venta** sobre la que se cotizó: un código aplicado a una venta que
   * después cambió vale para esa venta, no para esta (el descuento se calculó sobre lo que había). Con la
   * firma, la cotización vencida se descarta sola, sin efectos ni estados que se pisen.
   */
  const [coupon, setCoupon] = React.useState<{
    code: string;
    label: string;
    discount: number;
    cartSignature: string;
  } | null>(null);
  const [couponBusy, setCouponBusy] = React.useState(false);
  const [couponError, setCouponError] = React.useState<string | null>(null);
  /**
   * Tarea 9.7 del roadmap del POS (Fase 2) — el descuento manual autorizado, si lo hay. El panel solo se
   * muestra a quien puede darlo y acá se guarda lo que quedó aplicado (forma, motivo y monto).
   */
  const [manualDiscount, setManualDiscount] = React.useState<AppliedManualDiscount | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [customer, setCustomer] = React.useState<PosCustomerDraft>({
    name: "",
    whatsapp: "",
    email: "",
    // Punto 4: la factura con RUC arranca **apagada** (la mayoría de las ventas no llevan factura).
    fiscal: EMPTY_POS_FISCAL_DRAFT,
  });
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
  /**
   * El producto cuyo selector de modificadores está abierto, si hay alguno. La venta se arma con lo que
   * el cajero confirma en el selector: un producto con opciones no entra a la venta sin pasar por ahí.
   */
  const [modifierProduct, setModifierProduct] = React.useState<PosCatalogProduct | null>(null);
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

        // La respuesta es la **vista** del catálogo (el caso de uso del menú + la proyección del POS):
        // los productos ya traen el precio del local en `basePrice` y los agotados. Los chips de
        // categoría (`categories`) llegan en la misma respuesta.
        const body = (await response.json()) as { data: PosCatalogView };
        // Una respuesta de un local que el cajero ya dejó no puede pisar el catálogo del actual.
        if (locationRef.current !== targetLocationId) return;

        // Solo se reemplaza si cambió: refrescar cada 3 s no tiene que re-renderizar la pantalla.
        setProducts((current) =>
          JSON.stringify(current) === JSON.stringify(body.data.products)
            ? current
            : body.data.products,
        );
        setCatalogCategories(body.data.categories);
      } catch (error) {
        if (options.silent) return;

        setProducts([]);
        setCatalogCategories([]);
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
  // hook (que además lo guarda en el dispositivo, Bloque 12.3); acá se renueva el cobro, el cupón y la
  // confirmación.
  React.useEffect(() => {
    setPayments([{ id: "pay_1", method: "cash", currency: settings.currencyCode, amount: "" }]);
    setLastSale(null);
    setCoupon(null);
    setCouponError(null);
    setManualDiscount(null);
  }, [locationId, settings.currencyCode]);

  /** Cambiar de local vuelve a «Todos»: los chips del local anterior ya no describen este catálogo. */
  React.useEffect(() => {
    setActiveCategoryId(null);
  }, [locationId]);

  /** La firma de la venta: si cambia, el cupón cotizado ya no vale para lo que hay en el mostrador. */
  const cartSignature = draft.lines
    .map((line) => `${line.productId}x${line.quantity}`)
    .join("|");
  const appliedCoupon =
    coupon !== null && coupon.cartSignature === cartSignature ? coupon : null;
  const totals = posDraftTotals(
    draft,
    (appliedCoupon?.discount ?? 0) + (manualDiscount?.amount ?? 0),
  );

  /**
   * Tarea 9.6 — pide al servidor cuánto descuenta el código sobre **esta** venta. El descuento lo calcula el
   * servidor con la misma fórmula que el alta y sin consumir el cupón; acá solo se muestra.
   */
  const applyCoupon = async (code: string) => {
    setCouponBusy(true);
    setCouponError(null);

    try {
      const response = await fetch("/api/admin/pos/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          code,
          lines: draft.lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
          })),
        }),
      });

      const body = (await response.json()) as {
        data?: {
          coupon: Parameters<typeof describeCouponLabel>[0];
          discount: number;
        };
        error?: { message?: string; fields?: Record<string, string> };
      };

      if (!response.ok || !body.data) {
        setCoupon(null);
        setCouponError(body.error?.message ?? "No se pudo aplicar el código.");
        return;
      }

      setCoupon({
        code: body.data.coupon.code,
        label: describeCouponLabel(body.data.coupon, currency.symbol),
        discount: body.data.discount,
        cartSignature,
      });
    } catch {
      setCouponError("No se pudo aplicar el código: revisá la conexión.");
    } finally {
      setCouponBusy(false);
    }
  };

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

  /**
   * Agregar un producto a la venta. Si tiene modificadores que preguntar, primero se eligen en el
   * selector: sin ellos el alta rechazaría la venta (y el precio de la línea saldría sin los extras).
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
   * Las líneas de la venta se suman, se restan y se sacan con las reglas del dominio, direccionadas por
   * la **clave de la línea** (`producto + modificadores + nota`): el mismo plato con dos
   * configuraciones distintas son dos líneas y tocar una no puede cambiar la otra.
   */
  const changeLineQuantity = (lineKey: string, quantity: number) =>
    setDraft((current) => setPosLineQuantity(current, lineKey, quantity));
  const removeSaleLine = (lineKey: string) =>
    setDraft((current) => removePosLine(current, lineKey));

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
    setCustomer({ name: "", whatsapp: "", email: "", fiscal: { ...EMPTY_POS_FISCAL_DRAFT } });
    setPayments([{ id: "pay_1", method: "cash", currency: settings.currencyCode, amount: "" }]);
    renewAttemptKey();
    setSaleError(null);
    setFieldErrors({});
  };

  /** Tareas 9.4 y 9.5 — traer de vuelta la venta en espera, con su cliente, su cobro y su clave. */
  const resumeHeldSale = (heldSale: PosHeldSale) => {
    setDraft({ locationId, lines: heldSale.lines });
    // Punto 4: la factura que quedó a medio cargar vuelve con la venta; sin ella, arranca apagada.
    setCustomer({ ...heldSale.customer, fiscal: heldSale.customer.fiscal ?? EMPTY_POS_FISCAL_DRAFT });
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
    /**
     * Punto 4 — la factura con RUC. El servidor valida lo mismo; acá el cajero lo ve junto al campo que
     * falta, en vez de descubrirlo después del viaje.
     */
    const fiscal = buildPosFiscalPayload(customer.fiscal);
    if (!fiscal.ok) problems[fiscal.field] = fiscal.message;
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
            // Punto 4: ya validados arriba; sin factura viajan los dos en null.
            taxId: fiscal.ok ? fiscal.taxId : null,
            legalName: fiscal.ok ? fiscal.legalName : null,
          },
          lines: draft.lines,
          payments: filled.map((payment) => ({
            method: payment.method,
            currency: payment.currency,
            amount: Number(payment.amount),
            ...(payment.reference ? { reference: payment.reference } : {}),
          })),
          idempotencyKey: attemptKey,
          // Tarea 9.6: el código viaja al servidor, que es el que valida, calcula y consume el uso.
          couponCode: appliedCoupon?.code ?? null,
          // Tarea 9.7: el descuento manual viaja como forma y motivo; el monto lo calcula el servidor.
          manualDiscount: manualDiscount
            ? {
                kind: manualDiscount.kind,
                value: manualDiscount.value,
                reason: manualDiscount.reason,
              }
            : null,
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
      setCustomer({ name: "", whatsapp: "", email: "", fiscal: { ...EMPTY_POS_FISCAL_DRAFT } });
      setPayments([{ id: "pay_1", method: "cash", currency: settings.currencyCode, amount: "" }]);
      // La venta se cobró: el cupón ya se consumió y la que venga empieza sin promo ni descuento.
      setCoupon(null);
      setCouponError(null);
      setManualDiscount(null);
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
          <div className="space-y-4">
            <Select
              label="Local"
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
              options={locations.map((location) => ({ value: location.id, label: location.name }))}
            />

            <PosCatalogGrid
              products={products}
              categories={catalogCategories}
              query={query}
              onQueryChange={setQuery}
              activeCategoryId={activeCategoryId}
              onCategorySelect={setActiveCategoryId}
              loading={loading}
              loadError={loadError}
              onRetry={() => setReloadKey((key) => key + 1)}
              currency={currency}
              onAdd={addProduct}
            />
          </div>

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
              {appliedCoupon ? (
                <div className="flex items-baseline justify-between">
                  <dt className="text-ink-secondary">
                    Promo <span className="font-mono">{appliedCoupon.code}</span>
                  </dt>
                  <dd className="font-mono tabular-nums text-brand-primary">
                    {`−${formatCurrency(appliedCoupon.discount, currency)}`}
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
              <PosCustomerFields
                customer={customer}
                setCustomer={setCustomer}
                fieldErrors={fieldErrors}
              />

              <PosPaymentRows
                payments={payments}
                setPayments={setPayments}
                fieldErrors={fieldErrors}
                currencyCode={settings.currencyCode}
                usdExchangeRate={settings.usdExchangeRate}
              />

              {/* Bloque 4: partir el cobro entre medios (efectivo + transferencia, dos tarjetas). */}              <Button
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

              {/* Tarea 9.6: el cupón del cliente, cotizado por el servidor antes de cobrar. */}
              <PosCouponPanel
                applied={
                  appliedCoupon
                    ? {
                        code: appliedCoupon.code,
                        label: appliedCoupon.label,
                        discount: appliedCoupon.discount,
                      }
                    : null
                }
                stale={coupon !== null && appliedCoupon === null}
                busy={couponBusy}
                error={couponError}
                currency={currency}
                onApply={(code) => void applyCoupon(code)}
                onRemove={() => {
                  setCoupon(null);
                  setCouponError(null);
                }}
              />

              {/* Tarea 9.7: el descuento manual, solo para quien puede darlo (owner o manager). */}
              {canDiscount ? (
                <PosDiscountPanel
                  subtotal={totals.subtotal}
                  currency={currency}
                  applied={manualDiscount}
                  onChange={setManualDiscount}
                />
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

      {/*
        El selector de modificadores del mostrador: se monta inline (no en un portal) para heredar el
        alcance oscuro del shell del panel. Los datos vienen del catálogo y la regla, del dominio.
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
