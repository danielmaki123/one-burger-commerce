import type { ModifierGroupRecord } from "./menu.types";

/**
 * Lo mínimo que un grupo tiene que tener para decidir si **exige** una elección.
 *
 * Se tipa así y no con el `ModifierGroupRecord` completo porque el pedido
 * (`getProductWithModifiers`, en el módulo `orders`) trae su propio shape, sin `sortOrder`: la regla es
 * una sola y la consumen los dos.
 */
export type ModifierGroupSelectionRule = {
  isRequired?: boolean | null;
  minSelections?: number | null;
  options?: readonly { isActive?: boolean | null }[] | null;
};

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

/**
 * ¿Hay algo que preguntar? Sí cuando algún grupo tiene **opciones activas**.
 *
 * Es distinto de "obliga a elegir" (`canQuickAddProduct`): un grupo opcional con opciones también se
 * pregunta en el mostrador, porque el cajero necesita poder sumar el extra. Un grupo sin opciones
 * activas no se pregunta: no hay nada que ofrecer y el alta las rechaza.
 */
export function hasSelectableModifiers(groups: readonly ModifierGroupRecord[]): boolean {
  return groups.some((group) => group.options.some((option) => option.isActive !== false));
}

/**
 * ¿Este grupo **obliga** a elegir algo? Sí cuando es obligatorio (o pide un mínimo) **y tiene opciones
 * activas**: un grupo obligatorio sin ninguna opción activa no obliga a nada, porque no habría qué
 * elegir.
 *
 * Es **la** regla: la consumen el "+" de la carta (`canQuickAddProduct`), el `requiresOptions` del
 * catálogo del mostrador y la validación del alta (`create-order`). Antes eran dos: `createOrder`
 * exigía igual el grupo vacío y respondía 422 a un pedido que la carta dejaba agregar (A-37).
 */
export function isModifierSelectionRequired(group: ModifierGroupSelectionRule): boolean {
  const activeOptions = (group.options ?? []).filter((option) => option.isActive !== false);
  if (activeOptions.length === 0) return false;

  return Boolean(group.isRequired) || (group.minSelections ?? 0) > 0;
}

/**
 * ¿Se puede agregar el producto sin abrir la pantalla de opciones?
 *
 * Es lo que decide si la tarjeta de la carta muestra el "+" que agrega directo o lleva a elegir, y lo
 * que marca `requiresOptions` en el catálogo del mostrador.
 */
export function canQuickAddProduct(product: {
  modifierGroups?: readonly ModifierGroupSelectionRule[] | null;
}): boolean {
  return !(product.modifierGroups ?? []).some(isModifierSelectionRequired);
}
