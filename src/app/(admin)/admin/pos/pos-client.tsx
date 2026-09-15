"use client";

import * as React from "react";

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
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
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
};

function catalogUrl(locationId: string) {
  return `/api/admin/pos/catalog?locationId=${encodeURIComponent(locationId)}`;
}

export default function PosClient({ locations }: { locations: PosLocationOption[] }) {
  const currency = useCurrencyFormat();
  const settings = useBusinessSettings();

  const [locationId, setLocationId] = React.useState(locations[0]?.id ?? "");
  const [products, setProducts] = React.useState<PosCatalogProduct[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [draft, setDraft] = React.useState<PosDraft>(() => createPosDraft(locations[0]?.id ?? ""));
  const [reloadKey, setReloadKey] = React.useState(0);
  const [customer, setCustomer] = React.useState({ name: "", whatsapp: "", email: "" });
  const [method, setMethod] = React.useState<"cash" | "card">("cash");
  const [paymentCurrency, setPaymentCurrency] = React.useState(settings.currencyCode);
  const [paidAmount, setPaidAmount] = React.useState("");
  const [charging, setCharging] = React.useState(false);
  const [saleError, setSaleError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [lastSale, setLastSale] = React.useState<PosSaleSummary | null>(null);
  // La clave de la operación se renueva solo cuando la venta salió bien: si el cobro falla y el cajero
  // reintenta, el servidor reconoce el mismo intento y no crea dos pedidos (TASK-101).
  const [attemptKey, setAttemptKey] = React.useState(() => crypto.randomUUID());
  // TASK-305b — la caja del local.
  const [shift, setShift] = React.useState<PosShift | null>(null);
  const [shiftLoading, setShiftLoading] = React.useState(true);
  const [shiftError, setShiftError] = React.useState<string | null>(null);
  const [countValues, setCountValues] = React.useState<CashCountValues>({});
  const [shiftBusy, setShiftBusy] = React.useState(false);
  const [closedShift, setClosedShift] = React.useState<ClosedShiftSummary | null>(null);

  const cashCurrencies = React.useMemo(
    () => [settings.currencyCode, ...(settings.usdExchangeRate !== null ? ["USD"] : [])],
    [settings.currencyCode, settings.usdExchangeRate],
  );

  const loadShift = React.useCallback(async (targetLocationId: string) => {
    if (targetLocationId === "") {
      setShiftLoading(false);
      return;
    }

    setShiftLoading(true);
    setShiftError(null);

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
      setShift(null);
      setShiftError(error instanceof Error ? error.message : "No se pudo leer la caja.");
    } finally {
      setShiftLoading(false);
    }
  }, []);

  React.useEffect(() => {
    setCountValues({});
    setClosedShift(null);
    void loadShift(locationId);
  }, [locationId, loadShift]);

  React.useEffect(() => {
    if (locationId === "") {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    void (async () => {
      try {
        const response = await fetch(catalogUrl(locationId));
        if (!response.ok) throw new Error("No se pudo cargar el catálogo de ese local.");

        const body = (await response.json()) as { data: { products: PosCatalogProduct[] } };
        if (cancelled) return;

        setProducts(body.data.products);
      } catch (error) {
        if (cancelled) return;
        setProducts([]);
        setLoadError(error instanceof Error ? error.message : "No se pudo cargar el catálogo.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locationId, reloadKey]);

  // Cambiar de local empieza una venta nueva: el borrador lleva el local y sus precios.
  React.useEffect(() => {
    setDraft(createPosDraft(locationId));
    setPaidAmount("");
    setLastSale(null);
  }, [locationId]);

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
    if (draft.lines.length === 0) problems.lines = "Agregá al menos un producto.";
    if (customer.name.trim() === "") problems.name = "Escribí el nombre del cliente.";
    if (customer.whatsapp.trim() === "") problems.whatsapp = "Escribí el número del cliente.";
    if (!(Number(paidAmount) > 0)) problems.amount = "Escribí con cuánto paga el cliente.";

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
          payments: [
            { method, currency: paymentCurrency, amount: Number(paidAmount) },
          ],
          idempotencyKey: attemptKey,
        }),
      });

      const body = (await response.json()) as {
        data?: PosSaleSummary;
        error?: { message?: string; fields?: Record<string, string> };
      };

      if (!response.ok || !body.data) {
        setFieldErrors(body.error?.fields ?? {});
        setSaleError(body.error?.message ?? "No se pudo cobrar la venta.");
        return;
      }

      setLastSale(body.data);
      setDraft(createPosDraft(locationId));
      setCustomer({ name: "", whatsapp: "", email: "" });
      setPaidAmount("");
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
        <section
          className="space-y-3 rounded-panel border border-border bg-card p-4"
          aria-label="Caja"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-headline text-foreground">Caja</h2>
            {shiftLoading ? (
              <p className="text-sm text-muted-foreground">Leyendo la caja…</p>
            ) : shift ? (
              <p className="text-sm text-muted-foreground">
                Abierta · fondo {formatCurrency(shift.openingAmount, currency)}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Sin caja abierta en este local.</p>
            )}
          </div>

          {closedShift ? (
            <div
              role="status"
              className="rounded-card border border-success-strong/30 bg-success px-3 py-2 text-sm text-success-foreground"
            >
              Caja cerrada · contado {formatCurrency(closedShift.closingAmount ?? 0, currency)} ·
              esperado {formatCurrency(closedShift.expectedAmount ?? 0, currency)} ·{" "}
              {closedShift.difference === 0
                ? "sin diferencia"
                : `diferencia ${formatCurrency(closedShift.difference ?? 0, currency)}`}
            </div>
          ) : null}

          {shiftError ? (
            <p role="alert" className="text-sm font-medium text-danger-strong">
              {shiftError}
            </p>
          ) : null}

          {shiftLoading ? null : (
            <>
              <p className="text-sm text-muted-foreground">
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
              <p className="rounded-2xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
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
                    className="flex min-h-24 flex-col justify-between gap-2 rounded-card border border-border bg-card p-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.categoryName}</p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-foreground">
                        {formatCurrency(product.price, currency)}
                      </p>
                    </div>

                    {product.requiresOptions ? (
                      // No se puede vender de un toque: la carta obliga a elegir. Sin botón que mienta.
                      <p className="text-xs font-medium text-muted-foreground">Se elige en la carta</p>
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
            className="h-fit space-y-3 rounded-panel border border-border bg-card p-4"
            aria-label="Venta en curso"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-headline text-foreground">Venta en curso</h2>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {draft.lines.length === 0
                  ? "Sin productos"
                  : `${draft.lines.length} ${draft.lines.length === 1 ? "producto" : "productos"}`}
              </p>
            </div>

            {draft.lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Agregá productos del catálogo para armar la venta.
              </p>
            ) : (
              <ul className="space-y-3" aria-label="Productos de la venta">
                {draft.lines.map((line) => (
                  <li
                    key={`${line.productId}-${line.notes ?? ""}`}
                    className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{line.name}</p>
                      <p className="text-xs tabular-nums text-muted-foreground">
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
                      <span className="w-8 text-center text-sm font-bold tabular-nums text-foreground">
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

            <dl className="space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex items-baseline justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums text-foreground">{formatCurrency(totals.subtotal, currency)}</dd>
              </div>
              {totals.packagingAmount > 0 ? (
                <div className="flex items-baseline justify-between">
                  <dt className="text-muted-foreground">Empaque</dt>
                  <dd className="tabular-nums text-foreground">
                    {formatCurrency(totals.packagingAmount, currency)}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between">
                <dt className="font-medium text-foreground">Total</dt>
                <dd className="text-title font-bold tabular-nums text-foreground" aria-live="polite">
                  {formatCurrency(totals.total, currency)}
                </dd>
              </div>
            </dl>

            {fieldErrors.lines ? (
              <p className="text-sm font-medium text-danger-strong">{fieldErrors.lines}</p>
            ) : null}

            <div className="space-y-3 border-t border-border pt-3">
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

              <div className="space-y-1.5">
                <p className="text-sm font-medium leading-none text-foreground">¿Cómo paga?</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: "cash", label: "Efectivo" },
                      { id: "card", label: "Tarjeta" },
                    ] as const
                  ).map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      size="pill"
                      variant={method === option.id ? "primary" : "secondary"}
                      aria-pressed={method === option.id}
                      onClick={() => setMethod(option.id)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              {settings.usdExchangeRate !== null ? (
                <Select
                  label="Moneda del cobro"
                  value={paymentCurrency}
                  onChange={(event) => setPaymentCurrency(event.target.value)}
                  options={[
                    { value: settings.currencyCode, label: settings.currencyCode },
                    { value: "USD", label: "USD" },
                  ]}
                />
              ) : null}

              <Input
                label={
                  paymentCurrency === settings.currencyCode
                    ? "Con cuánto paga"
                    : `Con cuánto paga (en ${paymentCurrency})`
                }
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={paidAmount}
                error={fieldErrors.amount ?? fieldErrors.payments}
                onChange={(event) => setPaidAmount(event.target.value)}
              />

              <Button
                type="button"
                className="min-h-12 w-full"
                disabled={charging}
                onClick={() => void charge()}
              >
                {charging ? "Cobrando…" : `Cobrar ${formatCurrency(totals.total, currency)}`}
              </Button>

              {saleError ? (
                <p role="alert" className="text-sm font-medium text-danger-strong">
                  {saleError}
                </p>
              ) : null}

              {lastSale ? (
                <div
                  role="status"
                  className="rounded-card border border-success-strong/30 bg-success px-3 py-2 text-sm text-success-foreground"
                >
                  Venta {lastSale.orderNumber} cobrada por {formatCurrency(lastSale.total, currency)}
                  {lastSale.change !== null && lastSale.change > 0
                    ? ` · Cambio ${formatCurrency(lastSale.change, currency)}`
                    : " · Sin cambio"}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
