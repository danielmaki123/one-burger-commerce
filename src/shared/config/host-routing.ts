/**
 * Ruteo por host.
 *
 * El producto vive en tres dominios del mismo build: el apex muestra el landing,
 * `menu.*` la app de pedidos y `admin.*` el panel. Nada de esto tiene un dominio
 * de marca escrito en el código: se deduce del host de la request y se puede
 * forzar con `MENU_APP_URL` / `ADMIN_APP_URL` / `ADMIN_HOSTS`.
 */

export type HostKind = "brand" | "menu" | "admin" | "other";

export type HostRoute =
  | { action: "next" }
  | { action: "rewrite"; pathname: string }
  | { action: "redirect"; pathname: string }
  | { action: "redirectAbsolute"; url: string };

const MENU_HOST_LABEL = "menu";
const ADMIN_HOST_LABEL = "admin";
const WWW_HOST_LABEL = "www";
/** Hosts que da la plataforma de deploy y nunca son el dominio de marca. */
const PLATFORM_SUFFIXES = [".easypanel.host"];

/** Saca el puerto, el primer host de una lista y normaliza a minúsculas. */
export function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;

  const value = host.split(",")[0]?.trim().toLowerCase().replace(/:\d+$/, "") ?? "";
  return value.length > 0 ? value : null;
}

function isIpAddress(host: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(":");
}

function getConfiguredAdminHosts(): Set<string> {
  return new Set(
    (process.env.ADMIN_HOSTS ?? "")
      .split(",")
      .map((host) => normalizeHost(host))
      .filter((host): host is string => host !== null),
  );
}

/**
 * Clasifica el host de la request.
 *
 * `localhost`, las IPs y el host por defecto de la plataforma quedan como `other`
 * para que el entorno local y el dominio interno sigan sirviendo la app de
 * pedidos tal cual, sin landing ni redirecciones.
 */
export function classifyHost(host: string | null | undefined): HostKind {
  const normalized = normalizeHost(host);
  if (!normalized) return "other";
  if (getConfiguredAdminHosts().has(normalized)) return "admin";
  if (isIpAddress(normalized)) return "other";
  if (PLATFORM_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) return "other";

  const labels = normalized.split(".");
  if (labels.length < 2) return "other";

  if (labels[0] === ADMIN_HOST_LABEL) return "admin";
  if (labels[0] === MENU_HOST_LABEL) return "menu";

  return "brand";
}

/** `true` cuando el host es el del panel de admin. */
export function isAdminHost(host: string | null | undefined): boolean {
  return classifyHost(host) === "admin";
}

/** Dominio del negocio sin `www.`, `menu.` ni `admin.`. */
function brandApex(host: string | null | undefined): string | null {
  const normalized = normalizeHost(host);
  if (!normalized) return null;

  const labels = normalized.split(".");
  if (labels.length < 2) return null;
  if (isIpAddress(normalized)) return null;
  if (PLATFORM_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) return null;

  if (labels[0] === WWW_HOST_LABEL) return labels.slice(1).join(".");
  if (labels[0] === MENU_HOST_LABEL || labels[0] === ADMIN_HOST_LABEL) {
    return labels.slice(1).join(".");
  }

  return normalized;
}

function normalizeAppUrl(value: string | undefined): string | null {
  const trimmed = value?.trim().replace(/\/+$/, "");
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function resolveSubdomainAppUrl(
  host: string | null | undefined,
  label: string,
  kind: HostKind,
  envValue: string | undefined,
): string | null {
  const configured = normalizeAppUrl(envValue);
  if (configured) return configured;
  if (kind === label) return null;

  const apex = brandApex(host);
  return apex ? `https://${label}.${apex}` : null;
}

/** URL de la app de pedidos, o `null` si ya estamos en ella / no se puede deducir. */
export function resolveMenuAppUrl(host: string | null | undefined): string | null {
  return resolveSubdomainAppUrl(host, MENU_HOST_LABEL, classifyHost(host), process.env.MENU_APP_URL);
}

/** URL del panel de admin, o `null` si ya estamos en él / no se puede deducir. */
export function resolveAdminAppUrl(host: string | null | undefined): string | null {
  return resolveSubdomainAppUrl(host, ADMIN_HOST_LABEL, classifyHost(host), process.env.ADMIN_APP_URL);
}

/**
 * Qué hacer con una request según el host y el path.
 *
 * Fase 1: el apex muestra el landing y todo lo demás sigue igual (la app de
 * pedidos responde en cualquier host), así que el cambio no puede romper el
 * flujo de compra. Las reglas entre subdominios se suman cuando sus dominios
 * existen de verdad.
 */
export function resolveHostRoute({
  host,
  pathname,
}: {
  host: string | null | undefined;
  pathname: string;
}): HostRoute {
  const kind = classifyHost(host);

  if (pathname === "/") {
    if (kind === "brand") return { action: "rewrite", pathname: "/landing" };
    if (kind === "admin") return { action: "redirect", pathname: "/admin" };
  }

  return { action: "next" };
}
