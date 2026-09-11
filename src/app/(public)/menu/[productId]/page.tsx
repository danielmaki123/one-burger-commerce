"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { useCart } from "@/shared/lib/cart";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import { getPublicStartingPrice } from "@/shared/lib/public-product-pricing";
import { Button } from "@/shared/ui/button";
import { publicProductDetailScaleClasses } from "../product-detail-page-helpers";
import {
  findPublicProductById,
  formatModifierOptionPrice,
  getProductDetailEyebrow,
} from "./product-detail-copy";
import { applyModifierSelection, validateModifierSelections } from "./modifier-validation";

interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  options: ModifierOption[];
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  packagingFeeAmount: number | null;
  images: { url: string; alt: string | null }[];
  modifierGroups: ModifierGroup[];
  categoryName?: string;
  subcategoryName?: string;
}

export function countAvailableSelectionGroups(groups: ModifierGroup[]): number {
  return groups.filter((group) => group.options.length > 0).length;
}

function ProductHeroPlaceholder({ name }: { name: string }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden brand-photo">
      <div className="relative flex flex-col items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-brand/15 bg-card/80 text-brand/75 shadow-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 0 0 2-2V2" />
            <path d="M7 2v20" />
            <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Z" />
            <path d="M18 22v-7" />
          </svg>
        </span>
        <p className="text-center text-xs font-semibold tracking-[0.22em] text-brand/55 uppercase">
          {name}
        </p>
      </div>
    </div>
  );
}

function GroupHelper({ group }: { group: ModifierGroup }) {
  if (group.maxSelections === 1) {
    return (
      <p className="text-sm text-muted-foreground">
        Elegí una opción para continuar.
      </p>
    );
  }

  if (group.minSelections === group.maxSelections && group.maxSelections > 1) {
    return (
      <p className="text-sm text-muted-foreground">
        Elegí exactamente {group.maxSelections} opciones.
      </p>
    );
  }

  if (group.minSelections > 0 || group.maxSelections > 1) {
    return (
      <p className="text-sm text-muted-foreground">
        Elegí entre {group.minSelections} y {group.maxSelections} opciones.
      </p>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      Personalizá este plato a tu gusto.
    </p>
  );
}

export default function ProductDetailPage() {
  const { productId } = useParams();
  const router = useRouter();
  const { addItem, items } = useCart();
  const currency = useCurrencyFormat();
  const settings = useBusinessSettings();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState("");
  const [justAdded, setJustAdded] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const cartItemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Si el usuario cambia la configuración tras agregar, volvemos al CTA de "Agregar".
  useEffect(() => {
    setJustAdded(false);
  }, [quantity, selectedModifiers, notes]);

  // El aviso "Agregado" se autodescarta; la barra de acciones permanece hasta navegar.
  useEffect(() => {
    if (!toastVisible) return;
    const timeout = window.setTimeout(() => setToastVisible(false), 2600);
    return () => window.clearTimeout(timeout);
  }, [toastVisible]);

  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await fetch("/api/menu", {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          const found = findPublicProductById<Product>(data.categories, String(productId));
          setProduct(found || null);
          setHeroImageFailed(false);

          if (found?.modifierGroups) {
            const initial: Record<string, string[]> = {};
            found.modifierGroups.forEach((group: ModifierGroup) => {
              if (group.minSelections > 0 && group.options.length > 0) {
                initial[group.id] = [group.options[0].id];
              } else {
                initial[group.id] = [];
              }
            });
            setSelectedModifiers(initial);
          }
        }
      } catch (error) {
        console.error("Failed to fetch product", error);
      } finally {
        setLoading(false);
      }
    }
    void fetchProduct();
  }, [productId]);

  const handleModifierChange = (
    groupId: string,
    optionId: string,
    maxSelections: number,
  ) => {
    setSelectedModifiers((current) =>
      applyModifierSelection(current, groupId, optionId, maxSelections),
    );
  };

  const validationErrors = useMemo(() => {
    if (!product) return {};
    return validateModifierSelections(product.modifierGroups, selectedModifiers);
  }, [product, selectedModifiers]);

  const isConfigValid = Object.keys(validationErrors).length === 0;

  const calculateTotalPrice = () => {
    if (!product) return 0;

    let extra = 0;
    product.modifierGroups.forEach((group) => {
      const selections = selectedModifiers[group.id] || [];
      selections.forEach((optId) => {
        const opt = group.options.find((o) => o.id === optId);
        if (opt) extra += opt.priceDelta;
      });
    });
    return (product.basePrice + extra) * quantity;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream/40">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-brand" />
          <p className="text-sm">Cargando producto...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream/40 p-6 text-center">
        <h2
          className="text-2xl font-semibold text-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Producto no encontrado
        </h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Volvé al menú para seguir explorando la carta disponible.
        </p>
        <Button className="mt-6 rounded-full px-5" onClick={() => router.push("/menu")}>
          Volver al menú
        </Button>
      </div>
    );
  }

  const availableSelectionGroupCount = countAvailableSelectionGroups(
    product.modifierGroups,
  );

  const handleAddToCart = () => {
    if (!isConfigValid) return;

    const modifiersSnapshot = product.modifierGroups.flatMap((group) => {
      const selections = selectedModifiers[group.id] || [];
      return selections
        .map((optId) => {
          const opt = group.options.find((o) => o.id === optId);
          if (!opt) return null;
          return {
            groupName: group.name,
            optionName: opt.name,
            priceDelta: opt.priceDelta,
          };
        })
        .filter(
          (
            modifier,
          ): modifier is {
            groupName: string;
            optionName: string;
            priceDelta: number;
          } => modifier !== null,
        );
    });

    const allOptionIds = Object.values(selectedModifiers).flat();
    addItem({
      productId: product.id,
      productName: product.name,
      imageUrl: product.images?.[0]?.url,
      imageAlt: product.images?.[0]?.alt || product.name,
      quantity,
      unitPrice:
        product.basePrice +
        Object.values(selectedModifiers)
          .flat()
          .reduce((acc, optId) => {
            const opt = product.modifierGroups
              .flatMap((g) => g.options)
              .find((o) => o.id === optId);
            return acc + (opt?.priceDelta || 0);
          }, 0),
      packagingUnitAmount: product.packagingFeeAmount ?? 0,
      modifierOptionIds: allOptionIds,
      modifiers: modifiersSnapshot,
      notes,
      packagingTotalAmount: (product.packagingFeeAmount ?? 0) * quantity,
      lineTotal: calculateTotalPrice(),
    });
    setJustAdded(true);
    setToastVisible(true);
  };

  return (
    <div className="min-h-screen brand-canvas pb-[calc(11rem+env(safe-area-inset-bottom))]">
      {toastVisible ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 top-4 z-[70] flex justify-center px-4"
        >
          <div className="flex items-center gap-2 rounded-full border border-brand/20 bg-card/95 px-4 py-2.5 text-sm font-semibold text-foreground brand-shadow-floating backdrop-blur">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-brand-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            Agregado al carrito
          </div>
        </div>
      ) : null}

      <div className="relative overflow-hidden">
        <div className={publicProductDetailScaleClasses.hero}>
          {product.images?.[0] && !heroImageFailed ? (
            <>
              <img
                src={product.images[0].url}
                alt={product.images[0].alt || product.name}
                className="h-full w-full object-cover"
                onError={() => setHeroImageFailed(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-stone-950/18 to-transparent" />
            </>
          ) : (
            <ProductHeroPlaceholder name={product.name} />
          )}
        </div>

        <div className="absolute left-4 right-4 top-4 z-10 flex items-start justify-between gap-3">
          <Button
            variant="secondary"
            size="sm"
            className="h-11 rounded-full border border-white/60 bg-card/88 px-4 text-foreground shadow-sm backdrop-blur-sm"
            onClick={() => router.back()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Menú
          </Button>

          <div className="rounded-full border border-white/25 bg-stone-950/38 px-3 py-1.5 text-[11px] font-semibold tracking-[0.24em] text-stone-50 uppercase backdrop-blur-sm">
            {settings.name}
          </div>
        </div>
      </div>

      <div className={publicProductDetailScaleClasses.shell}>
        <div className={publicProductDetailScaleClasses.surfaceCard}>
          <section className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-xl space-y-3">
                <p className="text-[11px] font-semibold tracking-[0.26em] text-muted-foreground uppercase">
                  {getProductDetailEyebrow(product)}
                </p>
                <h1
                  className={publicProductDetailScaleClasses.heading}
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {product.name}
                </h1>
                <p className={publicProductDetailScaleClasses.bodyCopy}>
                  {product.description || "Preparado al momento con ingredientes seleccionados."}
                </p>
              </div>

              <div className="inline-flex flex-col items-start gap-1">
                <p className="text-[10px] font-semibold tracking-[0.22em] text-brand uppercase">
                  Desde
                </p>
                <p className="text-[1.25rem] font-semibold leading-none text-foreground">
                  {formatCurrency(getPublicStartingPrice(product), currency)}
                </p>
              </div>
            </div>
          </section>

          {/* Cantidad: el mock la pone justo debajo del título, antes de las opciones */}
          <section className={`mt-7 ${publicProductDetailScaleClasses.surfacePanel}`}>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p
                  id="product-quantity-label"
                  className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground uppercase"
                >
                  Cantidad
                </p>
              </div>

              <div
                role="group"
                aria-labelledby="product-quantity-label"
                className="flex items-center gap-3 rounded-full border border-border bg-cream/50 px-2 py-2 shadow-inner"
              >
                <Button
                  variant="ghost"
                  className={publicProductDetailScaleClasses.stepperButton}
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => q - 1)}
                  aria-label="Reducir cantidad"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14" />
                  </svg>
                </Button>
                <span aria-live="polite" className="w-8 text-center text-xl font-semibold text-foreground">
                  {quantity}
                </span>
                <Button
                  variant="ghost"
                  className={publicProductDetailScaleClasses.stepperButton}
                  onClick={() => setQuantity((q) => q + 1)}
                  aria-label="Aumentar cantidad"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14" />
                    <path d="M12 5v14" />
                  </svg>
                </Button>
              </div>
            </div>
          </section>

          {availableSelectionGroupCount > 0 ? (
            <section className="mt-8 space-y-5">
              {product.modifierGroups.map((group) => {
                const selectedCount = selectedModifiers[group.id]?.length || 0;

                return (
                  <div
                    key={group.id}
                    className={publicProductDetailScaleClasses.surfacePanel}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2
                            className="text-xl font-semibold text-foreground"
                            style={{ fontFamily: "var(--font-heading)" }}
                          >
                            {group.name}
                          </h2>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.22em] uppercase ${
                              group.isRequired
                                ? "bg-brand text-brand-foreground"
                                : "border border-border bg-card text-muted-foreground"
                            }`}
                          >
                            {group.isRequired ? "Obligatorio" : "Opcional"}
                          </span>
                        </div>
                        <GroupHelper group={group} />
                      </div>

                      <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                        {selectedCount} seleccionado{selectedCount === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {group.options.map((opt) => {
                        const checked = selectedModifiers[group.id]?.includes(opt.id) || false;
                        const isSingleChoice = group.maxSelections === 1;

                        return (
                          <label
                            key={opt.id}
                            htmlFor={opt.id}
                            className={`flex cursor-pointer items-start justify-between gap-4 rounded-[20px] border px-4 py-3.5 transition ${
                              checked
                                ? "border-brand bg-brand text-brand-foreground shadow-sm"
                                : "border-border bg-card text-foreground hover:border-brand"
                            }`}
                          >
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                                <input
                                  type={isSingleChoice ? "radio" : "checkbox"}
                                  id={opt.id}
                                  name={group.id}
                                  value={opt.id}
                                  checked={checked}
                                  onChange={() =>
                                    handleModifierChange(group.id, opt.id, group.maxSelections)
                                  }
                                  className="peer sr-only"
                                />
                                <div
                                  className={`flex h-5 w-5 items-center justify-center rounded-full border transition peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 ${
                                    isSingleChoice
                                      ? checked
                                        ? "border-brand-foreground bg-brand-foreground"
                                        : "border-border bg-card"
                                      : checked
                                        ? "rounded-md border-brand-foreground bg-brand-foreground"
                                        : "rounded-md border-border bg-card"
                                  }`}
                                >
                                  {checked ? (
                                    isSingleChoice ? (
                                      <div className="h-2.5 w-2.5 rounded-full bg-brand" />
                                    ) : (
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="12"
                                        height="12"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="text-brand"
                                      >
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                    )
                                  ) : null}
                                </div>
                              </div>

                              <div className="min-w-0">
                                <p className="text-sm font-semibold leading-6">
                                  {opt.name}
                                </p>
                              </div>
                            </div>

                            <div className="shrink-0 text-sm font-semibold">
                              {formatModifierOptionPrice(opt.priceDelta, currency)}
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    {validationErrors[group.id] ? (
                      <p className="mt-3 text-sm font-medium text-red-600">
                        {validationErrors[group.id]}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </section>
          ) : null}

          <section className={`mt-7 ${publicProductDetailScaleClasses.surfacePanel}`}>
            <div className="space-y-2">
              <label
                htmlFor="product-notes"
                className="block text-xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Notas especiales
              </label>
              <p className="text-sm text-muted-foreground">
                Aclaraciones para cocina, salsas aparte o preferencias puntuales.
              </p>
            </div>
            <textarea
              id="product-notes"
              className="mt-4 min-h-[120px] w-full rounded-[22px] border border-border bg-card px-4 py-4 text-sm leading-6 text-foreground transition-colors placeholder:text-muted-foreground focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              placeholder="Ej. sin cebolla, salsa aparte, servir bien caliente..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </section>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-card/96 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_40px_rgba(60,40,20,0.12)] backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
                Total estimado
              </p>
              <p className="text-2xl font-semibold text-foreground">
                {formatCurrency(calculateTotalPrice(), currency)}
              </p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>{quantity} unidad{quantity === 1 ? "" : "es"}</p>
              {availableSelectionGroupCount > 0 ? (
                <p>
                  {availableSelectionGroupCount} selecci
                  {availableSelectionGroupCount === 1 ? "ón disponible" : "ones disponibles"}
                </p>
              ) : null}
            </div>
          </div>

          {!isConfigValid ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Revisá las opciones obligatorias antes de agregar al carrito.
            </p>
          ) : null}

          {justAdded ? (
            <div className="space-y-2.5">
              <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-brand">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Agregado al carrito
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="secondary"
                  className={publicProductDetailScaleClasses.primaryCta}
                  onClick={() => router.push("/menu")}
                >
                  Seguir en el menú
                </Button>
                <Button
                  className={`${publicProductDetailScaleClasses.primaryCta} shadow-sm shadow-brand/20`}
                  onClick={() => router.push("/cart")}
                >
                  Ver carrito{cartItemCount > 0 ? ` (${cartItemCount})` : ""}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              className={`${publicProductDetailScaleClasses.primaryCta} w-full shadow-sm shadow-brand/20`}
              onClick={handleAddToCart}
              disabled={!isConfigValid}
            >
              Agregar al carrito • {formatCurrency(calculateTotalPrice(), currency)}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
