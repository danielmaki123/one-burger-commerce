import type { ModifierGroupRecord } from "./menu.types";

/**
 * Las reglas de selección de modificadores, en el **dominio del menú**.
 *
 * Vivían en `src/app/(public)/menu/[productId]/modifier-validation.ts`, o sea dentro de la carpeta de
 * una ruta: el POS no podía reusarlas sin importar de la carta pública. Acá son de quien son — el menú —
 * y las consumen la ficha pública y el mostrador.
 *
 * Los tipos también salen del dominio (`ModifierGroupRecord`): antes este archivo declaraba sus propios
 * `ModifierGroup`/`ModifierOption`, una segunda definición del mismo shape que el de `menu.types.ts`.
 *
 * La misma regla la aplica el **servidor** al crear el pedido (`create-order.ts`): si acá y allá
 * divergieran, el cliente vería un CTA habilitado y el alta rechazaría la venta.
 */

export function validateModifierSelections(
  groups: ModifierGroupRecord[],
  selected: Record<string, string[]>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const group of groups) {
    const selections = selected[group.id] || [];
    if (group.isRequired && selections.length === 0) {
      errors[group.id] = `Selecciona al menos una opción de ${group.name}`;
    } else if (selections.length < group.minSelections) {
      errors[group.id] = `Mínimo ${group.minSelections} selecci${group.minSelections > 1 ? "ones" : "ón"} en ${group.name}`;
    } else if (selections.length > group.maxSelections) {
      errors[group.id] = `Máximo ${group.maxSelections} selecci${group.maxSelections > 1 ? "ones" : "ón"} en ${group.name}`;
    }
  }
  return errors;
}

export function applyModifierSelection(
  current: Record<string, string[]>,
  groupId: string,
  optionId: string,
  maxSelections: number,
): Record<string, string[]> {
  const groupSelections = current[groupId] || [];
  if (maxSelections === 1) {
    return { ...current, [groupId]: [optionId] };
  }
  const exists = groupSelections.includes(optionId);
  if (exists) {
    return { ...current, [groupId]: groupSelections.filter((id) => id !== optionId) };
  }
  if (maxSelections > 1 && groupSelections.length >= maxSelections) {
    return current;
  }
  return { ...current, [groupId]: [...groupSelections, optionId] };
}
