type AppVersionEnv = Record<string, string | undefined>;

function normalizeVersion(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function createTimestampBuildVersion(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  const hours = `${date.getUTCHours()}`.padStart(2, "0");
  const minutes = `${date.getUTCMinutes()}`.padStart(2, "0");
  const seconds = `${date.getUTCSeconds()}`.padStart(2, "0");

  return `build-${year}${month}${day}-${hours}${minutes}${seconds}`;
}

export function resolveAppBuildVersion({
  env = process.env,
  getGitShortSha,
  getBuildFallbackVersion,
}: {
  env?: AppVersionEnv;
  getGitShortSha?: () => string | null | undefined;
  getBuildFallbackVersion?: () => string | null | undefined;
} = {}) {
  return (
    normalizeVersion(env.APP_BUILD_VERSION) ??
    normalizeVersion(getGitShortSha?.()) ??
    normalizeVersion(getBuildFallbackVersion?.()) ??
    "dev"
  );
}

export function getPublicAppVersion(env: AppVersionEnv = process.env) {
  return (
    normalizeVersion(env.NEXT_PUBLIC_APP_VERSION) ??
    normalizeVersion(env.APP_BUILD_VERSION) ??
    "dev"
  );
}
