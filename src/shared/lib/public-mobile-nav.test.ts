import { describe, expect, it } from "vitest";

import {
  getPublicMobileNavItems,
  isPublicMobileNavActive,
  PUBLIC_MOBILE_NAV_ITEMS,
} from "./public-mobile-nav";

describe("public mobile nav", () => {
  it("renders the expected primary navigation items", () => {
    expect(PUBLIC_MOBILE_NAV_ITEMS).toEqual([
      { key: "home", href: "/", label: "Inicio" },
      { key: "menu", href: "/menu", label: "Menú" },
      { key: "checkout", href: "/cart", label: "Carrito" },
    ]);
  });

  it("does not mark home active outside the exact root route", () => {
    expect(isPublicMobileNavActive("/", "/")).toBe(true);
    expect(isPublicMobileNavActive("/menu", "/")).toBe(false);
  });

  it("keeps cart active in cart and checkout routes", () => {
    expect(isPublicMobileNavActive("/cart", "/cart")).toBe(true);
    expect(isPublicMobileNavActive("/checkout", "/cart")).toBe(true);
  });

  it("returns one active item for cart review paths", () => {
    const items = getPublicMobileNavItems("/cart");
    const activeItems = items.filter((item) => item.isActive);

    expect(activeItems).toHaveLength(1);
    expect(activeItems[0]?.key).toBe("checkout");
  });
});
