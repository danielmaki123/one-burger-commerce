"use client";

import * as React from "react";

import type { ModifierGroupRecord } from "@/modules/menu/domain/menu.types";
import { describeModifierGroup, formatModifierOptionPrice } from "@/modules/menu/domain/modifier-copy";
import {
  applyModifierSelection,
  validateModifierSelections,
} from "@/modules/menu/domain/modifier-selection";
import type { PosCatalogProduct } from "@/modules/pos/ports/pos-catalog";
import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { roundCurrency } from "@/shared/lib/order-totals";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Modal } from "@/shared/ui/modal";
import { RadioGroupItem } from "@/shared/ui/radio-group";

/**
 * El selector de modificadores del mostrador.
 *
 * Es lo que faltaba para poder vender desde el POS un producto con grupos obligatorios: sin elegir los
 * modificadores, el alta rechaza la venta con 422. Los datos ya vienen en el catálogo
 * (`PosCatalogProduct.modifierGroups`) y la **regla** es la del dominio del menú
 * (`modules/menu/domain/modifier-selection`), la misma que usa la carta: acá no hay una segunda versión
 * de "obligatorio / mínimo / máximo".
 *
 * Se monta con el primitivo `Modal` **inline** (no en un portal): así hereda el alcance `dark` del shell
 * del panel y no se escapa al modo claro.
 */

export type PosModifierSelection = {
  modifierOptionIds: string[];
  modifierNames: string[];
  /** Precio unitario de la línea: la base del producto más los deltas elegidos. */
  unitPrice: number;
};

/**
 * Los grupos que se pueden ofrecer: las opciones inactivas no se dibujan (el alta las rechaza con 409) y
 * un grupo que se queda sin opciones no se muestra.
 */
function selectableGroups(product: PosCatalogProduct | null): ModifierGroupRecord[] {
  return (product?.modifierGroups ?? [])
    .map((group) => ({
      ...group,
      options: group.options.filter((option) => option.isActive !== false),
    }))
    .filter((group) => group.options.length > 0);
}

/** La selección con la que abre: los grupos que exigen elegir arrancan con su primera opción. */
function initialSelection(groups: ModifierGroupRecord[]): Record<string, string[]> {
  return Object.fromEntries(
    groups.map((group) => [
      group.id,
      group.isRequired || group.minSelections > 0
        ? group.options[0]
          ? [group.options[0].id]
          : []
        : [],
    ]),
  );
}

export default function PosModifierDialog({
  product,
  currency,
  open,
  onClose,
  onConfirm,
}: {
  product: PosCatalogProduct | null;
  currency: CurrencyFormat;
  open: boolean;
  onClose: () => void;
  onConfirm: (product: PosCatalogProduct, selection: PosModifierSelection) => void;
}) {
  const groups = React.useMemo(() => selectableGroups(product), [product]);
  const [selected, setSelected] = React.useState<Record<string, string[]>>({});

  React.useEffect(() => {
    setSelected(initialSelection(groups));
  }, [groups]);

  const errors = React.useMemo(
    () => validateModifierSelections(groups, selected),
    [groups, selected],
  );
  const isValid = Object.keys(errors).length === 0;

  const chosen = groups.flatMap((group) =>
    (selected[group.id] ?? [])
      .map((optionId) => group.options.find((option) => option.id === optionId))
      .filter((option): option is ModifierGroupRecord["options"][number] => option !== undefined),
  );
  const unitPrice = roundCurrency(
    (product?.basePrice ?? 0) + chosen.reduce((sum, option) => sum + option.priceDelta, 0),
  );

  const toggle = (group: ModifierGroupRecord, optionId: string) =>
    setSelected((current) =>
      applyModifierSelection(current, group.id, optionId, group.maxSelections),
    );

  return (
    <Modal
      open={open && product !== null}
      onClose={onClose}
      title={product?.name ?? ""}
      size="lg"
    >
      {product ? (
        <div className="space-y-4">
          {groups.map((group) => {
            const selections = selected[group.id] ?? [];
            const singleChoice = group.maxSelections === 1;

            return (
              <section key={group.id} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-st-h3 text-ink">{group.name}</h3>
                  <span
                    className={
                      group.isRequired
                        ? "rounded-stitch-sm bg-brand-primary px-2 py-1 text-st-overline font-bold text-canvas uppercase"
                        : "rounded-stitch-sm border border-line-subtle px-2 py-1 text-st-overline font-bold text-ink-muted uppercase"
                    }
                  >
                    {group.isRequired ? "Obligatorio" : "Opcional"}
                  </span>
                </div>

                <p className="text-st-caption text-ink-secondary">{describeModifierGroup(group)}</p>

                <div className="space-y-2">
                  {group.options.map((option) => {
                    const checked = selections.includes(option.id);

                    return (
                      <div
                        key={option.id}
                        className={`flex min-h-11 items-center justify-between gap-3 rounded-stitch-md border px-3 py-2 ${
                          checked
                            ? "border-brand-primary bg-brand-primary-muted"
                            : "border-line-subtle bg-surface-input"
                        }`}
                      >
                        {singleChoice ? (
                          <RadioGroupItem
                            id={`${group.id}-${option.id}`}
                            name={group.id}
                            value={option.id}
                            checked={checked}
                            onChange={() => toggle(group, option.id)}
                            label={option.name}
                          />
                        ) : (
                          <Checkbox
                            id={`${group.id}-${option.id}`}
                            checked={checked}
                            onChange={() => toggle(group, option.id)}
                            label={option.name}
                          />
                        )}

                        <span className="shrink-0 font-mono text-st-body tabular-nums text-ink-secondary">
                          {formatModifierOptionPrice(option.priceDelta, currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {errors[group.id] ? (
                  <p
                    role="alert"
                    className="text-st-caption font-medium text-status-sla-text"
                  >
                    {errors[group.id]}
                  </p>
                ) : null}
              </section>
            );
          })}

          <div className="flex items-center justify-between gap-3 border-t border-line-subtle pt-3">
            <p className="text-st-body text-ink-secondary">
              Queda en{" "}
              <span className="font-mono text-st-body font-bold tabular-nums text-ink">
                {formatCurrency(unitPrice, currency)}
              </span>
            </p>
            <Button
              type="button"
              className="min-h-11"
              disabled={!isValid}
              onClick={() =>
                onConfirm(product, {
                  modifierOptionIds: chosen.map((option) => option.id),
                  modifierNames: chosen.map((option) => option.name),
                  unitPrice,
                })
              }
            >
              Agregar {formatCurrency(unitPrice, currency)}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
