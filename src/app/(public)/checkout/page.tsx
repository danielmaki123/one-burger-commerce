"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useCart, type CartItem } from "@/shared/lib/cart";
import { upsertDeviceOrder } from "@/shared/lib/device-orders";
import { formatTodayHours } from "@/modules/business-settings/domain/business-hours-format";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import { calculateOrderTotals } from "@/shared/lib/order-totals";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { WhatsAppInput } from "@/shared/ui/whatsapp-input";
import {
  getPublicCheckoutMobileActionClassName,
  publicCheckoutScaleClasses,
} from "./checkout-scale-helpers";

type OrderType = "pickup";

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

export function getGeoErrorMessage(error?: GeolocationPositionError | null): string {
  if (!error) {
    return "No pudimos obtener tu ubicación. Volvé a intentarlo.";
  }

  if (error.code === error.PERMISSION_DENIED) {
    return "El navegador bloqueó la ubicación. Podés seguir con la dirección escrita o activar el permiso y reintentar.";
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return "No pudimos obtener tu ubicación. Revisá GPS o señal y volvé a intentarlo.";
  }

  if (error.code === error.TIMEOUT) {
    return "La ubicación tardó demasiado en responder. Volvé a intentarlo.";
  }

  return "No pudimos obtener tu ubicación. Volvé a intentarlo.";
}

function time24ToIso(time24: string): string | null {
  const [hh, mm] = time24.split(":").map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;

  const date = new Date();
  date.setHours(hh, mm, 0, 0);
  return date.toISOString();
}

function extractErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "No pudimos confirmar el pedido. Intenta de nuevo.";
  }

  const asRecord = payload as Record<string, unknown>;
  const error = asRecord.error as Record<string, unknown> | undefined;
  const fields = error?.fields as Record<string, unknown> | undefined;

  if (fields?.customerName) return "Falta completar nombre.";
  if (fields?.customerWhatsapp) return "Falta completar WhatsApp.";
  if (fields?.address) return "Falta dirección de entrega.";
  if (fields?.deliveryNotes) return "Falta referencia de entrega.";
  if (fields?.deliveryZoneId) return "Seleccioná una zona de entrega válida.";
  if (fields?.pickupTime) return "Revisa la hora de retiro.";
  if (fields?.tableId) return "Seleccioná tu número de mesa.";
  if (fields?.items) return "El carrito está vacío o incompleto.";

  if (typeof error?.message === "string") {
    if (error.message.toLowerCase().includes("invalid payload")) {
      return "Revisa los datos del pedido.";
    }

    return "No pudimos confirmar el pedido. Intenta de nuevo.";
  }

  return "No pudimos confirmar el pedido. Intenta de nuevo.";
}

function formatPublicOrderStatus(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "new") return "Recibida";
  if (normalized === "confirmed") return "Confirmada";
  if (normalized === "preparing") return "En preparación";
  if (normalized === "ready") return "Lista";
  if (normalized === "ready_for_pickup") return "Lista para retirar";
  if (normalized === "picked_up") return "Retirada";
  if (normalized === "out_for_delivery") return "En camino";
  if (normalized === "delivered") return "Entregada";
  if (normalized === "accepted") return "Aceptada";
  if (normalized === "served") return "Servida";
  if (normalized === "closed") return "Completada";
  if (normalized === "cancelled") return "Cancelada";
  return status;
}

function getCheckoutPlaceholderLabel(productName: string) {
  const words = productName
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) return "OB";

  return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
}

function CheckoutOrderLine({ item }: { item: CartItem }) {
  const currency = useCurrencyFormat();
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(item.imageUrl) && !imageFailed;

  return (
    <div className="rounded-[22px] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(255,251,235,0.74))] p-3 shadow-[0_18px_36px_-30px_rgba(41,37,36,0.7)] ring-1 ring-border">
      <div className="flex items-start gap-3">
        {hasImage ? (
          <img
            src={item.imageUrl}
            alt={item.imageAlt || item.productName}
            className="h-16 w-16 shrink-0 rounded-[18px] object-cover shadow-[0_14px_24px_-18px_rgba(41,37,36,0.7)] ring-1 ring-white"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-[radial-gradient(circle_at_30%_20%,#fff7ed,#f1dfc3_58%,#d7b98b)] text-[10px] font-semibold tracking-[0.16em] text-foreground shadow-[0_14px_24px_-18px_rgba(41,37,36,0.65)] ring-1 ring-white">
            {getCheckoutPlaceholderLabel(item.productName)}
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {item.productName}
              </p>
              <p className="mt-1 text-xs text-foreground">
                {item.quantity}x
                {item.modifiers && item.modifiers.length > 0
                  ? ` · ${item.modifiers
                      .map((modifier) => modifier.optionName)
                      .join(", ")}`
                  : ""}
              </p>
            </div>
            <span className="shrink-0 text-sm font-bold text-foreground">
              {formatCurrency(item.lineTotal, currency)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const PICKUP_TIME_OPTIONS = [
  { value: "asap", label: "Lo antes posible" },
  { value: "19:30", label: "7:30 p. m." },
  { value: "20:00", label: "8:00 p. m." },
  { value: "20:30", label: "8:30 p. m." },
  { value: "21:00", label: "9:00 p. m." },
] as const;

export function CheckoutPickupPanel({
  customerName,
  customerWhatsapp,
  pickupTime,
  pickupNotes,
  totalLabel,
  cartItemCount,
  itemLine,
  itemMeta,
  onChange,
  onSelectPickupTime,
  onSubmit,
  submitting,
  disabled,
}: {
  customerName: string;
  customerWhatsapp: string;
  pickupTime: string;
  pickupNotes: string;
  totalLabel: string;
  cartItemCount: number;
  itemLine: string;
  itemMeta: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectPickupTime: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  disabled: boolean;
}) {
  const settings = useBusinessSettings();
  const todayHours = formatTodayHours(settings.businessHours, new Date(), settings.timezone);
  const leadMinutes = settings.pickupLeadMinutes;

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2
          className={publicCheckoutScaleClasses.pageHeading}
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Confirmá tu pedido
        </h2>
      </header>
      <section className="space-y-4 rounded-[24px] border border-border bg-card/92 p-4">
        <h2 className="text-lg font-semibold text-foreground">Tus datos</h2>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Nombre completo</label>
          <Input
            name="customerName"
            value={customerName}
            onChange={onChange}
            placeholder="Ej. María López"
          />
        </div>
        <div className="space-y-2">
          <WhatsAppInput
            name="customerWhatsapp"
            value={customerWhatsapp}
            onChange={(value) =>
              onChange({
                target: { name: "customerWhatsapp", value },
              } as React.ChangeEvent<HTMLInputElement>)
            }
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Hora de retiro <span className="text-xs font-normal text-muted-foreground">· {todayHours}</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {PICKUP_TIME_OPTIONS.map((option) => {
              const isSelected = pickupTime === option.value || (!pickupTime && option.value === "19:30");
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onSelectPickupTime(option.value)}
                  className={`rounded-full border px-3 py-2 text-sm ${
                    isSelected
                      ? "border-brand bg-accent text-foreground font-semibold"
                      : option.value === "asap"
                        ? "border-[#c9a34f] bg-[#f7e7b3] text-foreground"
                        : "border-border bg-card"
                  }`}
                >
                  {option.value === "asap" && leadMinutes > 0
                    ? `${option.label} · ~${leadMinutes} min`
                    : option.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Notas para retiro</label>
          <Input
            name="pickupNotes"
            value={pickupNotes}
            onChange={onChange}
            placeholder="Ej. Pasó por ella en carro gris"
          />
        </div>
      </section>

      <section className="space-y-4 rounded-[24px] border border-border bg-card/92 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Tu pedido</h2>
          <span className="rounded-full bg-[#efe3d1] px-2.5 py-1 text-[11px] font-semibold text-foreground">
            {cartItemCount} {cartItemCount === 1 ? "item" : "items"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">{itemLine}</div>
            <div className="text-xs text-muted-foreground">{itemMeta}</div>
          </div>
          <span className="text-sm font-bold text-foreground">{totalLabel}</span>
        </div>
        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex justify-between text-sm"><span>Subtotal</span><span>{totalLabel}</span></div>
          <div className="flex justify-between text-sm"><span>Empaque</span><span>C$0.00</span></div>
          <div className="flex justify-between text-base font-bold text-foreground"><span>Total a pagar</span><span>{totalLabel}</span></div>
        </div>
      </section>

      <div className="space-y-2">
        <Button className={publicCheckoutScaleClasses.primaryCta} onClick={onSubmit} disabled={disabled}>
          {submitting ? "Procesando..." : `Confirmar pedido • ${totalLabel}`}
        </Button>
        <p className="text-center text-xs text-foreground">Listo para confirmar ✓</p>
      </div>
    </div>
  );
}

export function CheckoutTablePanel({
  customerName,
  tableValue,
  kitchenNotes,
  tableOptions,
  tablesLoading,
  tablesError,
  itemLine,
  totalLabel,
  onChangeName,
  onChangeTable,
  onChangeNotes,
  onSubmit,
  submitting,
  disabled,
}: {
  customerName: string;
  tableValue: string;
  kitchenNotes: string;
  tableOptions: Array<{ value: string; label: string }>;
  tablesLoading: boolean;
  tablesError: string | null;
  itemLine: string;
  totalLabel: string;
  onChangeName: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onChangeTable: (value: string) => void;
  onChangeNotes: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  submitting: boolean;
  disabled: boolean;
}) {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Paso final</p>
        <p className="text-sm text-foreground">Agregá tu nombre y número de mesa.</p>
      </header>
      <section className="space-y-4 rounded-[24px] border border-border bg-card/92 p-4">
        <h2 className="text-lg font-semibold text-foreground">Tus datos</h2>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Nombre completo</label>
          <Input name="customerName" value={customerName} onChange={onChangeName} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Número de mesa</label>
          {tablesLoading ? (
            <p className="text-sm text-muted-foreground">Cargando mesas...</p>
          ) : (
            <select
              value={tableValue}
              onChange={(event) => onChangeTable(event.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm focus:border-brand focus:outline-none"
            >
              <option value="">Ej. 12</option>
              {tableOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          )}
          {tablesError ? <p className="text-xs text-red-600">{tablesError}</p> : null}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Notas para cocina</label>
          <Input name="deliveryNotes" value={kitchenNotes} onChange={onChangeNotes} placeholder="Aclaraciones para tu pedido" />
        </div>
      </section>

      <section className="space-y-4 rounded-[24px] border border-border bg-card/92 p-4">
        <h2 className="text-lg font-semibold text-foreground">Tu pedido</h2>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-foreground">{itemLine}</span>
          <span className="text-sm font-bold text-foreground">{totalLabel}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-3 text-base font-bold text-foreground">
          <span>Total a pagar</span>
          <span>{totalLabel}</span>
        </div>
      </section>

      <Button className={publicCheckoutScaleClasses.primaryCta} onClick={onSubmit} disabled={disabled}>
        {submitting ? "Procesando..." : `Confirmar pedido • ${totalLabel}`}
      </Button>
    </div>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const settings = useBusinessSettings();
  const currency = useCurrencyFormat();
  const { items, subtotal, clearCart } = useCart();
  const cartItemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const orderType: OrderType = "pickup";
  // La propina configurada manda: si está apagada, el checkbox no se muestra.
  const tipEnabled = settings.tipEnabled;
  const tipRate = settings.tipRate;
  const [tipOptIn, setTipOptIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    customerName: "",
    customerWhatsapp: "",
    // Must match the option the UI renders as selected, otherwise the CTA stays
    // disabled ("Falta hora de retiro") while a time looks chosen.
    pickupTime: "19:30",
    pickupNotes: "",
  });

  const requiresPickupTime = orderType === "pickup";
  const checkoutSubtitle = "";
  const estimatedDeliveryFee = 0;
  const packagingItems = useMemo(
    () => items.map((item) => ({ packagingTotalAmount: item.packagingTotalAmount })),
    [items],
  );
  const estimatedTotals = useMemo(
    () =>
      calculateOrderTotals({
        subtotal,
        discount: 0,
        deliveryFeeAmount: estimatedDeliveryFee,
        items: packagingItems,
        tipOptIn: tipOptIn && tipEnabled,
        orderType,
        tipRate,
      }),
    [orderType, packagingItems, subtotal, tipOptIn, tipEnabled, tipRate],
  );
  const tipPreviewAmount = useMemo(
    () =>
      calculateOrderTotals({
        subtotal,
        discount: 0,
        deliveryFeeAmount: estimatedDeliveryFee,
        items: packagingItems,
        tipOptIn: true,
        orderType,
        tipRate,
      }).tipAmount,
    [estimatedDeliveryFee, orderType, packagingItems, subtotal, tipRate],
  );

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (items.length === 0) return "El carrito está vacío.";
    if (!formData.customerName.trim()) return "Falta completar nombre.";
    if (!formData.customerWhatsapp.trim()) return "Falta completar WhatsApp.";

    if (requiresPickupTime) {
      if (!formData.pickupTime.trim()) return "Falta hora de retiro.";
      if (!time24ToIso(formData.pickupTime)) return "Revisa la hora de retiro.";
    }

    return null;
  };

  const formValidationError = validateForm();
  const ctaHelperText = submitError ?? formValidationError;

  const handlePlaceOrder = async () => {
    const validationError = validateForm();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        type: orderType,
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

      if (orderType === "pickup") {
        payload.pickupTime = time24ToIso(formData.pickupTime);
        payload.pickupNotes = formData.pickupNotes.trim() || undefined;
      }

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
            type:
              order.type === "table"
                ? "table"
                : order.type === "pickup"
                  ? "pickup"
                  : "delivery",
            status: order.status,
            statusLabel: formatPublicOrderStatus(order.status),
            updatedAt:
              order.updatedAt ??
              order.createdAt ??
              new Date().toISOString(),
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
        setSubmitError(extractErrorMessage(errorPayload));
      }
    } catch {
      setSubmitError("No pudimos confirmar el pedido. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream/50 px-4 py-10">
        <Card className="w-full max-w-lg rounded-[28px] border-border/80 bg-card shadow-[0_24px_60px_rgba(28,25,23,0.08)]">
          <CardContent className="space-y-6 p-8 text-center sm:p-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-cream text-brand">
              <svg
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-7 w-7"
              >
                <circle cx="8" cy="21" r="1" />
                <circle cx="19" cy="21" r="1" />
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
              </svg>
            </div>
            <div className="space-y-2">
              <h1
                className="text-3xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Tu carrito está vacío
              </h1>
              <p className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground">
                Agregá productos del menú para armar tu pedido.
              </p>
            </div>
            <Button
              className="h-12 w-full rounded-xl text-base font-semibold sm:h-14"
              onClick={() => router.push("/menu")}
            >
              Ver menú
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(43,108,150,0.07),transparent_55%),linear-gradient(180deg,#fcfaf6_0%,#f4f2ec_100%)] px-4 py-7 pb-[calc(8.5rem+env(safe-area-inset-bottom))] md:pb-10 lg:pb-8">
      <div className={publicCheckoutScaleClasses.layoutShell}>
        <div className="space-y-6">
          <header className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                {orderType !== "pickup" ? (
                  <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">
                    Paso final
                  </p>
                ) : null}
                <h1
                  className={publicCheckoutScaleClasses.pageHeading}
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Confirmá tu pedido
                </h1>
                {checkoutSubtitle ? (
                  <p className="text-sm text-muted-foreground">{checkoutSubtitle}</p>
                ) : null}
              </div>
              <Button
                variant="ghost"
                className="h-10 justify-center rounded-full border border-border bg-card/85 px-4 text-sm font-semibold text-foreground shadow-[0_10px_24px_-18px_rgba(41,37,36,0.8)]"
                onClick={() => router.push("/cart")}
              >
                Editar carrito
              </Button>
            </div>
          </header>

          <section className={publicCheckoutScaleClasses.formSection}>
            <div className="space-y-5">
              <CheckoutPickupPanel
                customerName={formData.customerName}
                customerWhatsapp={formData.customerWhatsapp}
                pickupTime={formData.pickupTime}
                pickupNotes={formData.pickupNotes}
                totalLabel={formatCurrency(estimatedTotals.total, currency)}
                cartItemCount={cartItemCount}
                itemLine={items[0]?.productName ?? ""}
                itemMeta={`${items[0]?.quantity ?? 0}x${items[0]?.modifiers?.length ? ` · ${items[0]?.modifiers?.map((modifier) => modifier.optionName).join(", ")}` : ""}`}
                onChange={handleInputChange}
                onSelectPickupTime={(value) =>
                  setFormData((prev) => ({ ...prev, pickupTime: value === "asap" ? "19:30" : value }))
                }
                onSubmit={handlePlaceOrder}
                submitting={isSubmitting}
                disabled={isSubmitting || Boolean(formValidationError)}
              />
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <section className="space-y-4">
            <Card className={publicCheckoutScaleClasses.summaryCard}>
              <CardContent className="space-y-5 p-5 pt-5 sm:p-6 sm:pt-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-semibold text-foreground">
                    Tu pedido
                  </p>
                  <span className="rounded-full bg-[#efe3d1] px-2.5 py-1 text-[11px] font-semibold text-foreground">
                    {cartItemCount} {cartItemCount === 1 ? "item" : "items"}
                  </span>
                </div>

                <div className="space-y-3">
                  {items.map((item, index) => (
                    <CheckoutOrderLine
                      key={`${item.productId}-${index}`}
                      item={item}
                    />
                  ))}
                </div>

                {tipEnabled ? (
                  <div className="rounded-[24px] border border-border bg-cream/50 p-4">
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

                <div className="space-y-3 rounded-[24px] border border-border bg-cream/50 p-5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(subtotal, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Empaque</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(estimatedTotals.packagingAmount, currency)}
                    </span>
                  </div>
                  {estimatedTotals.tipAmount > 0 ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Propina ({estimatedTotals.tipRate ?? tipRate}%)
                      </span>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(estimatedTotals.tipAmount, currency)}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex justify-between border-t border-border pt-3 text-lg font-bold text-brand">
                    <span>Total a pagar</span>
                    <span>{formatCurrency(estimatedTotals.total, currency)}</span>
                  </div>
                </div>

                {settings.paymentInstructions ? (
                  <p className="text-[11px] leading-5 text-foreground">
                    {settings.paymentInstructions}
                  </p>
                ) : null}
                <p className="text-[11px] leading-5 text-muted-foreground">
                  Listo para confirmar ✓
                </p>
              </CardContent>
            </Card>
          </section>

          {submitError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {submitError}
            </div>
          ) : null}

          <section className="hidden rounded-[28px] border border-white/80 bg-card/90 p-6 shadow-[0_24px_60px_-38px_rgba(28,25,23,0.65)] ring-1 ring-border lg:block">
            <div className="space-y-3">
              <Button
                className={publicCheckoutScaleClasses.primaryCta}
                onClick={handlePlaceOrder}
                disabled={isSubmitting || Boolean(formValidationError)}
              >
                {isSubmitting
                  ? "Procesando..."
                  : `Confirmar pedido • ${formatCurrency(estimatedTotals.total, currency)}`}
              </Button>
              {ctaHelperText ? (
                <p className="text-sm text-foreground">
                  {ctaHelperText}
                </p>
              ) : null}
            </div>
          </section>
        </aside>
      </div>

      <div className={getPublicCheckoutMobileActionClassName()}>
        <div className="mx-auto w-full max-w-2xl space-y-1.5">
          <div className="flex items-center justify-between text-sm text-foreground">
            <span>Total a pagar</span>
            <span className="font-bold text-foreground">
              {formatCurrency(estimatedTotals.total, currency)}
            </span>
          </div>
          <Button
            className={publicCheckoutScaleClasses.primaryCta}
            onClick={handlePlaceOrder}
            disabled={isSubmitting || Boolean(formValidationError)}
          >
            {isSubmitting
              ? "Procesando..."
              : `Confirmar pedido • ${formatCurrency(estimatedTotals.total, currency)}`}
          </Button>
          {ctaHelperText ? (
            <p className="text-center text-sm text-foreground">
              {ctaHelperText}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
