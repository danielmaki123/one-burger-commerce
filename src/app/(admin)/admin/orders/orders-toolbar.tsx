"use client";

import { AlarmClock, Bell, BellOff, ChefHat, RefreshCw } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { KitchenToolbar } from "./kitchen-toolbar";
import { formatUpdatedAgo } from "./orders-page-helpers";
import type { OrderPaymentFilter } from "./comanda-url";

/**
 * La barra de trabajo de Órdenes (layout unificado, 2026-09-18).
 *
 * Antes había dos: el tablero traía la suya —con "Comandas", los tabs Hoy/Historial y sus controles—
 * y la lista traía otra con los filtros. Mirar el mismo turno cambiaba la pantalla de forma. Ahora el
 * shell es uno (barra lateral + encabezado "Órdenes") y esta barra es la única: los **tabs de estado
 * son el filtro** (carriles para los activos, lista para cerradas), más el local, los contadores, la
 * preparación promedio, la frescura y los controles del turno.
 *
 * Es de presentación: no lee ni escribe nada por su cuenta, todo entra y sale por props.
 *
 * **Punto 3 (2026-09-18)**: la barra tiene dos formas. En **modo cocina** queda solo lo que la cocina
 * necesita —los cinco tabs de cocina, el buscador, el aviso sonoro, actualizar y **Salir**— sin los
 * controles de administración del panel: el tablero ocupa la pantalla y el modo se sale desde acá.
 */

const CHIP_LIST_CLASS = "flex flex-wrap gap-2 bg-transparent p-0";
const CHIP_TRIGGER_CLASS =
  "min-h-11 flex-none whitespace-nowrap rounded-stitch-md border border-line-subtle bg-surface-card px-3";

/** Los tabs de estado: son el filtro de la bandeja, no un adorno. */
export const ORDERS_STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "new", label: "Nuevas" },
  { value: "preparing", label: "Preparando" },
  { value: "ready", label: "Listas" },
  { value: "closed", label: "Cerradas" },
];

const TYPE_TABS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "pickup", label: "Retiro" },
];

export type OrdersToolbarProps = {
  statusFilter: string;
  onStatusChange: (value: string) => void;
  typeFilter: string;
  onTypeChange: (value: string) => void;
  paymentFilter: OrderPaymentFilter;
  onPaymentChange: (value: OrderPaymentFilter) => void;
  lateOnly: boolean;
  onToggleLateOnly: () => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  showLocationFilter: boolean;
  scopeLocationIds: string[] | null;
  scopedLocations: Array<{ id: string; name: string }>;
  locationFilter: string;
  onLocationChange: (value: string) => void;
  counters: { pending: number; preparing: number; ready: number };
  averagePrepMinutes: number | null;
  lastUpdatedAt: number | null;
  nowMs: number;
  offline: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  /** Modo cocina: solo los carriles, con los tabs de la cocina y su salida. */
  kitchenMode: boolean;
  kitchenTab: string;
  onKitchenTabChange: (value: string) => void;
  onToggleKitchenMode: () => void;
  onRefresh: () => void;
  showClearFilters: boolean;
  onClearFilters: () => void;
};

/**
 * La barra de trabajo del panel. El modo cocina tiene la suya (`kitchen-toolbar.tsx`): son otro juego
 * de controles, no una variante de esta.
 */
export function OrdersToolbar({
  statusFilter,
  onStatusChange,
  typeFilter,
  onTypeChange,
  paymentFilter,
  onPaymentChange,
  lateOnly,
  onToggleLateOnly,
  searchTerm,
  onSearchTermChange,
  showLocationFilter,
  scopeLocationIds,
  scopedLocations,
  locationFilter,
  onLocationChange,
  counters,
  averagePrepMinutes,
  lastUpdatedAt,
  nowMs,
  offline,
  soundEnabled,
  onToggleSound,
  kitchenMode,
  kitchenTab,
  onKitchenTabChange,
  onToggleKitchenMode,
  onRefresh,
  showClearFilters,
  onClearFilters,
}: OrdersToolbarProps) {
  if (kitchenMode) {
    return (
      <KitchenToolbar
        kitchenTab={kitchenTab}
        onKitchenTabChange={onKitchenTabChange}
        searchTerm={searchTerm}
        onSearchTermChange={onSearchTermChange}
        lastUpdatedAt={lastUpdatedAt}
        nowMs={nowMs}
        soundEnabled={soundEnabled}
        onToggleSound={onToggleSound}
        offline={offline}
        onRefresh={onRefresh}
        onToggleKitchenMode={onToggleKitchenMode}
      />
    );
  }

  return (
    <div
      data-testid="comandas-topbar"
      /* Pegajosa solo en escritorio: ahí las columnas scrollean **adentro** y la barra no se mueve.
         En celular la barra envuelve en varias filas y, pegada, taparía el conmutador de carriles.
         Sin márgenes negativos: la barra vive en el mismo ancho que el tablero, así no empuja la
         página a lo ancho (con `-mx-*` se pasaba 16 px del viewport a 1280). */
      className="z-30 border-b border-line-subtle bg-canvas/95 py-2 backdrop-blur lg:sticky lg:top-0"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Tabs className="min-w-0">
          <TabsList className={CHIP_LIST_CLASS}>
            {ORDERS_STATUS_TABS.map((option) => (
              <TabsTrigger
                key={option.value}
                value={option.value}
                activeValue={statusFilter}
                onClick={onStatusChange}
                className={CHIP_TRIGGER_CLASS}
                testId={`orders-status-tab-${option.value}`}
              >
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <p className="ml-auto flex flex-wrap items-center gap-2" aria-label="Comandas en el turno">
          {/* Los contadores del sistema: una píldora por estado, con su punto y el número en
              mono (`design-system.md` §6.5 y §2.1), para leer el turno de un vistazo. */}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-status-pending-bg px-2.5 py-1 font-mono text-st-caption font-semibold tabular-nums text-status-pending-text">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-status-pending-dot motion-safe:animate-pulse"
            />
            Nuevas: {counters.pending}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-status-prep-bg px-2.5 py-1 font-mono text-st-caption font-semibold tabular-nums text-status-prep-text">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-status-prep-dot" />
            Preparando: {counters.preparing}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-status-ready-bg px-2.5 py-1 font-mono text-st-caption font-semibold tabular-nums text-status-ready-text">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-status-ready-dot" />
            Listas: {counters.ready}
          </span>
        </p>
      </div>

      {/* B4 — buscar y acotar el turno. El buscador no dispara un viaje por tecla (300 ms) y los
          filtros quedan en la URL: lo que se está mirando se puede compartir y sobrevive al
          recargar. */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {showLocationFilter ? (
          <div className="w-[11rem] shrink-0">
            <Select
              aria-label="Local de las comandas"
              value={locationFilter}
              onChange={(event) => onLocationChange(event.target.value)}
              options={[
                {
                  value: "all",
                  label: scopeLocationIds ? "Mis sucursales" : "Todas las sucursales",
                },
                ...scopedLocations.map((location) => ({
                  value: location.id,
                  label: location.name,
                })),
              ]}
            />
          </div>
        ) : null}

        <label className="flex min-h-11 w-full items-center gap-2 sm:w-72">
          <span className="sr-only">Buscar comanda</span>
          <Input
            type="search"
            className="h-11"
            placeholder="Número, nombre, WhatsApp o PIN"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
          />
        </label>

        <div className="w-[11rem] shrink-0">
          <Tabs className="min-w-0">
            <TabsList className={CHIP_LIST_CLASS} ariaLabel="Filtro por tipo de pedido">
              {TYPE_TABS.map((option) => (
                <TabsTrigger
                  key={option.value}
                  value={option.value}
                  activeValue={typeFilter}
                  onClick={onTypeChange}
                  className={CHIP_TRIGGER_CLASS}
                >
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="w-40 shrink-0">
          <Select
            aria-label="Forma de pago"
            value={paymentFilter}
            onChange={(event) => onPaymentChange(event.target.value as OrderPaymentFilter)}
            options={[
              { value: "all", label: "Pago: todas" },
              { value: "cash", label: "Pago: efectivo" },
              { value: "card", label: "Pago: tarjeta" },
            ]}
          />
        </div>

        <Button
          variant="outline"
          className="min-h-11 gap-2"
          aria-pressed={lateOnly}
          onClick={onToggleLateOnly}
        >
          <AlarmClock aria-hidden="true" className="h-4 w-4" />
          Atrasados
        </Button>

        {showClearFilters ? (
          <Button variant="ghost" className="min-h-11" onClick={onClearFilters}>
            Limpiar filtros
          </Button>
        ) : null}
      </div>

      {/* El ritmo del turno y sus controles, en su propia fila: el 80% de la pantalla es para las
          comandas, no para la barra. */}
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto flex flex-wrap items-center gap-2">
          {/* B5: el ritmo de la cocina hoy. Sin pedidos listos dice que todavía no hay datos,
              porque un "0 min" se leería como una cocina instantánea. */}
          <span
            data-testid="orders-average-prep"
            className="font-mono text-st-caption font-semibold text-ink-secondary tabular-nums"
          >
            {averagePrepMinutes === null
              ? "Preparación promedio: sin datos todavía"
              : `Preparación promedio hoy: ${averagePrepMinutes} min`}
          </span>

          <span
            className={`text-st-caption font-semibold tabular-nums ${offline ? "text-status-pending-text" : "text-ink-secondary"}`}
            data-testid="orders-freshness"
          >
            {offline ? "Sin conexión · " : ""}Actualizado{" "}
            {lastUpdatedAt ? formatUpdatedAgo(lastUpdatedAt, nowMs) : "…"}
          </span>
        </span>

          <Button
            variant="outline"
            className="min-h-11 gap-2"
            aria-pressed={soundEnabled}
            onClick={onToggleSound}
          >
            {soundEnabled ? (
              <Bell aria-hidden="true" className="h-4 w-4" />
            ) : (
              <BellOff aria-hidden="true" className="h-4 w-4" />
            )}
            Aviso sonoro
          </Button>

          {/*
            B6 · Punto 3 — el modo cocina. Antes este control entraba al *Fullscreen API* y escondía
            la barra lateral; ahora que el chrome se ve siempre, lo que hace es cambiar de modo: la
            barra lateral y el encabezado se van, quedan los carriles, y la vuelta es «Salir» (que se
            ve en el modo). La elección queda guardada en el dispositivo, así que la tablet de pared
            vuelve a entrar en modo cocina sola.
          */}
          <Button
            variant="outline"
            className="min-h-11 gap-2"
            onClick={onToggleKitchenMode}
          >
            <ChefHat aria-hidden="true" className="h-4 w-4" />
            Modo cocina
          </Button>

          <Button variant="outline" className="min-h-11 gap-2" onClick={onRefresh}>
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Actualizar
          </Button>
      </div>
    </div>
  );
}
