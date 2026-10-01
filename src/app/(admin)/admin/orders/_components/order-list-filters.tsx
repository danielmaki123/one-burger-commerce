"use client";

import { useEffect, useState } from "react";

import { Search } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import {
  ADMIN_ORDER_PAYMENT_FILTERS,
  type AdminOrderDatePreset,
  type AdminOrderPaymentFilter,
  type AdminOrderStatusGroup,
} from "@/modules/orders/domain/admin-order-filters";

import { ALL_LOCATIONS, type OrderListFilters } from "../order-list-filters";

/** La demora del buscador: escribir «Ana» hace un viaje, no tres. La misma que usaba la bandeja vieja. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * `TASK-ORDERS-RUNTIME-5B` (`A-62`) — **la barra de filtros**, con los siete controles de la referencia.
 *
 * Todos escriben en la URL (el padre es el dueño del estado): recargar o compartir el enlace no pierde nada.
 *
 * La densidad es parte del contrato: el sistema reserva el **20% del alto** para cabecera y herramientas, así
 * que en escritorio y tablet los siete controles van en **una línea** y en celular en **dos**, con el
 * buscador a todo el ancho. Un rótulo visible por control costaba una línea entera por fila —y el alto útil es
 * el recurso escaso en 375×812—, así que los rótulos de los desplegables quedan sólo para el lector de
 * pantalla (`hideLabel` del primitivo): el nombre accesible no se pierde y la primera opción dice qué filtra
 * («Estado: todos»).
 *
 * El control de sucursal sólo se dibuja con **más de una** sucursal a la vista: con una sola sería decorativo.
 * Y el `Select` es el primitivo del sistema, con su mínimo táctil.
 */
export function OrderListFilters({
  filters,
  locations,
  showLocationFilter,
  onChange,
  onClear,
  showClear,
}: {
  filters: OrderListFilters;
  locations: Array<{ id: string; name: string }>;
  showLocationFilter: boolean;
  onChange: (patch: Partial<OrderListFilters>) => void;
  onClear: () => void;
  showClear: boolean;
}) {
  /**
   * El buscador se escribe **acá** y viaja al padre con una demora de 300 ms.
   *
   * Sin la demora, cada tecla reescribía la URL y volvía a pedir el listado: el campo se repintaba en medio de
   * la escritura (y con la URL en juego, una tecla podía perderse). La demora es la misma que usaba la bandeja
   * vieja: escribir «Ana» hace un viaje, no tres.
   */
  const [searchTerm, setSearchTerm] = useState(filters.search);

  useEffect(() => {
    setSearchTerm(filters.search);
  }, [filters.search]);

  useEffect(() => {
    if (searchTerm === filters.search) return;

    const timer = window.setTimeout(() => onChange({ search: searchTerm }), SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchTerm, filters.search, onChange]);

  return (
    <section
      aria-label="Filtros de pedidos"
      className="grid min-w-0 grid-cols-2 gap-1 rounded-stitch-lg border border-line-subtle bg-surface-card/95 p-1 shadow-elevation-1 sm:grid-cols-3 lg:grid-cols-[minmax(180px,1.3fr)_repeat(4,minmax(0,1fr))_auto] lg:items-center"
    >
      <div className="relative col-span-2 min-w-0 sm:col-span-3 lg:col-span-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
        />
        <Input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Buscar: número, cliente, teléfono o PIN"
          aria-label="Buscar"
          data-testid="orders-search"
          className="pl-9"
        />
      </div>

      <Select
        label="Rango"
        hideLabel
        className="min-h-10"
        value={filters.date}
        onChange={(event) => onChange({ date: event.target.value as AdminOrderDatePreset })}
        options={[
          { value: "today", label: "Hoy" },
          { value: "yesterday", label: "Ayer" },
          { value: "7d", label: "7 días" },
          { value: "30d", label: "30 días" },
        ]}
      />

      {showLocationFilter ? (
        <Select
          label="Sucursal"
          hideLabel
          value={filters.locationId}
          onChange={(event) => onChange({ locationId: event.target.value })}
          options={[
            { value: ALL_LOCATIONS, label: "Todas las sucursales" },
            ...locations.map((location) => ({ value: location.id, label: location.name })),
          ]}
        />
      ) : null}

      <Select
        label="Estado"
        hideLabel
        value={filters.status}
        onChange={(event) => onChange({ status: event.target.value as AdminOrderStatusGroup })}
        options={[
          { value: "all", label: "Estado: todos" },
          { value: "new", label: "Nuevos" },
          { value: "process", label: "En proceso" },
          { value: "ready", label: "Listos" },
          { value: "closed", label: "Completados" },
          { value: "cancelled", label: "Cancelados" },
        ]}
      />

      <Select
        label="Pago"
        hideLabel
        value={filters.payment}
        onChange={(event) => onChange({ payment: event.target.value as AdminOrderPaymentFilter })}
        options={[
          { value: ADMIN_ORDER_PAYMENT_FILTERS[0], label: "Pago: todos" },
          { value: "pending", label: "Pendientes" },
          { value: "paid", label: "Pagados" },
        ]}
      />

      <Button
        variant={filters.scheduledOnly ? "primary" : "outline"}
        aria-pressed={filters.scheduledOnly}
        className="min-h-11"
        onClick={() => onChange({ scheduledOnly: !filters.scheduledOnly })}
      >
        Solo programados
      </Button>

      {showClear ? (
        <Button
          variant="ghost"
          className="min-h-11"
          data-testid="orders-clear-filters"
          onClick={onClear}
        >
          Limpiar filtros
        </Button>
      ) : null}
    </section>
  );
}
