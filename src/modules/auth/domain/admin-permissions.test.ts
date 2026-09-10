import { describe, expect, it } from "vitest";

import {
  canManageBusinessSettings,
  canManageCriticalConfig,
  canManageInventoryOperations,
  canManageMenu,
  canManageOrderOperations,
  canManageUsers,
  canViewDashboardSummary,
  canViewOutboxEvents,
} from "@/modules/auth/domain/admin-permissions";
import { ADMIN_ROLES } from "@/modules/auth/domain/admin-role";

describe("admin permissions", () => {
  it("lets owner and manager manage the menu", () => {
    expect(canManageMenu(ADMIN_ROLES.owner)).toBe(true);
    expect(canManageMenu(ADMIN_ROLES.manager)).toBe(true);
    expect(canManageMenu(ADMIN_ROLES.kitchen)).toBe(false);
  });

  it("lets all admin roles operate orders", () => {
    expect(canManageOrderOperations(ADMIN_ROLES.owner)).toBe(true);
    expect(canManageOrderOperations(ADMIN_ROLES.manager)).toBe(true);
    expect(canManageOrderOperations(ADMIN_ROLES.kitchen)).toBe(true);
  });

  it("lets only owner manage users and critical config", () => {
    expect(canManageUsers(ADMIN_ROLES.owner)).toBe(true);
    expect(canManageCriticalConfig(ADMIN_ROLES.owner)).toBe(true);
    expect(canManageUsers(ADMIN_ROLES.manager)).toBe(false);
    expect(canManageCriticalConfig(ADMIN_ROLES.manager)).toBe(false);
    expect(canManageUsers(ADMIN_ROLES.kitchen)).toBe(false);
    expect(canManageCriticalConfig(ADMIN_ROLES.kitchen)).toBe(false);
  });

  it("lets only owner view dashboard summary", () => {
    expect(canViewDashboardSummary(ADMIN_ROLES.owner)).toBe(true);
    expect(canViewDashboardSummary(ADMIN_ROLES.manager)).toBe(false);
    expect(canViewDashboardSummary(ADMIN_ROLES.kitchen)).toBe(false);
  });

  it("lets only owner read outbox events because they carry customer PII", () => {
    expect(canViewOutboxEvents(ADMIN_ROLES.owner)).toBe(true);
    expect(canViewOutboxEvents(ADMIN_ROLES.manager)).toBe(false);
    expect(canViewOutboxEvents(ADMIN_ROLES.kitchen)).toBe(false);
  });

  it("lets owner and manager run inventory operations", () => {
    expect(canManageInventoryOperations(ADMIN_ROLES.owner)).toBe(true);
    expect(canManageInventoryOperations(ADMIN_ROLES.manager)).toBe(true);
    expect(canManageInventoryOperations(ADMIN_ROLES.kitchen)).toBe(false);
  });

  it("lets only owner change the business settings", () => {
    expect(canManageBusinessSettings(ADMIN_ROLES.owner)).toBe(true);
    expect(canManageBusinessSettings(ADMIN_ROLES.manager)).toBe(false);
    expect(canManageBusinessSettings(ADMIN_ROLES.kitchen)).toBe(false);
  });
});
