"use client";

import { UserPlus } from "lucide-react";

import type { AdminRole } from "@/modules/auth/domain/admin-role";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";

import { roleOptionFor, ROLE_OPTIONS } from "./user-role-options";
import type { LocationOption } from "./user-row";

type UserCreateFormProps = {
  formData: { name: string; email: string; password: string; role: AdminRole };
  locations: LocationOption[];
  formLocationIds: string[];
  locationsError: boolean;
  isSaving: boolean;
  /** Con una sola sucursal no hay nada que asignar: el control no se dibuja. */
  showAssignments: boolean;
  onFieldChange: (patch: Partial<UserCreateFormProps["formData"]>) => void;
  onToggleLocation: (locationId: string, checked: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

/**
 * Alta de una cuenta operativa.
 *
 * El detalle del rol elegido se muestra abajo del selector: es lo que el owner lee antes de decidir,
 * y sale de la misma lista que usa la fila (`user-role-options`).
 */
export function UserCreateForm({
  formData,
  locations,
  formLocationIds,
  locationsError,
  isSaving,
  showAssignments,
  onFieldChange,
  onToggleLocation,
  onSubmit,
}: UserCreateFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="min-w-0 rounded-stitch-lg border border-line-subtle bg-surface-card p-4 shadow-elevation-1"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-stitch-md bg-brand-primary-muted text-brand-primary">
          <UserPlus aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <p className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
            Nuevo usuario
          </p>
          <h2 className="mt-1 font-heading text-st-h3 font-bold text-ink">Crear acceso</h2>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <Input
          label="Nombre"
          value={formData.name}
          onChange={(event) => onFieldChange({ name: event.target.value })}
          required
        />
        <Input
          label="Correo"
          type="email"
          value={formData.email}
          onChange={(event) => onFieldChange({ email: event.target.value })}
          required
        />
        <Input
          label="Contraseña temporal"
          type="password"
          minLength={8}
          value={formData.password}
          onChange={(event) => onFieldChange({ password: event.target.value })}
          required
        />

        <Select
          aria-label="Rol del nuevo usuario"
          label="Rol en el sistema"
          value={formData.role}
          onChange={(event) => onFieldChange({ role: event.target.value as AdminRole })}
          options={ROLE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
        />

        <p className="rounded-stitch-md bg-surface-low p-3 text-st-caption leading-5 text-ink-secondary">
          {roleOptionFor(formData.role).detail}
        </p>

        {/* Con una sola sucursal no hay nada que asignar: el control no se dibuja. */}
        {showAssignments ? (
          <fieldset
            aria-label="Sucursales asignadas"
            className="space-y-2 rounded-stitch-md border border-line-subtle p-3"
          >
            <legend className="px-1 text-st-body font-semibold text-ink">Sucursales</legend>
            {locations.map((location) => (
              <Checkbox
                key={location.id}
                checked={formLocationIds.includes(location.id)}
                onChange={(event) => onToggleLocation(location.id, event.target.checked)}
                label={location.name}
              />
            ))}
            <p className="text-st-caption text-ink-secondary">
              Sin ninguna marcada, el usuario ve todas las sucursales.
            </p>
          </fieldset>
        ) : locationsError ? (
          <p role="alert" className="text-st-caption font-medium text-status-sla-text">
            No se pudieron cargar las sucursales.
          </p>
        ) : null}

        <Button
          type="submit"
          className="min-h-11 gap-2"
          disabled={
            isSaving || !formData.name.trim() || !formData.email.trim() || formData.password.length < 8
          }
        >
          <UserPlus aria-hidden="true" className="h-4 w-4" />
          {isSaving ? "Creando..." : "Crear usuario"}
        </Button>
      </div>
    </form>
  );
}
