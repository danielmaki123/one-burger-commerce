"use client";

import { ShieldCheck } from "lucide-react";

import { ADMIN_ROLES, type AdminRole } from "@/modules/auth/domain/admin-role";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Select } from "@/shared/ui/select";

import { roleOptionFor, ROLE_OPTIONS } from "./user-role-options";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  /** Sucursales asignadas (A). Vacío = ve todas. */
  locationIds: string[];
};

export type LocationOption = { id: string; name: string };

type UserRowProps = {
  user: AdminUser;
  locations: LocationOption[];
  busy: boolean;
  /** Con una sola sucursal no hay nada que asignar: el control no se dibuja. */
  showAssignments: boolean;
  draftLocationIds: string[];
  assignedLabel: string;
  onRoleChange: (role: AdminRole) => void;
  onRevoke: () => void;
  onToggleDraftLocation: (locationId: string, checked: boolean) => void;
  onSaveLocations: () => void;
};

/**
 * Fila de una cuenta operativa: quién es, con qué rol y qué sucursales alcanza.
 *
 * El rol se cambia en la fila (es la operación del día a día) y el acceso se revoca con una acción
 * explícita de 44 px; las sucursales se editan dentro de un desplegable para que la lista no se
 * convierta en un formulario gigante.
 */
export function UserRow({
  user,
  locations,
  busy,
  showAssignments,
  draftLocationIds,
  assignedLabel,
  onRoleChange,
  onRevoke,
  onToggleDraftLocation,
  onSaveLocations,
}: UserRowProps) {
  const role = roleOptionFor(user.role);
  const initial = user.name.trim().charAt(0).toUpperCase() || "A";

  return (
    <article className="grid gap-3 border-t border-line-subtle px-4 py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-stitch-md text-st-body font-bold ${role.tone}`}
        >
          {initial}
        </span>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-st-body font-semibold text-ink">{user.name}</span>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-st-caption font-bold uppercase tracking-wide ${role.tone}`}
            >
              {role.label}
            </span>
          </div>
          <p className="truncate text-st-caption text-ink-muted">{user.email}</p>

          <p className="mt-1 text-st-caption leading-5 text-ink-secondary">
            {assignedLabel}
          </p>

          {showAssignments && user.role !== ADMIN_ROLES.owner ? (
            <details className="mt-2">
              <summary className="min-h-11 cursor-pointer text-st-caption font-semibold text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">
                Cambiar sucursales de {user.name}
              </summary>
              <fieldset
                aria-label={`Sucursales de ${user.name}`}
                className="mt-2 space-y-2 rounded-stitch-md border border-line-subtle p-3"
              >
                {locations.map((location) => (
                  <Checkbox
                    key={location.id}
                    checked={draftLocationIds.includes(location.id)}
                    disabled={busy}
                    onChange={(event) =>
                      onToggleDraftLocation(location.id, event.target.checked)
                    }
                    label={location.name}
                  />
                ))}

                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full"
                  disabled={busy}
                  onClick={onSaveLocations}
                >
                  {busy ? "Guardando..." : `Guardar sucursales de ${user.name}`}
                </Button>
              </fieldset>
            </details>
          ) : null}
        </div>
      </div>

      <Select
        aria-label={`Rol de ${user.name}`}
        value={user.role}
        disabled={busy}
        onChange={(event) => onRoleChange(event.target.value as AdminRole)}
        options={ROLE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
      />

      <Button
        type="button"
        variant="outline"
        aria-label={`Revocar acceso de ${user.name}`}
        disabled={busy}
        onClick={onRevoke}
        className="min-h-11 w-full gap-2 sm:w-auto"
      >
        <ShieldCheck aria-hidden="true" className="h-4 w-4" />
        Revocar
      </Button>
    </article>
  );
}
