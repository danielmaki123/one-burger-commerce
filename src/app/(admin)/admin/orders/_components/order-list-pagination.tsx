"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/shared/ui/button";

/**
 * `TASK-ORDERS-RUNTIME-5B` — **el pie de la paginación**.
 *
 * La paginación es **del servidor**: acá sólo se pide otra página (`page`) y se dice en qué página se está y
 * cuántos pedidos hay en total. Los KPI de la cabecera **no** dependen de esto: describen el filtro completo.
 */
export function OrderListPagination({
  page,
  pageSize,
  total,
  loading,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const hasPrevious = page > 1;
  const hasNext = page < pageCount;

  return (
    <nav
      aria-label="Paginación de pedidos"
      data-testid="order-list-pagination"
      className="flex flex-wrap items-center justify-between gap-2 border-t border-line-subtle px-1 py-1.5"
    >
      <p className="text-st-caption text-ink-secondary tabular-nums" data-testid="order-list-range">
        {total === 0 ? "Sin pedidos" : `${first}–${last} de ${total}`}
      </p>

      <div className="flex items-center gap-1.5">
        {/* Los verbos quedan para el lector de pantalla: en celular el pie tiene que entrar en una línea. */}
        <Button
          variant="outline"
          size="icon"
          aria-label="Anterior"
          disabled={!hasPrevious || loading}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </Button>
        <span className="text-st-caption font-semibold text-ink tabular-nums" data-testid="order-list-page">
          {page} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Siguiente"
          disabled={!hasNext || loading}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
