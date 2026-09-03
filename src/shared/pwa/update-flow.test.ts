import { describe, expect, it } from "vitest";

import {
  resolveRequiredUpdate,
  shouldClearReloadGuard,
  shouldForceReloadOnce,
} from "./update-flow";

describe("resolveRequiredUpdate", () => {
  it("muestra bloqueo inmediato cuando el update llega en una ruta segura", () => {
    const result = resolveRequiredUpdate({
      pathname: "/menu",
      currentVersion: "qa-v1",
      pendingVersion: "qa-v2",
      waitingVersion: null,
      lastReloadedVersion: null,
    });

    expect(result.targetVersion).toBe("qa-v2");
    expect(result.showBlockingPrompt).toBe(true);
    expect(result.deferUntilSafePoint).toBe(false);
  });

  it("difiere el update cuando el usuario esta en una ruta critica", () => {
    const result = resolveRequiredUpdate({
      pathname: "/checkout",
      currentVersion: "qa-v1",
      pendingVersion: "qa-v2",
      waitingVersion: null,
      lastReloadedVersion: null,
    });

    expect(result.targetVersion).toBe("qa-v2");
    expect(result.showBlockingPrompt).toBe(false);
    expect(result.deferUntilSafePoint).toBe(true);
  });

  it("bloquea al volver luego a un punto seguro", () => {
    const result = resolveRequiredUpdate({
      pathname: "/success/ord_1",
      currentVersion: "qa-v1",
      pendingVersion: "qa-v2",
      waitingVersion: null,
      lastReloadedVersion: null,
    });

    expect(result.showBlockingPrompt).toBe(true);
    expect(result.deferUntilSafePoint).toBe(false);
  });
});

describe("reload guard", () => {
  it("evita un segundo forced reload para la misma version en la misma sesion", () => {
    expect(
      shouldForceReloadOnce({
        currentVersion: "qa-v1",
        targetVersion: "qa-v2",
        lastReloadedVersion: "qa-v2",
      }),
    ).toBe(false);
  });

  it("limpia el guard cuando el cliente ya corre la version objetivo", () => {
    expect(
      shouldClearReloadGuard({
        currentVersion: "qa-v2",
        targetVersion: "qa-v2",
        lastReloadedVersion: "qa-v2",
      }),
    ).toBe(true);
  });
});
