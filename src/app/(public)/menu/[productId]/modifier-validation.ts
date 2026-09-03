interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  options: ModifierOption[];
}

export function validateModifierSelections(
  groups: ModifierGroup[],
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
