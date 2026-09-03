import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

let mockPathname = "/menu";
let mockCartItems = [] as Array<{ quantity: number }>;

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => createElement("a", { href, ...props }, children),
}));

vi.mock("@/shared/lib/cart", () => ({
  useCart: () => ({ items: mockCartItems }),
}));

import { PublicMobileBottomNav } from "./public-mobile-bottom-nav";

describe("PublicMobileBottomNav", () => {
  beforeEach(() => {
    mockPathname = "/menu";
    mockCartItems = [{ quantity: 2 }];
  });

  it("renders as a docked footer instead of a floating pill", () => {
    const html = renderToStaticMarkup(createElement(PublicMobileBottomNav));

    expect(html).toContain(
      "fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/98",
    );
    expect(html).toContain("pb-[env(safe-area-inset-bottom)]");
    expect(html).not.toContain("rounded-[24px]");
    expect(html).not.toContain("shadow-[0_12px_32px_rgba(60,40,20,0.18)]");
  });

  it("keeps reservations and activity out of the pickup MVP nav", () => {
    const html = renderToStaticMarkup(createElement(PublicMobileBottomNav));

    expect(html).toContain("Menú");
    expect(html).toContain("Carrito");
    expect(html).not.toContain("Reservar");
    expect(html).not.toContain("Historial");
  });
});
