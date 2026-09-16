import { ADMIN_ROLES, type AdminRole } from "@/modules/auth/domain/admin-role";

export type RoleOption = {
  value: AdminRole;
  label: string;
  detail: string;
  /** Tinte del chip del rol: una sola fuente para la fila y para el formulario. */
  tone: string;
};

/**
 * Los cuatro roles operativos con lo que puede hacer cada uno.
 *
 * El detalle no es decorativo: es el texto que el owner lee antes de crear el acceso (la referencia
 * lo muestra debajo del selector), así que vive acá y lo comparten la fila y el formulario. Están los
 * cuatro del enum: si falta uno, su fila muestra el rol equivocado y el selector queda sin opción.
 */
export const ROLE_OPTIONS: RoleOption[] = [
  {
    value: ADMIN_ROLES.manager,
    label: "Gerente",
    detail: "Puede aceptar órdenes y editar el menú.",
    tone: "border-brand-primary/30 bg-brand-primary-muted text-brand-primary",
  },
  {
    value: ADMIN_ROLES.cashier,
    label: "Cajero",
    detail: "Cobra en el punto de venta y abre y cierra la caja.",
    tone: "border-brand-primary/30 bg-brand-primary-muted text-brand-primary",
  },
  {
    value: ADMIN_ROLES.kitchen,
    label: "Cocina",
    detail: "Puede aceptar y avanzar órdenes.",
    tone: "border-line-subtle bg-surface-elevated text-ink-secondary",
  },
  {
    value: ADMIN_ROLES.owner,
    label: "Dueño",
    detail: "Control total, incluyendo usuarios.",
    tone: "border-brand-amber/40 bg-brand-amber-soft text-brand-amber",
  },
];

export function roleOptionFor(role: AdminRole): RoleOption {
  return (
    ROLE_OPTIONS.find((option) => option.value === role) ?? {
      value: role,
      label: role,
      detail: "",
      tone: "border-line-subtle bg-surface-elevated text-ink-secondary",
    }
  );
}
