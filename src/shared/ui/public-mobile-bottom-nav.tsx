"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCart } from "@/shared/lib/cart";
import { Badge } from "@/shared/ui/badge";
import { getPublicMobileNavItems } from "@/shared/lib/public-mobile-nav";

export function PublicMobileBottomNav() {
  const pathname = usePathname();
  const { items: cartItems } = useCart();
  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const items = getPublicMobileNavItems(pathname);

  return (
    <nav
      aria-label="Navegación principal móvil"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/98 pb-[env(safe-area-inset-bottom)] md:hidden backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-md items-center justify-between px-2 pt-2">
        {items.map((item) => {
          const isCheckout = item.key === "checkout";
          const isActive = item.isActive;

          return (
            <Link
              key={item.key}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 py-2 text-[11px] font-medium leading-none transition-colors ${
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-[14px] ${
                  isActive
                    ? "bg-brand text-brand-foreground"
                    : "text-foreground/70"
                }`}
              >
                <NavIcon itemKey={item.key} />
              </span>
              <span className="w-full text-center">{item.label}</span>
              {isCheckout && cartItemCount > 0 ? (
                <Badge
                  variant="default"
                  className="absolute right-3 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px]"
                >
                  {cartItemCount}
                </Badge>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function NavIcon({
  itemKey,
}: {
  itemKey: "home" | "menu" | "checkout";
}) {
  switch (itemKey) {
    case "home":
      return (
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="m3 10.5 9-7 9 7" />
          <path d="M5 10v10h14V10" />
          <path d="M9 20v-6h6v6" />
        </svg>
      );
    case "menu":
      return (
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h16" />
        </svg>
      );
    case "checkout":
      return (
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <circle cx="8" cy="21" r="1" />
          <circle cx="19" cy="21" r="1" />
          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
        </svg>
      );
  }
}
