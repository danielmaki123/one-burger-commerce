export type UpdateRouteKind = "safe" | "critical" | "neutral";

const SAFE_ROUTES = new Set(["/", "/menu", "/activity"]);
const CRITICAL_EXACT_ROUTES = new Set([
  "/cart",
  "/checkout",
  "/reservations",
  "/orders",
  "/orders/track",
]);
const SUCCESS_ROUTE_PATTERN = /^\/success\/[^/]+$/;
const MENU_PRODUCT_ROUTE_PATTERN = /^\/menu\/[^/]+$/;

function normalizePathname(pathname: string) {
  const [withoutHash] = pathname.split("#");
  const [normalized] = withoutHash.split("?");
  return normalized || "/";
}

export function classifyUpdateRoute(pathname: string): UpdateRouteKind {
  const normalized = normalizePathname(pathname);

  if (SAFE_ROUTES.has(normalized) || SUCCESS_ROUTE_PATTERN.test(normalized)) {
    return "safe";
  }

  if (
    CRITICAL_EXACT_ROUTES.has(normalized) ||
    normalized.startsWith("/checkout/") ||
    normalized.startsWith("/reservations/") ||
    normalized.startsWith("/orders/") ||
    MENU_PRODUCT_ROUTE_PATTERN.test(normalized)
  ) {
    return "critical";
  }

  return "neutral";
}
