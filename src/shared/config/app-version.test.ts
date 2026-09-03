import { describe, expect, it } from "vitest";

import {
  createTimestampBuildVersion,
  getPublicAppVersion,
  resolveAppBuildVersion,
} from "./app-version";

describe("resolveAppBuildVersion", () => {
  it("prefiere APP_BUILD_VERSION cuando existe", () => {
    const version = resolveAppBuildVersion({
      env: {
        APP_BUILD_VERSION: "qa-v2",
      },
      getGitShortSha: () => "abc1234",
    });

    expect(version).toBe("qa-v2");
  });

  it("usa git SHA corto cuando no hay override", () => {
    const version = resolveAppBuildVersion({
      env: {},
      getGitShortSha: () => "abc1234",
    });

    expect(version).toBe("abc1234");
  });

  it("usa un fallback de build cuando no hay override ni SHA", () => {
    const version = resolveAppBuildVersion({
      env: {},
      getGitShortSha: () => null,
      getBuildFallbackVersion: () => "build-20260623-180846",
    });

    expect(version).toBe("build-20260623-180846");
  });
});

describe("createTimestampBuildVersion", () => {
  it("genera una version UTC estable para builds sin SHA", () => {
    const version = createTimestampBuildVersion(new Date("2026-06-23T18:08:46.000Z"));

    expect(version).toBe("build-20260623-180846");
  });
});

describe("getPublicAppVersion", () => {
  it("usa NEXT_PUBLIC_APP_VERSION como version runtime", () => {
    const version = getPublicAppVersion({
      NEXT_PUBLIC_APP_VERSION: "qa-v3",
    });

    expect(version).toBe("qa-v3");
  });
});
