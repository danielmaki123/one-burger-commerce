import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";
import { businessSettingsStyleVariables } from "@/modules/business-settings/domain/business-settings-style";

describe("businessSettingsStyleVariables", () => {
  it("traduce la configuración a tokens CSS", () => {
    expect(
      businessSettingsStyleVariables({
        ...DEFAULT_BUSINESS_SETTINGS,
        primaryColor: "#112233",
        accentColor: "#445566",
        backgroundColor: "#778899",
        foregroundColor: "#aabbcc",
        surfaceColor: "#ddeeff",
        headingFont: "inter",
        bodyFont: "fraunces",
      }),
    ).toEqual({
      "--brand": "#112233",
      "--accent": "#445566",
      "--background": "#778899",
      "--foreground": "#aabbcc",
      "--card": "#ddeeff",
      "--font-heading": "var(--font-inter)",
      "--font-body": "var(--font-fraunces)",
    });
  });

  it("vive fuera de un módulo cliente para que el layout de servidor pueda llamarlo", () => {
    const source = readFileSync(
      path.resolve(__dirname, "./business-settings-style.ts"),
      "utf8",
    );

    // El layout raíz es un componente de servidor: si este helper se exporta
    // desde un módulo con "use client", Next falla en tiempo de render con
    // "Attempted to call businessSettingsStyleVariables() from the server".
    expect(source.startsWith('"use client"') || source.startsWith("'use client'")).toBe(false);
  });
});
