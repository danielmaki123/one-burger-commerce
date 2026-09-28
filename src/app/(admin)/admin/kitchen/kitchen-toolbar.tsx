"use client";

import { AlarmClock, Bell, BellOff, RefreshCw } from "lucide-react";

import type { OrderLane } from "@/modules/orders/domain/order-lanes";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";

import { formatUpdatedAgo } from "../orders/orders-page-helpers";
import { KITCHEN_FILTERS } from "./kitchen-tabs";

/**
 * La barra de trabajo de **Cocina**, traducida de la referencia aprobada.
 *
 * Una línea y con lo que la cocina necesita con las manos sucias: el filtro de carril (el mismo que el
 * conmutador del tablero), el buscador, **Solo atrasadas**, el aviso sonoro, actualizar y la frescura. La
 * spec pide la cabecera y la toolbar en **una línea** cada una: el 80% del alto es para los carriles.
 *
 * No hay «Salir»: `/admin/kitchen` es una sección del panel, no un modo que se prende y se apaga —eso era
 * el modo cocina de Órdenes, que esta TASK elimina—. La vuelta al panel es la navegación del admin.
 */

const CHIP_LIST_CLASS = "flex flex-wrap gap-2 bg-transparent p-0";
const CHIP_TRIGGER_CLASS =
  "min-h-11 flex-none whitespace-nowrap rounded-stitch-md border border-line-subtle bg-surface-card px-3";

export type KitchenToolbarProps = {
  filter: string;
  onFilterChange: (value: string) => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  lateOnly: boolean;
  onToggleLateOnly: () => void;
  lastUpdatedAt: number | null;
  nowMs: number;
  offline: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onRefresh: () => void;
};

export function KitchenToolbar({
  filter,
  onFilterChange,
  searchTerm,
  onSearchTermChange,
  lateOnly,
  onToggleLateOnly,
  lastUpdatedAt,
  nowMs,
  offline,
  soundEnabled,
  onToggleSound,
  onRefresh,
}: KitchenToolbarProps) {
  return (
    <div
      data-testid="kitchen-toolbar"
      className="z-30 flex flex-wrap items-center gap-2 border-b border-line-subtle bg-canvas/95 py-2 backdrop-blur lg:sticky lg:top-0"
    >
      <Tabs className="min-w-0">
        <TabsList className={CHIP_LIST_CLASS} ariaLabel="Filtro por carril">
          {KITCHEN_FILTERS.map((option) => (
            <TabsTrigger
              key={option.id}
              value={option.id}
              activeValue={filter}
              onClick={onFilterChange}
              className={CHIP_TRIGGER_CLASS}
              testId={`kitchen-filter-${option.id}`}
            >
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <label className="flex min-h-11 w-full items-center gap-2 sm:w-64">
        <span className="sr-only">Buscar comanda</span>
        <Input
          type="search"
          className="h-11"
          placeholder="Buscar número o cliente"
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
        />
      </label>

      <Button
        variant="outline"
        className="min-h-11 gap-1.5 px-3"
        aria-pressed={lateOnly}
        aria-label="Solo atrasadas"
        onClick={onToggleLateOnly}
      >
        <AlarmClock aria-hidden="true" className="h-4 w-4" />
        <span className="hidden sm:inline">Solo atrasadas</span>
      </Button>

      <span className="ml-auto flex flex-wrap items-center gap-1.5">
        <span
          className={`text-st-caption font-semibold tabular-nums ${offline ? "text-status-pending-text" : "text-ink-secondary"}`}
          data-testid="kitchen-freshness"
        >
          {offline ? "Sin conexión · " : ""}Actualizado{" "}
          {lastUpdatedAt ? formatUpdatedAgo(lastUpdatedAt, nowMs) : "…"}
        </span>

        <Button
          variant="outline"
          className="min-h-11 gap-1.5 px-3"
          aria-pressed={soundEnabled}
          aria-label="Sonido"
          onClick={onToggleSound}
        >
          {soundEnabled ? (
            <Bell aria-hidden="true" className="h-4 w-4" />
          ) : (
            <BellOff aria-hidden="true" className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">{soundEnabled ? "Sonido activado" : "Sonido desactivado"}</span>
        </Button>

        <Button
          variant="outline"
          className="min-h-11 gap-1.5 px-3"
          aria-label="Actualizar"
          onClick={onRefresh}
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          <span className="hidden sm:inline">Actualizar</span>
        </Button>
      </span>
    </div>
  );
}

/** El tipo del carril activo del conmutador, exportado para la página. */
export type { OrderLane };
