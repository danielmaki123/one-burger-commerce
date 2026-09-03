export type PublicMobileNavItem = {
  href: string;
  key: "home" | "menu" | "checkout";
  label: "Inicio" | "Menú" | "Carrito";
};

export const PUBLIC_MOBILE_NAV_ITEMS: PublicMobileNavItem[] = [
  { key: "home", href: "/", label: "Inicio" },
  { key: "menu", href: "/menu", label: "Menú" },
  { key: "checkout", href: "/cart", label: "Carrito" },
];

export function isPublicMobileNavActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/cart") {
    return pathname === "/cart" || pathname === "/checkout";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getPublicMobileNavItems(pathname: string) {
  return PUBLIC_MOBILE_NAV_ITEMS.map((item) => ({
    ...item,
    isActive: isPublicMobileNavActive(pathname, item.href),
  }));
}
