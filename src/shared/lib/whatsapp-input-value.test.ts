import { describe, expect, it } from "vitest";

import {
  WHATSAPP_PREFIX_OPTIONS,
  buildWhatsappValue,
  isCompleteWhatsappInput,
  parseWhatsappValue,
  sanitizeWhatsappPrefix,
} from "./whatsapp-input-value";

describe("whatsapp input value helpers", () => {
  it("uses short prefix labels without country names", () => {
    expect(WHATSAPP_PREFIX_OPTIONS.map((option) => option.label)).toEqual([
      "+505",
      "+1",
      "+506",
      "+502",
      "+503",
      "+504",
      "+507",
      "+52",
    ]);
  });

  it("builds a default Nicaragua full whatsapp value", () => {
    expect(buildWhatsappValue("+505", "8679-1327")).toBe("+50586791327");
    expect(isCompleteWhatsappInput("+505", "86791327")).toBe(true);
  });

  it("builds full values for supported international prefixes", () => {
    expect(buildWhatsappValue("+1", "(555) 123-4567")).toBe("+15551234567");
    expect(buildWhatsappValue("+506", "8888 7777")).toBe("+50688887777");
    expect(buildWhatsappValue("+502", "5555 1234")).toBe("+50255551234");
    expect(buildWhatsappValue("+503", "7777 1234")).toBe("+50377771234");
    expect(buildWhatsappValue("+504", "9999 1234")).toBe("+50499991234");
    expect(buildWhatsappValue("+507", "6666 1234")).toBe("+50766661234");
    expect(buildWhatsappValue("+52", "5512345678")).toBe("+525512345678");
  });

  it("supports a manual short prefix", () => {
    expect(sanitizeWhatsappPrefix(" +593 ")).toBe("+593");
    expect(buildWhatsappValue("+593", "999999999")).toBe("+593999999999");
    expect(isCompleteWhatsappInput("+593", "999999999")).toBe(true);
  });

  it("rejects incomplete or overlong values", () => {
    expect(buildWhatsappValue("+505", "")).toBe("");
    expect(isCompleteWhatsappInput("+505", "1234567")).toBe(false);
    expect(buildWhatsappValue("+12345", "99999999")).toBe("");
    expect(buildWhatsappValue("+505", "1234567890123456")).toBe("");
  });

  it("parses known and custom full values for controlled inputs", () => {
    expect(parseWhatsappValue("+50586791327")).toEqual({
      prefix: "+505",
      localNumber: "86791327",
      isOtherPrefix: false,
    });
    expect(parseWhatsappValue("+593999999999")).toEqual({
      prefix: "+593",
      localNumber: "999999999",
      isOtherPrefix: true,
    });
  });
});
