export const ADMIN_ROLES = {
  owner: "owner",
  manager: "manager",
  kitchen: "kitchen",
  /** TASK-105 — cobra en el punto de venta. */
  cashier: "cashier",
} as const;

export type AdminRole = (typeof ADMIN_ROLES)[keyof typeof ADMIN_ROLES];

export function isAdminRole(value: string): value is AdminRole {
  return Object.values(ADMIN_ROLES).includes(value as AdminRole);
}
