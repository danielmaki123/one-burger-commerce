export type PublicPriceOption = {
  priceDelta?: number | null;
  isActive?: boolean | null;
};

export type PublicPriceModifierGroup = {
  minSelections?: number | null;
  options?: PublicPriceOption[] | null;
};

type PublicPricedProduct = {
  basePrice: number;
  modifierGroups?: PublicPriceModifierGroup[] | null;
};

export function getPublicStartingPrice({
  basePrice,
  modifierGroups = [],
}: PublicPricedProduct): number {
  return (modifierGroups ?? []).reduce((startingPrice, group) => {
    const minimum = group.minSelections ?? 0;
    if (minimum <= 0) return startingPrice;

    const optionPrices = (group.options ?? [])
      .filter((option) => option.isActive !== false)
      .map((option) => option.priceDelta)
      .filter((price): price is number => Number.isFinite(price))
      .sort((left, right) => left - right);

    if (optionPrices.length < minimum) return startingPrice;

    return (
      startingPrice +
      optionPrices.slice(0, minimum).reduce((total, price) => total + price, 0)
    );
  }, basePrice);
}
