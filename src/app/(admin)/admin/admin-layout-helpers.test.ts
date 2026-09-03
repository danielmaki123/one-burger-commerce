import { describe, expect, it } from "vitest";

import {
  getAdminDesktopFocusTargetIndex,
  getAdminNavGroups,
  getFocusTrapTargetIndex,
  isAdminNavItemActive,
  shouldRestoreAdminMobileTriggerFocus,
} from "./admin-layout-helpers";

function flattenNav(role?: "owner" | "manager" | "kitchen") {
  return getAdminNavGroups(role).flatMap((group) => group.items);
}

describe("admin layout helpers", () => {
  it("shows Resumen and Usuarios to owner", () => {
    expect(flattenNav("owner")).toContainEqual(
      expect.objectContaining({
        href: "/admin",
        label: "Resumen",
        description: "Operación y rendimiento",
      }),
    );
    expect(flattenNav("owner")).toContainEqual(
      expect.objectContaining({
        href: "/admin/users",
        label: "Usuarios",
      }),
    );
  });

  it.each([undefined, "manager", "kitchen"] as const)(
    "does not expose /admin summary before owner access is known (%s)",
    (role) => {
      expect(flattenNav(role)).not.toContainEqual(
        expect.objectContaining({ href: "/admin" }),
      );
    },
  );

  it("lets manager see orders and menu but not users", () => {
    const items = flattenNav("manager");
    expect(items).toContainEqual(expect.objectContaining({ href: "/admin/orders" }));
    expect(items).toContainEqual(expect.objectContaining({ href: "/admin/menu" }));
    expect(items).not.toContainEqual(expect.objectContaining({ href: "/admin/users" }));
  });

  it("lets kitchen see only orders", () => {
    expect(flattenNav("kitchen").map((item) => item.href)).toEqual(["/admin/orders"]);
  });

  it("keeps /admin/dashboard active for the Resumen compatibility redirect", () => {
    expect(isAdminNavItemActive("/admin/dashboard", "/admin")).toBe(true);
    expect(isAdminNavItemActive("/admin", "/admin")).toBe(true);
  });

  it.each([
    [{ focusableCount: 3, currentIndex: 2, shiftKey: false }, 0],
    [{ focusableCount: 3, currentIndex: 0, shiftKey: true }, 2],
    [{ focusableCount: 3, currentIndex: -1, shiftKey: false }, 0],
    [{ focusableCount: 3, currentIndex: -1, shiftKey: true }, 2],
    [{ focusableCount: 3, currentIndex: 1, shiftKey: false }, null],
    [{ focusableCount: 0, currentIndex: -1, shiftKey: false }, null],
  ])("returns the focus target required to keep Tab inside the drawer", (input, expected) => {
    expect(getFocusTrapTargetIndex(input)).toBe(expected);
  });

  it.each([
    [
      [
        { isActive: false, isVisible: true },
        { isActive: true, isVisible: true },
      ],
      1,
    ],
    [
      [
        { isActive: true, isVisible: false },
        { isActive: false, isVisible: true },
      ],
      1,
    ],
    [[{ isActive: false, isVisible: false }], null],
  ])(
    "selects an active visible desktop destination before its visible fallback",
    (items, expected) => {
      expect(getAdminDesktopFocusTargetIndex(items)).toBe(expected);
    },
  );

  it.each([
    [
      "the managed desktop destination still owns focus",
      {
        isMobileViewport: true,
        focusWasMovedToDesktop: true,
        activeElementIsManagedTarget: true,
        activeElementIsVisible: false,
      },
      true,
    ],
    [
      "focus moved to an element hidden by the mobile breakpoint",
      {
        isMobileViewport: true,
        focusWasMovedToDesktop: true,
        activeElementIsManagedTarget: false,
        activeElementIsVisible: false,
      },
      true,
    ],
    [
      "the user moved focus to a main control that remains visible",
      {
        isMobileViewport: true,
        focusWasMovedToDesktop: true,
        activeElementIsManagedTarget: false,
        activeElementIsVisible: true,
      },
      false,
    ],
    [
      "the drawer did not move focus to desktop",
      {
        isMobileViewport: true,
        focusWasMovedToDesktop: false,
        activeElementIsManagedTarget: false,
        activeElementIsVisible: false,
      },
      false,
    ],
    [
      "the viewport returned to desktop before the deferred restore",
      {
        isMobileViewport: false,
        focusWasMovedToDesktop: true,
        activeElementIsManagedTarget: true,
        activeElementIsVisible: false,
      },
      false,
    ],
  ])("restores the mobile trigger only when %s", (_case, input, expected) => {
    expect(shouldRestoreAdminMobileTriggerFocus(input)).toBe(expected);
  });
});
