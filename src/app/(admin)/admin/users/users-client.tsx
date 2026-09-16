"use client";

import * as React from "react";

import { ADMIN_ROLES, type AdminRole } from "@/modules/auth/domain/admin-role";
import { Button } from "@/shared/ui/button";

import { AdminEmptyState, AdminPageHeader } from "../_components/admin-operational-ui";
import { UserCreateForm } from "./user-create-form";
import { UserRow, type AdminUser, type LocationOption } from "./user-row";
import { describeAssignedLocations, getErrorMessage } from "./users-helpers";

type Feedback = { type: "success" | "error"; message: string };

/**
 * Usuarios y accesos (`/admin/users`).
 *
 * La referencia trae tres cosas que acá no se portan, con su motivo: los contadores de "Sesiones
 * cifradas / Última revocación / 2FA" no existen en el backend (no hay registro de sesiones ni
 * segundo factor), los perfiles "Master" y "Sandbox" no son roles del sistema, y el buscador vive en
 * una barra superior que este panel no tiene. Los roles reales son Dueño, Gerente y Cocina.
 */
export default function AdminUsersPage() {
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [busyUserId, setBusyUserId] = React.useState<string | null>(null);
  const [locations, setLocations] = React.useState<LocationOption[]>([]);
  const [locationsError, setLocationsError] = React.useState(false);
  const [draftLocationIds, setDraftLocationIds] = React.useState<Record<string, string[]>>({});
  const [formLocationIds, setFormLocationIds] = React.useState<string[]>([]);
  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    password: "",
    role: ADMIN_ROLES.kitchen as AdminRole,
  });

  /**
   * Sucursales para asignar (A). Se piden solo para dibujar el control: con **una sola** sucursal
   * no se muestra, porque "asignada" y "sin asignar" serían lo mismo.
   */
  React.useEffect(() => {
    let cancelled = false;

    async function fetchLocations() {
      try {
        const response = await fetch("/api/admin/locations");
        if (!response.ok) {
          if (!cancelled) setLocationsError(true);
          return;
        }

        const payload = (await response.json()) as {
          data?: Array<{ id?: string; name?: string }>;
        };
        const list = (payload.data ?? [])
          .filter((location) => typeof location.id === "string" && typeof location.name === "string")
          .map((location) => ({ id: location.id as string, name: location.name as string }));

        if (!cancelled) setLocations(list);
      } catch {
        if (!cancelled) setLocationsError(true);
      }
    }

    void fetchLocations();

    return () => {
      cancelled = true;
    };
  }, []);

  const showAssignments = locations.length > 1;

  const toggleDraftLocation = (userId: string, locationId: string, checked: boolean) => {
    setDraftLocationIds((current) => {
      const selected = current[userId] ?? users.find((user) => user.id === userId)?.locationIds ?? [];
      const next = checked
        ? [...selected, locationId]
        : selected.filter((id) => id !== locationId);

      return { ...current, [userId]: next };
    });
  };

  const handleLocationsChange = async (user: AdminUser, locationIds: string[]) => {
    setBusyUserId(user.id);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationIds }),
      });

      if (!response.ok) {
        setFeedback({
          type: "error",
          message: getErrorMessage(await response.json(), "No se pudieron guardar las sucursales."),
        });
        return;
      }

      setUsers((current) =>
        current.map((entry) => (entry.id === user.id ? { ...entry, locationIds } : entry)),
      );
      setDraftLocationIds((current) => {
        const next = { ...current };
        delete next[user.id];
        return next;
      });
      setFeedback({ type: "success", message: "Sucursales actualizadas." });
    } catch {
      setFeedback({
        type: "error",
        message: "No se pudieron guardar las sucursales. Revisa la conexión.",
      });
    } finally {
      setBusyUserId(null);
    }
  };

  const fetchUsers = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/admin/users");
      if (!response.ok) {
        throw new Error("No se pudieron cargar los usuarios.");
      }

      const payload = await response.json();
      setUsers(Array.isArray(payload.data) ? payload.data : []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // El control solo existe con más de una sucursal; sin él, el usuario ve todas.
        body: JSON.stringify(
          showAssignments ? { ...formData, locationIds: formLocationIds } : formData,
        ),
      });

      if (!response.ok) {
        setFeedback({
          type: "error",
          message: getErrorMessage(await response.json(), "No se pudo crear el usuario."),
        });
        return;
      }

      setFeedback({ type: "success", message: "Usuario creado correctamente." });
      setFormData({
        name: "",
        email: "",
        password: "",
        role: ADMIN_ROLES.kitchen,
      });
      setFormLocationIds([]);
      await fetchUsers();
    } catch {
      setFeedback({ type: "error", message: "No se pudo crear el usuario. Revisa la conexión." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleChange = async (user: AdminUser, role: AdminRole) => {
    if (role === user.role) return;

    setBusyUserId(user.id);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        setFeedback({
          type: "error",
          message: getErrorMessage(await response.json(), "No se pudo cambiar el rol."),
        });
        return;
      }

      setUsers((current) =>
        current.map((entry) => (entry.id === user.id ? { ...entry, role } : entry)),
      );
      setFeedback({ type: "success", message: "Rol actualizado." });
    } catch {
      setFeedback({
        type: "error",
        message: "No se pudo cambiar el rol. Revisa la conexión.",
      });
    } finally {
      setBusyUserId(null);
    }
  };

  const handleRevoke = async (user: AdminUser) => {
    const confirmed = window.confirm(
      `¿Revocar el acceso de ${user.name}? Se cierran sus sesiones abiertas.`,
    );

    if (!confirmed) return;

    setBusyUserId(user.id);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setFeedback({
          type: "error",
          message: getErrorMessage(await response.json(), "No se pudo revocar el acceso."),
        });
        return;
      }

      setUsers((current) => current.filter((entry) => entry.id !== user.id));
      setFeedback({ type: "success", message: "Acceso revocado." });
    } catch {
      setFeedback({
        type: "error",
        message: "No se pudo revocar el acceso. Revisa la conexión.",
      });
    } finally {
      setBusyUserId(null);
    }
  };

  const ownerCount = users.filter((user) => user.role === ADMIN_ROLES.owner).length;
  // Los contadores viven en la cabecera de la lista, no en la de la página: chips + acción primaria
  // envuelven a dos filas en celular y la cabecera se come el 20% del alto (§8.4).
  const summaryChips = [
    { label: "Operadores", value: users.length - ownerCount },
    { label: "Sucursales", value: locations.length },
    { label: "Dueños", value: ownerCount },
  ];

  return (
    <div className="space-y-5 pb-8">
      <AdminPageHeader
        label="Control de personal · RBAC activo"
        title="Usuarios"
        description="Cuentas operativas con permisos por rol."
      />

      {feedback ? (
        <div
          aria-live="polite"
          className={`rounded-stitch-lg border px-4 py-3 text-st-body font-medium ${
            feedback.type === "success"
              ? "border-status-ready-border bg-status-ready-bg text-status-ready-text"
              : "border-status-sla-border bg-status-sla-bg text-status-sla-text"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="min-w-0 overflow-hidden rounded-stitch-lg border border-line-subtle bg-surface-card shadow-elevation-1">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4">
            <div>
              <p className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
                Equipo
              </p>
              <h2 className="mt-1 font-heading text-st-h3 font-bold text-ink">Cuentas activas</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {summaryChips.map((chip) => (
                <span
                  key={chip.label}
                  className="inline-flex items-center gap-1.5 rounded-stitch-md bg-surface-low px-2.5 py-1 text-st-caption font-semibold text-ink-secondary"
                >
                  {chip.label}:{" "}
                  <span className="font-mono font-bold tabular-nums text-ink">{chip.value}</span>
                </span>
              ))}
            </div>
          </div>

          {loading ? (
            <p
              role="status"
              className="border-t border-line-subtle px-4 py-6 text-st-body text-ink-secondary"
            >
              Cargando usuarios...
            </p>
          ) : loadError ? (
            <div className="border-t border-line-subtle p-4">
              <AdminEmptyState
                title="No se pudieron cargar los usuarios"
                description={loadError}
                action={
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => void fetchUsers()}
                  >
                    Reintentar
                  </Button>
                }
              />
            </div>
          ) : users.length === 0 ? (
            <div className="border-t border-line-subtle p-4">
              <AdminEmptyState
                title="Sin usuarios"
                description="Crea la primera cuenta operativa para cocina o gerencia."
              />
            </div>
          ) : (
            <>
              <div className="border-t border-line-subtle">
                {users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    locations={locations}
                    busy={busyUserId === user.id}
                    showAssignments={showAssignments}
                    draftLocationIds={draftLocationIds[user.id] ?? user.locationIds}
                    assignedLabel={describeAssignedLocations(user, locations)}
                    onRoleChange={(role) => void handleRoleChange(user, role)}
                    onRevoke={() => void handleRevoke(user)}
                    onToggleDraftLocation={(locationId, checked) =>
                      toggleDraftLocation(user.id, locationId, checked)
                    }
                    onSaveLocations={() =>
                      void handleLocationsChange(user, draftLocationIds[user.id] ?? user.locationIds)
                    }
                  />
                ))}
              </div>

              <p className="border-t border-line-subtle bg-surface-low px-4 py-3 text-st-caption leading-5 text-ink-secondary">
                Jerarquía de permisos: <strong className="text-ink">Dueño</strong> tiene control
                total, incluyendo usuarios; <strong className="text-ink">Gerente</strong> acepta
                órdenes y edita el menú; <strong className="text-ink">Cocina</strong> solo trabaja en
                el tablero de comandas de sus sucursales.
              </p>
            </>
          )}
        </div>

        <UserCreateForm
          formData={formData}
          locations={locations}
          formLocationIds={formLocationIds}
          locationsError={locationsError}
          isSaving={isSaving}
          showAssignments={showAssignments}
          onFieldChange={(patch) => setFormData((current) => ({ ...current, ...patch }))}
          onToggleLocation={(locationId, checked) =>
            setFormLocationIds((current) =>
              checked ? [...current, locationId] : current.filter((id) => id !== locationId),
            )
          }
          onSubmit={(event) => void handleSubmit(event)}
        />
      </section>
    </div>
  );
}
