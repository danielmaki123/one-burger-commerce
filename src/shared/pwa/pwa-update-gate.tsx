"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { APP_METADATA } from "@/shared/config/app-metadata";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";

import { resolveRequiredUpdate, shouldClearReloadGuard, shouldForceReloadOnce } from "./update-flow";
import { classifyUpdateRoute } from "./update-routes";

const RELOAD_GUARD_SESSION_KEY = "pwa-required-update:last-reloaded-version";
const PENDING_UPDATE_SESSION_KEY = "pwa-required-update:pending-version";

function normalizeVersion(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function extractVersionFromScriptUrl(scriptUrl: string | null | undefined) {
  if (!scriptUrl) return null;

  try {
    const url = new URL(scriptUrl, window.location.origin);
    return normalizeVersion(url.searchParams.get("v"));
  } catch {
    return null;
  }
}

function getWaitingWorkerVersion(registration: ServiceWorkerRegistration | null) {
  return extractVersionFromScriptUrl(registration?.waiting?.scriptURL);
}

function getActiveWorkerVersion(registration: ServiceWorkerRegistration | null) {
  return extractVersionFromScriptUrl(registration?.active?.scriptURL);
}

function getInstallingWorkerVersion(registration: ServiceWorkerRegistration | null) {
  return extractVersionFromScriptUrl(registration?.installing?.scriptURL);
}

async function waitForWaitingWorker(
  registration: ServiceWorkerRegistration,
  timeoutMs: number,
) {
  if (registration.waiting) {
    return registration.waiting;
  }

  return new Promise<ServiceWorker | null>((resolve) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve(registration.waiting ?? null);
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      registration.removeEventListener("updatefound", handleUpdateFound);
    };

    const subscribeToInstallingWorker = () => {
      const installing = registration.installing;
      if (!installing) return;

      const handleStateChange = () => {
        if (installing.state === "installed") {
          installing.removeEventListener("statechange", handleStateChange);
          cleanup();
          resolve(registration.waiting ?? installing);
        }
      };

      installing.addEventListener("statechange", handleStateChange);
    };

    const handleUpdateFound = () => {
      subscribeToInstallingWorker();
    };

    registration.addEventListener("updatefound", handleUpdateFound);
    subscribeToInstallingWorker();
  });
}

export function PwaUpdateGate() {
  const pathname = usePathname();
  const routeKind = classifyUpdateRoute(pathname);
  const currentVersion = APP_METADATA.version;
  const [pendingVersion, setPendingVersion] = useState<string | null>(null);
  const [waitingVersion, setWaitingVersion] = useState<string | null>(null);
  const [lastReloadedVersion, setLastReloadedVersion] = useState<string | null>(null);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);

  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const pendingVersionRef = useRef<string | null>(null);
  const waitingVersionRef = useRef<string | null>(null);
  const lastReloadedVersionRef = useRef<string | null>(null);
  const requestedReloadVersionRef = useRef<string | null>(null);

  useEffect(() => {
    pendingVersionRef.current = pendingVersion;
  }, [pendingVersion]);

  useEffect(() => {
    waitingVersionRef.current = waitingVersion;
  }, [waitingVersion]);

  useEffect(() => {
    lastReloadedVersionRef.current = lastReloadedVersion;
  }, [lastReloadedVersion]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedReloadedVersion = normalizeVersion(
      window.sessionStorage.getItem(RELOAD_GUARD_SESSION_KEY),
    );
    const storedPendingVersion = normalizeVersion(
      window.sessionStorage.getItem(PENDING_UPDATE_SESSION_KEY),
    );

    setLastReloadedVersion(storedReloadedVersion);
    setPendingVersion(storedPendingVersion);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (pendingVersion) {
      window.sessionStorage.setItem(PENDING_UPDATE_SESSION_KEY, pendingVersion);
      return;
    }

    window.sessionStorage.removeItem(PENDING_UPDATE_SESSION_KEY);
  }, [pendingVersion]);

  useEffect(() => {
    if (
      normalizeVersion(currentVersion) === normalizeVersion(pendingVersion) &&
      !waitingVersion
    ) {
      setPendingVersion(null);
    }
  }, [currentVersion, pendingVersion, waitingVersion]);

  const updateRequirement = useMemo(
    () =>
      resolveRequiredUpdate({
        pathname,
        currentVersion,
        pendingVersion,
        waitingVersion,
        lastReloadedVersion,
      }),
    [currentVersion, lastReloadedVersion, pathname, pendingVersion, waitingVersion],
  );

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      shouldClearReloadGuard({
        currentVersion,
        targetVersion: updateRequirement.targetVersion,
        lastReloadedVersion,
      })
    ) {
      window.sessionStorage.removeItem(RELOAD_GUARD_SESSION_KEY);
      setLastReloadedVersion(null);
    }
  }, [currentVersion, lastReloadedVersion, updateRequirement.targetVersion]);

  const syncWaitingWorker = useCallback((registration: ServiceWorkerRegistration | null) => {
    const detectedVersion = getWaitingWorkerVersion(registration);

    if (detectedVersion) {
      setWaitingVersion(detectedVersion);
      setPendingVersion((current) => current ?? detectedVersion);
      return;
    }

    setWaitingVersion(null);
  }, []);

  const registerVersionedWorker = useCallback(
    async (version: string) => {
      const registration = await navigator.serviceWorker.register(
        `/sw.js?v=${encodeURIComponent(version)}`,
        { scope: "/" },
      );

      registrationRef.current = registration;
      syncWaitingWorker(registration);
      return registration;
    },
    [syncWaitingWorker],
  );

  const probeForUpdate = useCallback(async () => {
    const shouldProbeBecauseOfRoute = routeKind === "safe";

    if (
      !shouldProbeBecauseOfRoute &&
      pendingVersionRef.current &&
      pendingVersionRef.current !== currentVersion
    ) {
      return;
    }

    try {
      const response = await fetch("/api/health", {
        cache: "no-store",
      });

      if (!response.ok) return;

      const payload = (await response.json()) as { version?: string };
      const serverVersion = normalizeVersion(payload.version);

      if (!serverVersion || serverVersion === currentVersion) {
        return;
      }

      setPendingVersion(serverVersion);

      const registration = registrationRef.current;
      if (!registration) {
        await registerVersionedWorker(serverVersion).catch(() => undefined);
        return;
      }

      const activeVersion = getActiveWorkerVersion(registration);
      const waitingWorkerVersion = getWaitingWorkerVersion(registration);
      const installingWorkerVersion = getInstallingWorkerVersion(registration);
      const needsTargetRegistration =
        activeVersion !== serverVersion &&
        waitingWorkerVersion !== serverVersion &&
        installingWorkerVersion !== serverVersion;

      if (needsTargetRegistration) {
        await registerVersionedWorker(serverVersion).catch(() => undefined);
        return;
      }

      await registration.update().catch(() => undefined);
      syncWaitingWorker(registration);
    } catch {
      // El gate no debe romper la app si el health check falla.
    }
  }, [currentVersion, registerVersionedWorker, routeKind, syncWaitingWorker]);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let disposed = false;

    const handleMessage = (event: MessageEvent<{ type?: string; version?: string }>) => {
      if (event.data?.type !== "SW_ACTIVATED") {
        return;
      }

      const activatedVersion = normalizeVersion(event.data.version);
      if (!activatedVersion) {
        return;
      }

      if (activatedVersion === currentVersion) {
        setPendingVersion(null);
        setWaitingVersion(null);
      }
    };

    const handleControllerChange = () => {
      const targetVersion = requestedReloadVersionRef.current;
      if (!targetVersion) {
        return;
      }

      setIsApplyingUpdate(false);

      if (
        !shouldForceReloadOnce({
          currentVersion,
          targetVersion,
          lastReloadedVersion: lastReloadedVersionRef.current,
        })
      ) {
        return;
      }

      window.sessionStorage.setItem(RELOAD_GUARD_SESSION_KEY, targetVersion);
      setLastReloadedVersion(targetVersion);
      window.location.reload();
    };

    const register = async () => {
      const registration = await registerVersionedWorker(currentVersion);

      if (disposed) {
        return;
      }

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;

        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            syncWaitingWorker(registration);
          }
        });
      });

      await registration.update().catch(() => undefined);
      syncWaitingWorker(registration);
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    void register();

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("message", handleMessage);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [currentVersion, registerVersionedWorker, syncWaitingWorker]);

  useEffect(() => {
    void probeForUpdate();
  }, [probeForUpdate]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void probeForUpdate();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [probeForUpdate]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void probeForUpdate();
      }
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [probeForUpdate]);

  useEffect(() => {
    if (routeKind === "safe") {
      void probeForUpdate();
    }
  }, [probeForUpdate, routeKind]);

  const handleApplyUpdate = useCallback(async () => {
    const targetVersion = updateRequirement.targetVersion;
    const registration = registrationRef.current;

    if (!targetVersion || !registration) {
      return;
    }

    setIsApplyingUpdate(true);
    requestedReloadVersionRef.current = targetVersion;

    try {
      await registration.update().catch(() => undefined);
      syncWaitingWorker(registration);

      const waitingWorker =
        registration.waiting ?? (await waitForWaitingWorker(registration, 4000));

      if (waitingWorker) {
        const version =
          extractVersionFromScriptUrl(waitingWorker.scriptURL) ?? targetVersion;
        setWaitingVersion(version);
        waitingWorker.postMessage({ type: "SKIP_WAITING" });
        return;
      }

      if (
        shouldForceReloadOnce({
          currentVersion,
          targetVersion,
          lastReloadedVersion,
        })
      ) {
        window.sessionStorage.setItem(RELOAD_GUARD_SESSION_KEY, targetVersion);
        setLastReloadedVersion(targetVersion);
        window.location.reload();
        return;
      }
    } finally {
      setIsApplyingUpdate(false);
    }
  }, [
    currentVersion,
    lastReloadedVersion,
    syncWaitingWorker,
    updateRequirement.targetVersion,
  ]);

  if (!updateRequirement.showBlockingPrompt) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center brand-overlay px-4 py-6 backdrop-blur-sm">
      <Card className="w-full max-w-md rounded-[30px] border-white/80 bg-card/95 shadow-[0_28px_70px_-36px_rgba(28,25,23,0.55)] ring-1 ring-border">
        <CardContent className="space-y-6 p-8 text-center sm:p-10">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-cream/80 ring-1 ring-border">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-lg font-bold text-brand-foreground">
                OB
              </span>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand">
                Nueva versión disponible
              </p>
              <h2
                className="text-3xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Actualizá para continuar
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Tenemos mejoras importantes.
              </p>
            </div>
          </div>

          <Button
            size="lg"
            className="h-14 w-full rounded-2xl text-base font-semibold shadow-[0_18px_36px_-24px_rgba(28,25,23,0.85)]"
            onClick={() => {
              void handleApplyUpdate();
            }}
            disabled={isApplyingUpdate}
          >
            {isApplyingUpdate ? "Actualizando..." : "Actualizar ahora"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
