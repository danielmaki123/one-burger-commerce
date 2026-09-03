export type ServiceWorkerStrategy =
  | "passthrough"
  | "network-only"
  | "network-first"
  | "stale-while-revalidate";

function isStaticAssetPath(pathname: string) {
  return (
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json" ||
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/brand/") ||
    /\.(?:css|gif|ico|jpeg|jpg|js|png|svg|webp|woff|woff2)$/i.test(pathname)
  );
}

export function resolveServiceWorkerRequestPolicy({
  requestMethod,
  requestMode,
  requestUrl,
  scopeOrigin,
}: {
  requestMethod: string;
  requestMode: RequestMode | string;
  requestUrl: string;
  scopeOrigin: string;
}) {
  if (requestMethod.toUpperCase() !== "GET") {
    return { strategy: "passthrough" as ServiceWorkerStrategy };
  }

  const url = new URL(requestUrl);
  const isSameOrigin = url.origin === scopeOrigin;

  if (isSameOrigin && url.pathname.startsWith("/api/")) {
    return { strategy: "network-only" as ServiceWorkerStrategy };
  }

  if (requestMode === "navigate") {
    return { strategy: "network-first" as ServiceWorkerStrategy };
  }

  if (isSameOrigin && isStaticAssetPath(url.pathname)) {
    return { strategy: "stale-while-revalidate" as ServiceWorkerStrategy };
  }

  return { strategy: "passthrough" as ServiceWorkerStrategy };
}
