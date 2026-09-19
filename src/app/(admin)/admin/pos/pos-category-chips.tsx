"use client";

import type { PosCatalogCategoryChip } from "@/modules/pos/ports/pos-catalog";
import { Button } from "@/shared/ui/button";

/**
 * Los chips de categoría del mostrador, con su contador.
 *
 * El contador **viene del servidor** (`categories` de la respuesta del catálogo): acá no se agrupa ni se
 * cuenta nada, así que el número del chip y el del catálogo no pueden discrepar. El chip activo filtra el
 * grid y volver a tocarlo lo apaga (mismo gesto que las píldoras del cobro).
 *
 * Se desplazan en horizontal y **no** se envuelven: con muchas categorías, envolver empujaría el catálogo
 * fuera de la pantalla en la tablet del mostrador.
 */
export default function PosCategoryChips({
  categories,
  activeCategoryId,
  onSelect,
}: {
  categories: PosCatalogCategoryChip[];
  activeCategoryId: string | null;
  onSelect: (categoryId: string | null) => void;
}) {
  // Con una sola categoría no hay nada que filtrar: el chip «Todos» sería el único y no haría nada.
  if (categories.length <= 1) return null;

  const total = categories.reduce((sum, category) => sum + category.count, 0);

  const chip = (id: string | null, name: string, count: number) => {
    const active = activeCategoryId === id;

    return (
      <Button
        key={id ?? "all"}
        type="button"
        size="pill"
        variant={active ? "primary" : "secondary"}
        aria-pressed={active}
        onClick={() => onSelect(active ? null : id)}
        className="shrink-0"
      >
        {name}
        <span className="ml-1.5 font-mono text-xs tabular-nums">{count}</span>
      </Button>
    );
  };

  return (
    <div
      role="group"
      aria-label="Categorías del catálogo"
      className="flex gap-2 overflow-x-auto pb-1"
    >
      {chip(null, "Todos", total)}
      {categories.map((category) => chip(category.id, category.name, category.count))}
    </div>
  );
}
