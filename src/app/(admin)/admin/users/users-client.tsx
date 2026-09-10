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
};

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
  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    password: "",
    role: ADMIN_ROLES.kitchen as AdminRole,
  });

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
        body: JSON.stringify(formData),
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
