import { classifyUpdateRoute } from "./update-routes";

type VersionInput = string | null | undefined;

function normalizeVersion(value: VersionInput) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function resolveRequiredUpdate({
  pathname,
  currentVersion,
  pendingVersion,
  waitingVersion,
  lastReloadedVersion,
}: {
  pathname: string;
  currentVersion: string;
  pendingVersion: VersionInput;
  waitingVersion: VersionInput;
  lastReloadedVersion: VersionInput;
}) {
  const targetVersion =
    normalizeVersion(waitingVersion) ?? normalizeVersion(pendingVersion);

  if (
    !targetVersion ||
    targetVersion === normalizeVersion(currentVersion) ||
    targetVersion === normalizeVersion(lastReloadedVersion)
  ) {
    return {
      targetVersion,
      showBlockingPrompt: false,
      deferUntilSafePoint: false,
    };
  }

  const routeKind = classifyUpdateRoute(pathname);

  if (routeKind === "safe") {
    return {
      targetVersion,
      showBlockingPrompt: true,
      deferUntilSafePoint: false,
    };
  }

  return {
    targetVersion,
    showBlockingPrompt: false,
    deferUntilSafePoint: true,
  };
}

export function shouldForceReloadOnce({
  currentVersion,
  targetVersion,
  lastReloadedVersion,
}: {
  currentVersion: VersionInput;
  targetVersion: VersionInput;
  lastReloadedVersion: VersionInput;
}) {
  const current = normalizeVersion(currentVersion);
  const target = normalizeVersion(targetVersion);
  const lastReloaded = normalizeVersion(lastReloadedVersion);

  if (!target || target === current) {
    return false;
  }

  return target !== lastReloaded;
}

export function shouldClearReloadGuard({
  currentVersion,
  targetVersion,
  lastReloadedVersion,
}: {
  currentVersion: VersionInput;
  targetVersion: VersionInput;
  lastReloadedVersion: VersionInput;
}) {
  const current = normalizeVersion(currentVersion);
  const target = normalizeVersion(targetVersion);
  const lastReloaded = normalizeVersion(lastReloadedVersion);

  if (!current || !lastReloaded) {
    return false;
  }

  return current === lastReloaded || current === target;
}
