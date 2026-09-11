"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { formatTodayHours } from "@/modules/business-settings/domain/business-hours-format";
import {
  buildPickupSlots,
  formatSlotLabel,
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
} from "./checkout-helpers";
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
  pickupTime: "checkout-pickup-time",
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<FieldError>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    customerName: "",
    customerWhatsapp: "",
    pickupTime: "",
    pickupNotes: "",
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

  /**
   * Si el local está cerrado o ya no quedan turnos del día, el pedido **no se bloquea**
   * (bloquearlo es una decisión de producto aparte y necesita validación en el servidor):
   * se avisa y se ofrece la hora calculada más próxima.
   */
  const pickupOptions: PickupSlot[] = useMemo(() => {
    if (!pickupSlots) return [];

    if (pickupSlots.available) return pickupSlots.slots;

    const fallback = soonestPickupTime({
      now: now ?? new Date(),
      timezone: settings.timezone,
      pickupLeadMinutes: settings.pickupLeadMinutes,
    });

    return [{ value: fallback, label: formatSlotLabel(fallback), isSoonest: true }];
  }, [pickupSlots, now, settings.timezone, settings.pickupLeadMinutes]);

  const pickupClosed = pickupSlots !== null && !pickupSlots.available;
  const todayHours = formatTodayHours(settings.businessHours, new Date(), settings.timezone);

  // Preselecciona el primer turno apenas se conocen los del día.
  useEffect(() => {
    if (pickupOptions.length === 0) return;

    setFormData((prev) =>
      prev.pickupTime ? prev : { ...prev, pickupTime: pickupOptions[0].value },
    );
  }, [pickupOptions]);

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
    if (!formData.pickupTime.trim()) {
      return { field: "pickupTime", message: "Elegí la hora de retiro." };
    }
    if (!formatPickupTimeIso(formData.pickupTime)) {
      return { field: "pickupTime", message: "Revisá la hora de retiro." };
    }

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
      };

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
                <p className="text-sm font-medium text-foreground">
                  Hora de retiro{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    · {todayHours}
                  </span>
                </p>
                {pickupOptions.length > 0 ? (
                  <div
                    id={FIELD_IDS.pickupTime}
                    tabIndex={-1}
                    className="flex flex-wrap gap-2 focus:outline-none"
                  >
                    {pickupOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          handleInputChange({
                            target: { name: "pickupTime", value: option.value },
                          } as React.ChangeEvent<HTMLInputElement>)
                        }
                        aria-pressed={formData.pickupTime === option.value}
                        className={`min-h-11 rounded-full border px-3 py-2 text-sm ${
                          formData.pickupTime === option.value
                            ? "border-brand bg-accent font-semibold text-foreground"
                            : "border-border bg-card text-foreground"
                        }`}
                      >
                        {option.isSoonest
                          ? `Lo antes posible · ${option.label}`
                          : option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                {pickupClosed && settings.closedMessage ? (
                  <p className="text-xs leading-5 text-muted-foreground">
                    {settings.closedMessage}
                  </p>
                ) : null}
                {fieldError?.field === "pickupTime" ? (
                  <p className="text-xs font-medium text-red-500">{fieldError.message}</p>
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
                disabled={isSubmitting}
              >
                {confirmLabel}
              </Button>
            </div>
          </OrderSummaryCard>
        </aside>
      </div>

      <div className={getPublicCheckoutMobileActionClassName()}>
        <div className="mx-auto w-full max-w-2xl space-y-1.5">
          <div className="flex items-center justify-between text-sm text-foreground">
            <span>Total a pagar</span>
            <span className="font-bold text-foreground">{totalLabel}</span>
          </div>
          <Button
            className={publicCheckoutScaleClasses.primaryCta}
            onClick={handlePlaceOrder}
            disabled={isSubmitting}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
