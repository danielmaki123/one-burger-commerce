"use client";

import * as React from "react";
import { ShieldCheck, UserPlus, Users } from "lucide-react";

import { ADMIN_ROLES, type AdminRole } from "@/modules/auth/domain/admin-role";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  AdminEmptyState,
  AdminPageHeader,
} from "../_components/admin-operational-ui";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  /** Sucursales asignadas (A). Vacío = ve todas. */
  locationIds: string[];
};

type LocationOption = { id: string; name: string };

type Feedback = { type: "success" | "error"; message: string };

const ROLE_OPTIONS: Array<{ value: AdminRole; label: string; detail: string }> = [
  {
    value: ADMIN_ROLES.manager,
    label: "Gerente",
    detail: "Puede aceptar órdenes y editar el menú.",
  },
  {
    value: ADMIN_ROLES.kitchen,
    label: "Cocina",
    detail: "Puede aceptar y avanzar órdenes.",
  },
  {
    value: ADMIN_ROLES.owner,
    label: "Dueño",
    detail: "Control total, incluyendo usuarios.",
  },
];

const SELECT_CLASS =
  "h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

function getErrorMessage(payload: unknown, fallback: string) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }

  return fallback;
}

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

  /** Lo que ve cada usuario, en una línea: es lo que el owner necesita leer de un vistazo. */
  const describeAssignedLocations = (user: AdminUser) => {
    if (user.role === ADMIN_ROLES.owner) return "Ve todas las sucursales";
    if (user.locationIds.length === 0) return "Sin asignar · ve todas";

    const names = user.locationIds
      .map((id) => locations.find((location) => location.id === id)?.name)
      .filter((name): name is string => Boolean(name));

    return names.length > 0 ? `Asignado a: ${names.join(", ")}` : "Asignado a una sucursal";
  };

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
          message: getErrorMessage(
            await response.json(),
            "No se pudo cambiar el rol.",
          ),
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

  return (
    <div className="space-y-5 pb-8">
      <AdminPageHeader
        label="Accesos"
        title="Usuarios"
        description="Crea cuentas operativas con permisos cerrados por rol."
      />

      {feedback ? (
        <div
          aria-live="polite"
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "border-success-strong/30 bg-success text-success-foreground"
              : "border-danger-strong/30 bg-danger text-danger-foreground"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Equipo
              </p>
              <h2 className="mt-1 text-lg font-bold text-foreground">Cuentas activas</h2>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-brand">
              <Users aria-hidden="true" className="h-5 w-5" />
            </span>
          </div>

          {loading ? (
            <div className="flex h-36 items-center justify-center border-t border-border text-sm text-muted-foreground">
              Cargando usuarios...
            </div>
          ) : loadError ? (
            <div className="border-t border-border p-4">
              <AdminEmptyState
                title="No se pudieron cargar los usuarios"
                description={loadError}
                action={
                  <Button type="button" variant="outline" onClick={() => void fetchUsers()}>
                    Reintentar
                  </Button>
                }
              />
            </div>
          ) : users.length === 0 ? (
            <div className="border-t border-border p-4">
              <AdminEmptyState
                title="Sin usuarios"
                description="Crea la primera cuenta operativa para cocina o gerencia."
              />
            </div>
          ) : (
            <div className="divide-y divide-border border-t border-border">
              {users.map((user) => (
                <article
                  key={user.id}
                  className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {describeAssignedLocations(user)}
                    </p>
                    {showAssignments && user.role !== ADMIN_ROLES.owner ? (
                      <details className="mt-2">
                        <summary className="min-h-11 cursor-pointer text-xs font-semibold text-brand">
                          Cambiar sucursales de {user.name}
                        </summary>
                        <fieldset
                          aria-label={`Sucursales de ${user.name}`}
                          className="mt-2 space-y-2 rounded-xl border border-border p-3"
                        >
                          {locations.map((location) => {
                            const selected = (
                              draftLocationIds[user.id] ?? user.locationIds
                            ).includes(location.id);

                            return (
                              <label
                                key={location.id}
                                className="flex min-h-11 items-center gap-2 text-sm text-foreground"
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  disabled={busyUserId === user.id}
                                  onChange={(event) =>
                                    toggleDraftLocation(user.id, location.id, event.target.checked)
                                  }
                                  className="h-5 w-5 rounded border-border"
                                />
                                {location.name}
                              </label>
                            );
                          })}

                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11 w-full"
                            disabled={busyUserId === user.id}
                            onClick={() =>
                              void handleLocationsChange(
                                user,
                                draftLocationIds[user.id] ?? user.locationIds,
                              )
                            }
                          >
                            {busyUserId === user.id
                              ? "Guardando..."
                              : `Guardar sucursales de ${user.name}`}
                          </Button>
                        </fieldset>
                      </details>
                    ) : null}
                  </div>
                  <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                    Rol
                    <select
                      aria-label={`Rol de ${user.name}`}
                      value={user.role}
                      disabled={busyUserId === user.id}
                      onChange={(event) =>
                        void handleRoleChange(user, event.target.value as AdminRole)
                      }
                      className={`${SELECT_CLASS} min-h-11`}
                    >
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    aria-label={`Revocar acceso de ${user.name}`}
                    disabled={busyUserId === user.id}
                    onClick={() => void handleRevoke(user)}
                    className="min-h-11 w-full gap-2 sm:w-auto"
                  >
                    <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                    Revocar
                  </Button>
                </article>
              ))}
            </div>
          )}
        </div>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="rounded-2xl border border-border bg-card p-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-brand">
              <UserPlus aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nuevo usuario
              </p>
              <h2 className="mt-1 text-lg font-bold text-foreground">Crear acceso</h2>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            <Input
              label="Nombre"
              value={formData.name}
              onChange={(event) =>
                setFormData((current) => ({ ...current, name: event.target.value }))
              }
              required
            />
            <Input
              label="Correo"
              type="email"
              value={formData.email}
              onChange={(event) =>
                setFormData((current) => ({ ...current, email: event.target.value }))
              }
              required
            />
            <Input
              label="Contraseña temporal"
              type="password"
              minLength={8}
              value={formData.password}
              onChange={(event) =>
                setFormData((current) => ({ ...current, password: event.target.value }))
              }
              required
            />
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Rol
              <select
                aria-label="Rol del nuevo usuario"
                value={formData.role}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    role: event.target.value as AdminRole,
                  }))
                }
                className={SELECT_CLASS}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-xl bg-secondary p-3 text-xs leading-5 text-muted-foreground">
              {ROLE_OPTIONS.find((option) => option.value === formData.role)?.detail}
            </div>

            {/* Con una sola sucursal no hay nada que asignar: el control no se dibuja. */}
            {showAssignments ? (
              <fieldset
                aria-label="Sucursales asignadas"
                className="space-y-2 rounded-xl border border-border p-3"
              >
                <legend className="px-1 text-sm font-medium text-foreground">Sucursales</legend>
                {locations.map((location) => (
                  <label
                    key={location.id}
                    className="flex min-h-11 items-center gap-2 text-sm text-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={formLocationIds.includes(location.id)}
                      onChange={(event) =>
                        setFormLocationIds((current) =>
                          event.target.checked
                            ? [...current, location.id]
                            : current.filter((id) => id !== location.id),
                        )
                      }
                      className="h-5 w-5 rounded border-border"
                    />
                    {location.name}
                  </label>
                ))}
                <p className="text-xs text-muted-foreground">
                  Sin ninguna marcada, el usuario ve todas las sucursales.
                </p>
              </fieldset>
            ) : locationsError ? (
              <p className="text-xs text-danger-foreground">
                No se pudieron cargar las sucursales.
              </p>
            ) : null}

            <Button
              type="submit"
              className="min-h-11 gap-2"
              disabled={
                isSaving ||
                !formData.name.trim() ||
                !formData.email.trim() ||
                formData.password.length < 8
              }
            >
              <UserPlus aria-hidden="true" className="h-4 w-4" />
              {isSaving ? "Creando..." : "Crear usuario"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
