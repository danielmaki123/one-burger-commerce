import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";

export type ModifierRule = {
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
};

function optionWord(count: number): string {
  return count === 1 ? "opción" : "opciones";
}

// R4: la regla de selección se explica como consecuencia para el cliente,
// nunca como "Seleccion: 1 - 1".
export function describeModifierRule(rule: ModifierRule): string {
  const min = Math.max(0, rule.minSelections);
  const max = Math.max(0, rule.maxSelections);

  if (rule.isRequired) {
    if (min === max) {
      return `El cliente debe elegir ${min} ${optionWord(min)}`;
    }
    return `El cliente debe elegir entre ${min} y ${max} ${optionWord(max)}`;
  }

  if (max <= 1) {
    return "El cliente puede elegir 1 opción";
  }
  return `El cliente puede elegir hasta ${max} ${optionWord(max)}`;
}

// R2: recargos siempre con el helper único de moneda.
export function formatOptionPriceDelta(
  priceDelta: number,
  format: CurrencyFormat,
): string | null {
  if (!Number.isFinite(priceDelta) || priceDelta === 0) return null;
  const sign = priceDelta > 0 ? "+" : "-";
  return `${sign}${formatCurrency(Math.abs(priceDelta), format)}`;
}
