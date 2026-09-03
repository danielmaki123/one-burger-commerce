export type MarketingBlockType = "promo" | "event" | "combo" | "featured" | "info";
export type MarketingBlockCtaType = "none" | "product" | "category" | "url";

export type MarketingBlockLike = {
  type: MarketingBlockType;
  ctaLabel: string | null;
  ctaType: MarketingBlockCtaType;
  ctaTarget: string | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

export const MARKETING_TYPE_LABELS: Record<MarketingBlockType, string> = {
  promo: "Promoción",
  event: "Evento",
  combo: "Combo",
  featured: "Destacado",
  info: "Información",
};

export type MarketingDisplayStatus = "active" | "scheduled" | "inactive";

export const MARKETING_STATUS_LABELS: Record<MarketingDisplayStatus, string> = {
  active: "Activo",
  scheduled: "Programado",
  inactive: "Inactivo",
};

// Un bloque activo con inicio futuro se muestra como "Programado".
export function getMarketingDisplayStatus(
  block: Pick<MarketingBlockLike, "isActive" | "startsAt" | "endsAt">,
  nowMs: number,
): MarketingDisplayStatus {
  if (!block.isActive) return "inactive";

  if (block.startsAt) {
    const startsAtMs = new Date(block.startsAt).getTime();
    if (Number.isFinite(startsAtMs) && startsAtMs > nowMs) return "scheduled";
  }

  if (block.endsAt) {
    const endsAtMs = new Date(block.endsAt).getTime();
    if (Number.isFinite(endsAtMs) && endsAtMs <= nowMs) return "inactive";
  }

  return "active";
}

function formatAdminDate(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

// Ventana de visibilidad en español: "Empieza el 10/08/2026", "Visible hasta el 26/08/2026".
export function describeMarketingWindow(
  block: Pick<MarketingBlockLike, "startsAt" | "endsAt">,
  nowMs: number,
): string {
  const parts: string[] = [];

  if (block.startsAt) {
    const startsAtMs = new Date(block.startsAt).getTime();
    const formatted = formatAdminDate(block.startsAt);
    if (Number.isFinite(startsAtMs) && formatted) {
      parts.push(startsAtMs > nowMs ? `Empieza el ${formatted}` : `Desde el ${formatted}`);
    }
  }

  if (block.endsAt) {
    const formatted = formatAdminDate(block.endsAt);
    if (formatted) parts.push(`Visible hasta el ${formatted}`);
  }

  return parts.length > 0 ? parts.join(" · ") : "Sin fecha de fin";
}

// CTA en español con el destino resuelto a nombre, nunca el id crudo.
export function describeMarketingCta(
  block: Pick<MarketingBlockLike, "ctaType" | "ctaLabel" | "ctaTarget">,
  resolveTargetName: (ctaType: MarketingBlockCtaType, target: string) => string | null,
): string {
  if (block.ctaType === "none") return "Sin botón";

  const label = block.ctaLabel?.trim() || "Ver más";
  const targetName = block.ctaTarget
    ? resolveTargetName(block.ctaType, block.ctaTarget)
    : null;

  if (targetName) return `Botón “${label}” → ${targetName}`;
  if (block.ctaType === "url" && block.ctaTarget) return `Botón “${label}” → enlace externo`;
  return `Botón “${label}”`;
}
