"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { formatTodayHours } from "@/modules/business-settings/domain/business-hours-format";
import { resolveOrderAcceptance } from "@/modules/business-settings/domain/order-acceptance";
import {
  buildPickupSlots,
  soonestPickupTime,
  type PickupSlot,
} from "@/modules/business-settings/domain/pickup-slots";
import { useCart } from "@/shared/lib/cart";
import { upsertDeviceOrder } from "@/shared/lib/device-orders";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import { calculateOrderTotals } from "@/shared/lib/order-totals";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { WhatsAppInput } from "@/shared/ui/whatsapp-input";

import { EmptyCartState } from "../_components/empty-cart-state";
import { OrderSummaryCard } from "../_components/order-summary-card";
import {
  extractCheckoutErrorMessage,
  formatPickupTimeIso,
  formatPublicOrderStatus,
  readAcceptanceReason,
} from "./checkout-helpers";
import { PickupScheduleField } from "./pickup-schedule-field";
import { resolveWhatsappDefaultPrefix } from "@/shared/lib/whatsapp-input-value";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type OrderPaymentMethod,
} from "@/modules/orders/domain/order.types";
import { calculateOrderChange, validatePaidWithAmount } from "@/modules/orders/domain/payment-change";
import {
  describeCouponLabel,
  estimateCouponDiscount,
  type AppliedCoupon,
} from "./coupon-helpers";
import {
  getPublicCheckoutMobileActionClassName,
  publicCheckoutScaleClasses,
} from "./checkout-scale-helpers";

type OrderCreateResponse = {
  data: {
    id: string;
    orderNumber?: string;
    type?: string;
    status?: string;
    total?: number;
    packagingAmount?: number;
    tipAmount?: number;
    tipRate?: number | null;
    discount?: number;
    subtotal?: number;
    deliveryFeeAmount?: number;
    createdAt?: string;
    updatedAt?: string;
    orderLookupToken?: string;
  };
};

const ORDER_TYPE = "pickup";

const FIELD_IDS = {
  customerName: "checkout-customer-name",
  customerWhatsapp: "checkout-customer-whatsapp",
  items: "checkout-error",
} as const;

type CheckoutField = keyof typeof FIELD_IDS;

type FieldError = { field: CheckoutField; message: string } | null;

export function focusCheckoutField(field: CheckoutField): void {
  if (typeof document === "undefined") return;

  document.getElementById(FIELD_IDS[field])?.focus();
}

export default function CheckoutPage() {
  const router = useRouter();
  const settings = useBusinessSettings();
  const currency = useCurrencyFormat();
  const { items, subtotal, clearCart } = useCart();

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  // La propina configurada manda: si está apagada, el checkbox no se muestra.
  const tipEnabled = settings.tipEnabled;
  const tipRate = settings.tipRate;
  const [tipOptIn, setTipOptIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Código de promo (T9b): lo valida el servidor antes de confirmar el pedido.
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<FieldError>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    customerName: "",
    customerWhatsapp: "",
    pickupTime: "",
    pickupNotes: "",
    // Se cobra en el local: lo más probable es efectivo, y el cliente puede cambiarlo.
    paymentMethod: "cash" as OrderPaymentMethod,
    // "¿Con cuánto pagás?" (T12): vacío = no lo dijo.
    paidWithAmount: "",
    // Código de promo (T9b): vacío = sin código.
    couponCode: "",
  });

  // El "ahora" se resuelve después de montar: en el servidor y en el cliente daría
  // horas distintas y el HTML no coincidiría al hidratar.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  const pickupSlots = useMemo(() => {
    if (!now) return null;

    return buildPickupSlots({
      businessHours: settings.businessHours,
      timezone: settings.timezone,
      pickupLeadMinutes: settings.pickupLeadMinutes,
      now,
    });
  }, [now, settings.businessHours, settings.timezone, settings.pickupLeadMinutes]);

  /** Turnos que ofrece el local hoy. Programar es opcional: sin elegir nada, el pedido
   *  se prepara apenas llega. */
  const pickupOptions: PickupSlot[] = useMemo(
    () => (pickupSlots?.available ? pickupSlots.slots : []),
    [pickupSlots],
  );

  /** Hora que mostrará "lo antes posible". El servidor recalcula la suya al recibir el
   *  pedido, así que esto es solo para que el cliente sepa qué esperar. */
  const asapPickupTime = useMemo(() => {
    if (!now) return "";

    return soonestPickupTime({
      now,
      timezone: settings.timezone,
      pickupLeadMinutes: settings.pickupLeadMinutes,
    });
  }, [now, settings.timezone, settings.pickupLeadMinutes]);

  

  const scheduledPickupDate = useMemo(() => {
    if (!formData.pickupTime) return null;

    const iso = formatPickupTimeIso(formData.pickupTime);
    return iso ? new Date(iso) : null;
  }, [formData.pickupTime]);

  /**
   * La misma regla que aplica el servidor, evaluada con el reloj del cliente.
   *
   * Antes el checkout se bloqueaba cuando no quedaban turnos de la grilla, que es más
   * estricto que la regla real: con cierre a las 22:00 y 25 min de preparación, a las
   * 21:20 ya no hay turnos pero el pedido entra 21:45 y el servidor lo acepta. La
   * decisión que vale sigue siendo la del servidor; esto es para no ofrecer un botón
   * que va a fallar.
   */
  const acceptance = useMemo(() => {
    if (!now) return null;

    return resolveOrderAcceptance({
      isAcceptingOrders: settings.isAcceptingOrders,
      closedMessage: settings.closedMessage,
      businessHours: settings.businessHours,
      timezone: settings.timezone,
      pickupLeadMinutes: settings.pickupLeadMinutes,
      now,
      pickupTime: scheduledPickupDate,
    });
  }, [
    now,
    settings.isAcceptingOrders,
    settings.closedMessage,
    settings.businessHours,
    settings.timezone,
    settings.pickupLeadMinutes,
    scheduledPickupDate,
  ]);

  const orderingBlocked = acceptance !== null && !acceptance.accepted;
  const orderingBlockedMessage =
    acceptance && !acceptance.accepted ? acceptance.message : "";
  const todayHours = formatTodayHours(settings.businessHours, new Date(), settings.timezone);

  /**
   * Dónde se retira (T5). Sale de `/admin/settings`: si el negocio no cargó
   * dirección, la fila no se dibuja en vez de mostrar un hueco.
   */
  const pickupAddress = [settings.addressLine, settings.addressReference, settings.city]
    .filter(Boolean)
    .join(", ");

  // El prefijo del WhatsApp sale del teléfono del negocio (T5), no de un literal.
  const defaultWhatsappPrefix = resolveWhatsappDefaultPrefix(settings.phone);

  useEffect(() => {
    if (submitError) errorRef.current?.focus();
  }, [submitError]);

  const packagingItems = useMemo(
    () => items.map((item) => ({ packagingTotalAmount: item.packagingTotalAmount })),
    [items],
  );
  const estimatedTotals = useMemo(
    () =>
      calculateOrderTotals({
        subtotal,
        discount: 0,
        deliveryFeeAmount: 0,
        items: packagingItems,
        tipOptIn: tipOptIn && tipEnabled,
        orderType: ORDER_TYPE,
        tipRate,
      }),
    [packagingItems, subtotal, tipOptIn, tipEnabled, tipRate],
  );
  const tipPreviewAmount = useMemo(
    () =>
      calculateOrderTotals({
        subtotal,
        discount: 0,
        deliveryFeeAmount: 0,
        items: packagingItems,
        tipOptIn: true,
        orderType: ORDER_TYPE,
        tipRate,
      }).tipAmount,
    [packagingItems, subtotal, tipRate],
  );

  const totalLabel = formatCurrency(estimatedTotals.total, currency);

  /**
   * Vuelto (T12): el monto es opcional y solo se ofrece en efectivo. Se valida acá
   * para avisar antes de mandar, y el servidor lo vuelve a validar contra el total.
   */
  const paidWithNumber =
    formData.paidWithAmount.trim() === "" ? null : Number(formData.paidWithAmount);
  const paidWithError = validatePaidWithAmount({
    paidWithAmount:
      paidWithNumber !== null && Number.isFinite(paidWithNumber) ? paidWithNumber : null,
    total: estimatedTotals.total,
    paymentMethod: formData.paymentMethod,
  });
  const paidWithChange =
    paidWithError === null && paidWithNumber !== null
      ? calculateOrderChange({ paidWithAmount: paidWithNumber, total: estimatedTotals.total })
      : null;

  /**
   * Código de promo (T9b).
   *
   * El servidor dice si el código sirve y devuelve su forma pública; el descuento
   * definitivo lo aplica al crear el pedido. Para porcentaje y monto fijo se puede
   * estimar acá; para las promos por cantidad no se inventa un número.
   */
  async function handleApplyCoupon() {
    const code = formData.couponCode.trim();
    if (!code) return;

    setIsApplyingCoupon(true);
    setCouponError(null);
    setAppliedCoupon(null);

    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setCouponError(payload?.error?.message ?? "No pudimos verificar ese código.");
        return;
      }

      const payload = (await res.json()) as { data: AppliedCoupon };
      setAppliedCoupon(payload.data);
    } catch {
      setCouponError("No pudimos verificar ese código.");
    } finally {
      setIsApplyingCoupon(false);
    }
  }

  function handleClearCoupon() {
    setAppliedCoupon(null);
    setCouponError(null);
    setFormData((prev) => ({ ...prev, couponCode: "" }));
  }

  const appliedCouponLabel = appliedCoupon
    ? describeCouponLabel(appliedCoupon, settings.currencySymbol)
    : null;
  const appliedCouponDiscount = appliedCoupon
    ? estimateCouponDiscount({ coupon: appliedCoupon, subtotal })
    : null;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Al corregir el campo, el aviso desaparece: no se queda pegado.
    setFieldError((prev) => (prev?.field === name ? null : prev));
  };

  const validate = (): FieldError => {
    if (items.length === 0) return { field: "items", message: "El carrito está vacío." };
    if (!formData.customerName.trim()) {
      return { field: "customerName", message: "Falta completar nombre." };
    }
    if (!formData.customerWhatsapp.trim()) {
      return { field: "customerWhatsapp", message: "Falta completar WhatsApp." };
    }
    // La hora de retiro es opcional: vacío es "lo antes posible" y lo resuelve el
    // servidor con su reloj. No se valida porque los valores solo pueden salir de los
    // turnos que ofrece el propio control.

    return null;
  };

  const handlePlaceOrder = async () => {
    // El botón nunca está deshabilitado por datos faltantes: al tocar, se señala el
    // campo que falta y se lo enfoca. Antes quedaba un botón inerte que parecía activo.
    const validationError = validate();
    if (validationError) {
      setSubmitError(null);
      setFieldError(validationError);
      focusCheckoutField(validationError.field);
      return;
    }

    setFieldError(null);
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        type: ORDER_TYPE,
        customerName: formData.customerName.trim(),
        customerWhatsapp: formData.customerWhatsapp,
        tipOptIn,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          modifierOptionIds: item.modifierOptionIds,
          notes: item.notes,
        })),
        // Forma de pago declarada (T11): informativa, se cobra en el local.
        paymentMethod: formData.paymentMethod,
      };

      // El vuelto solo viaja si el cliente dijo con cuánto paga y es efectivo (T12).
      if (formData.paymentMethod === "cash" && paidWithNumber !== null && !paidWithError) {
        payload.paidWithAmount = paidWithNumber;
      }

      // El código viaja aunque no se haya tocado "Aplicar" (T9b): el servidor es el
      // que decide, y así el checkout no puede bloquear una promo válida.
      if (formData.couponCode.trim()) {
        payload.couponCode = formData.couponCode.trim();
      }

      // Sin hora = sin programar. No se manda nada y el servidor completa con
      // "ahora + preparación" usando su reloj, así un formulario lento no convierte
      // la hora en una del pasado.
      const pickupTime = formatPickupTimeIso(formData.pickupTime);
      if (pickupTime) payload.pickupTime = pickupTime;
      if (formData.pickupNotes.trim()) payload.pickupNotes = formData.pickupNotes.trim();

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const result = (await res.json()) as OrderCreateResponse;
        const order = result.data;
        if (
          order.orderNumber &&
          order.type &&
          order.status &&
          order.total !== undefined
        ) {
          upsertDeviceOrder({
            orderNumber: order.orderNumber,
            type: "pickup",
            status: order.status,
            statusLabel: formatPublicOrderStatus(order.status),
            updatedAt: order.updatedAt ?? order.createdAt ?? new Date().toISOString(),
            subtotal: order.subtotal,
            discount: order.discount,
            packagingAmount: order.packagingAmount,
            deliveryFeeAmount: order.deliveryFeeAmount,
            tipAmount: order.tipAmount,
            tipRate: order.tipRate ?? null,
            createdAt: order.createdAt,
            total: order.total,
            lastCheckedAt: new Date().toISOString(),
            stale: false,
            orderLookupToken: order.orderLookupToken,
          });
        }
        clearCart();
        const tokenQuery = order.orderLookupToken
          ? `?token=${encodeURIComponent(order.orderLookupToken)}`
          : "";
        router.push(`/success/${order.id}${tokenQuery}`);
      } else {
        const errorPayload = await res.json().catch(() => null);
        setSubmitError(extractCheckoutErrorMessage(errorPayload));

        // Si la hora programada quedó vieja mientras el cliente llenaba el formulario,
        // se vuelve a "lo antes posible" en vez de dejarlo reintentando con una hora
        // que el servidor ya no va a aceptar.
        if (readAcceptanceReason(errorPayload) === "pickup-time-in-past") {
          setFormData((prev) => ({ ...prev, pickupTime: "" }));
        }
      }
    } catch {
      setSubmitError("No pudimos confirmar el pedido. Intentá de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return <EmptyCartState />;
  }

  const confirmLabel = isSubmitting ? "Procesando..." : `Confirmar pedido • ${totalLabel}`;

  return (
    <div className="min-h-screen brand-canvas px-4 py-7 pb-[calc(8.5rem+env(safe-area-inset-bottom))] md:pb-10 lg:pb-8">
      <div className={publicCheckoutScaleClasses.layoutShell}>
        <div className="space-y-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <h1
              className={publicCheckoutScaleClasses.pageHeading}
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Confirmá tu pedido
            </h1>
            <Button
              variant="ghost"
              className="h-10 justify-center rounded-full border border-border bg-card/85 px-4 text-sm font-semibold text-foreground"
              onClick={() => router.push("/cart")}
            >
              Editar carrito
            </Button>
          </header>

          <section className={publicCheckoutScaleClasses.formSection}>
            <div className="space-y-5">
              <div className="space-y-2">
                <Input
                  id={FIELD_IDS.customerName}
                  name="customerName"
                  label="Nombre completo"
                  value={formData.customerName}
                  onChange={handleInputChange}
                  placeholder="Ej. María López"
                  error={
                    fieldError?.field === "customerName" ? fieldError.message : undefined
                  }
                />
              </div>

              <WhatsAppInput
                id={FIELD_IDS.customerWhatsapp}
                name="customerWhatsapp"
                value={formData.customerWhatsapp}
                defaultPrefix={defaultWhatsappPrefix}
                onChange={(value) =>
                  handleInputChange({
                    target: { name: "customerWhatsapp", value },
                  } as React.ChangeEvent<HTMLInputElement>)
                }
                error={
                  fieldError?.field === "customerWhatsapp" ? fieldError.message : undefined
                }
              />

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Hora de retiro</p>
                {orderingBlocked ? (
                  <p
                    role="status"
                    className="rounded-2xl border border-border bg-cream/60 p-3 text-sm leading-5 text-foreground"
                  >
                    {orderingBlockedMessage}
                  </p>
                ) : (
                  <PickupScheduleField
                    scheduledTime={formData.pickupTime}
                    onSelect={(value) =>
                      setFormData((prev) => ({ ...prev, pickupTime: value }))
                    }
                    asapValue={asapPickupTime}
                    pickupLeadMinutes={settings.pickupLeadMinutes}
                    pickupMaxMinutes={settings.pickupMaxMinutes}
                    options={pickupOptions}
                    todayHours={todayHours}
                  />
                )}
              </div>

              {pickupAddress ? (
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                  <span aria-hidden="true" className="text-base text-brand">
                    📍
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium text-foreground">Retirás en</p>
                    <p className="text-muted-foreground">{pickupAddress}</p>
                  </div>
                  {settings.mapsUrl ? (
                    <a
                      href={settings.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-11 shrink-0 items-center rounded-xl px-2 text-sm font-semibold text-brand"
                    >
                      Cómo llegar
                    </a>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">¿Tenés un código de promo?</p>
                <div className="flex items-start gap-2">
                  <Input
                    name="couponCode"
                    label="Código de promo"
                    value={formData.couponCode}
                    onChange={handleInputChange}
                    placeholder="Ej. B2G1"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 shrink-0"
                    disabled={isApplyingCoupon || formData.couponCode.trim() === ""}
                    onClick={() => void handleApplyCoupon()}
                  >
                    {isApplyingCoupon ? "Verificando…" : "Aplicar"}
                  </Button>
                </div>
                {couponError ? (
                  <p role="alert" className="text-xs font-medium text-danger-foreground">
                    {couponError}
                  </p>
                ) : null}
                {appliedCoupon ? (
                  <p role="status" className="text-xs font-medium text-success-foreground">
                    Código {appliedCoupon.code} aplicado · {appliedCouponLabel}
                    {appliedCouponDiscount !== null
                      ? ` (−${formatCurrency(appliedCouponDiscount, currency)})`
                      : " (el descuento se calcula al confirmar)"}
                    <button
                      type="button"
                      onClick={handleClearCoupon}
                      className="ml-2 font-semibold underline"
                    >
                      Quitar
                    </button>
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">¿Cómo vas a pagar?</p>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((method) => {
                    const checked = formData.paymentMethod === method;

                    return (
                      <label
                        key={method}
                        className={`relative flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background ${
                          checked
                            ? "border-brand bg-brand text-brand-foreground"
                            : "border-border bg-card text-foreground"
                        }`}
                      >
                        {/*
                          El input cubre la tarjeta con opacidad 0 en vez de `sr-only`:
                          sigue siendo un radio nativo (teclado y lector de pantalla) pero
                          además es clickeable y automatizable. Con `sr-only` queda sin caja
                          y las herramientas terminan clickeando la etiqueta de costado.
                        */}
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method}
                          checked={checked}
                          onChange={() =>
                            setFormData((prev) => ({ ...prev, paymentMethod: method }))
                          }
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                        {PAYMENT_METHOD_LABELS[method]}
                      </label>
                    );
                  })}
                </div>

                {formData.paymentMethod === "cash" ? (
                  <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
                    <Input
                      name="paidWithAmount"
                      label="¿Con cuánto vas a pagar? (opcional)"
                      inputMode="decimal"
                      value={formData.paidWithAmount}
                      onChange={handleInputChange}
                      placeholder="Ej. 600"
                      error={paidWithError ?? undefined}
                    />
                    {paidWithChange !== null && !paidWithError ? (
                      <p className="text-xs text-muted-foreground">
                        Cambio estimado: {formatCurrency(paidWithChange, currency)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Si lo completás, la caja te prepara el vuelto.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <Input
                  name="pickupNotes"
                  label="Notas para retiro"
                  value={formData.pickupNotes}
                  onChange={handleInputChange}
                  placeholder="Ej. Paso por ella en carro gris"
                />
              </div>
            </div>
          </section>

          {submitError ? (
            <div
              id={FIELD_IDS.items}
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {submitError}
            </div>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <OrderSummaryCard
            items={items}
            itemCount={itemCount}
            subtotal={subtotal}
            packagingAmount={estimatedTotals.packagingAmount}
            tipAmount={estimatedTotals.tipAmount}
            tipRate={estimatedTotals.tipRate ?? tipRate}
          >
            {tipEnabled ? (
              <div className="rounded-[20px] border border-border bg-cream/50 p-4">
                <Checkbox
                  checked={tipOptIn}
                  onChange={(event) => setTipOptIn(event.target.checked)}
                  label={`Agregar propina del ${tipRate}% (${formatCurrency(tipPreviewAmount, currency)})`}
                />
                <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                  Es opcional. Si no la marcás, no se cobra propina.
                </p>
              </div>
            ) : null}

            {/* Un solo CTA visible por viewport: acá el de escritorio, abajo el de móvil. */}
            <div className="hidden lg:block">
              <Button
                className={publicCheckoutScaleClasses.primaryCta}
                onClick={handlePlaceOrder}
                disabled={isSubmitting || orderingBlocked}
              >
                {confirmLabel}
              </Button>
            </div>
          </OrderSummaryCard>
        </aside>
      </div>

      {/* Un solo CTA visible por viewport: acá el de móvil, arriba el de escritorio.
          Sin fila de total aparte: el importe ya viaja en la etiqueta del botón. */}
      <div className={getPublicCheckoutMobileActionClassName()}>
        <div className="mx-auto w-full max-w-2xl">
          <Button
            className={publicCheckoutScaleClasses.primaryCta}
            onClick={handlePlaceOrder}
            disabled={isSubmitting || orderingBlocked}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
