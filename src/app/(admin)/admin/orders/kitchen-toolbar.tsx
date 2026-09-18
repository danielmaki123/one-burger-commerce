"use client";

import { Bell, BellOff, LogOut, RefreshCw } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { KITCHEN_TABS } from "./kitchen-tabs";
import { formatUpdatedAgo } from "./orders-page-helpers";

/**
 * Punto 3 del roadmap (2026-09-18) — la barra de trabajo del **modo cocina**.
 *
 * Cuando el tablero ocupa la pantalla no hay barra lateral ni encabezado: lo único que queda es lo que
 * la cocina necesita con las manos sucias. Los cinco tabs de la cocina (sin «Cerradas» y sin
 * «Historial»: eso es auditoría del turno), el buscador, el aviso sonoro, actualizar y **Salir**, que
 * devuelve el panel **sin cerrar sesión**.
 *
 * Vive en su propio archivo porque es otro juego de controles, no una variante de la barra del panel:
 * así ninguna de las dos pasa el techo de líneas y cada una se prueba por separado.
 */

const CHIP_LIST_CLASS = "flex flex-wrap gap-2 bg-transparent p-0";
const CHIP_TRIGGER_CLASS =
  "min-h-11 flex-none whitespace-nowrap rounded-stitch-md border border-line-subtle bg-surface-card px-3";

export type KitchenToolbarProps = {
  kitchenTab: string;
  onKitchenTabChange: (value: string) => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  lastUpdatedAt: number | null;
  nowMs: number;
  offline: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onRefresh: () => void;
  onToggleKitchenMode: () => void;
};

export function KitchenToolbar({
  kitchenTab,
  onKitchenTabChange,
  searchTerm,
  onSearchTermChange,
  lastUpdatedAt,
  nowMs,
  offline,
  soundEnabled,
  onToggleSound,
  onRefresh,
  onToggleKitchenMode,
}: KitchenToolbarProps) {
  return (
    <div className="border-b border-line-subtle bg-canvas py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs className="min-w-0">
          <TabsList className={CHIP_LIST_CLASS} ariaLabel="Tabs del modo cocina">
            {KITCHEN_TABS.map((option) => (
              <TabsTrigger
                key={option.id}
                value={option.id}
                activeValue={kitchenTab}
                onClick={onKitchenTabChange}
                className={CHIP_TRIGGER_CLASS}
                testId={`kitchen-tab-${option.id}`}
              >
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* «Salir» va arriba a la derecha y con la etiqueta más corta: es lo único que no se puede
            perder de vista cuando el tablero ocupa la pantalla. */}
        <Button variant="outline" className="ml-auto min-h-11 gap-2" onClick={onToggleKitchenMode}>
          <LogOut aria-hidden="true" className="h-4 w-4" />
          Salir
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
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

        <span
          className={`text-st-caption font-semibold tabular-nums ${offline ? "text-status-pending-text" : "text-ink-secondary"}`}
          data-testid="orders-freshness"
        >
          {offline ? "Sin conexión · " : ""}Actualizado{" "}
          {lastUpdatedAt ? formatUpdatedAgo(lastUpdatedAt, nowMs) : "…"}
        </span>

        <span className="ml-auto flex flex-wrap items-center gap-2">
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

          <Button variant="outline" className="min-h-11 gap-2" onClick={onRefresh}>
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Actualizar
          </Button>
        </span>
      </div>
    </div>
  );
}
