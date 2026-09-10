/* global URL, Response, caches, fetch, self */

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const STATIC_CACHE_PREFIX = "one-burger-static-";
const STATIC_CACHE_NAME = `${STATIC_CACHE_PREFIX}${VERSION}`;
// Los logos son URLs que se configuran desde /admin/settings: precachear una
// ruta fija dejaba el logo viejo clavado en el PWA ya instalado.
const STATIC_ASSETS = [
  "/manifest.webmanifest",
];

function isStaticAssetPath(pathname) {
  return (
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json" ||
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/brand/") ||
    /\.(css|gif|ico|jpeg|jpg|js|png|svg|webp|woff|woff2)$/i.test(pathname)
  );
}

function resolveStrategy(request) {
  if (request.method !== "GET") {
    return "passthrough";
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin && url.pathname.startsWith("/api/")) {
    return "network-only";
  }

  if (request.mode === "navigate") {
    return "network-first";
  }

  if (isSameOrigin && isStaticAssetPath(url.pathname)) {
    return "stale-while-revalidate";
  }

  return "passthrough";
}

async function broadcastActivation() {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  for (const client of clients) {
    client.postMessage({
      type: "SW_ACTIVATED",
      version: VERSION,
    });
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(
            (cacheName) =>
              cacheName.startsWith(STATIC_CACHE_PREFIX) &&
              cacheName !== STATIC_CACHE_NAME,
          )
          .map((cacheName) => caches.delete(cacheName)),
      );
      await self.clients.claim();
      await broadcastActivation();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const strategy = resolveStrategy(event.request);

  if (strategy === "passthrough") {
    return;
  }

  if (strategy === "network-only") {
    event.respondWith(fetch(event.request));
    return;
  }

  if (strategy === "network-first") {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE_NAME);
      const cachedResponse = await cache.match(event.request);
      const networkResponsePromise = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            cache.put(event.request, response.clone()).catch(() => undefined);
          }
          return response;
        })
        .catch(() => null);

      if (cachedResponse) {
        void networkResponsePromise;
        return cachedResponse;
      }

      return networkResponsePromise || Response.error();
    })(),
  );
});
