import { describe, expect, it } from "vitest";

import { normalizeWhatsapp } from "./normalize-whatsapp";

describe("normalizeWhatsapp", () => {
  it("normalizes Nicaragua local number to +505 format", () => {
    expect(normalizeWhatsapp("86791327")).toBe("+50586791327");
  });

  it("normalizes Nicaragua 505-prefixed number to +505 format", () => {
    expect(normalizeWhatsapp("50586791327")).toBe("+50586791327");
  });

  it("keeps +505 canonical format", () => {
    expect(normalizeWhatsapp("+50586791327")).toBe("+50586791327");
  });

  it("normalizes +505 format with spaces", () => {
    expect(normalizeWhatsapp("+505 8679 1327")).toBe("+50586791327");
  });

  it("normalizes local number with separators", () => {
    expect(normalizeWhatsapp("8679-1327")).toBe("+50586791327");
  });

  it("keeps supported international full formats", () => {
    expect(normalizeWhatsapp("+15551234567")).toBe("+15551234567");
    expect(normalizeWhatsapp("+50688887777")).toBe("+50688887777");
    expect(normalizeWhatsapp("+50255551234")).toBe("+50255551234");
    expect(normalizeWhatsapp("+50377771234")).toBe("+50377771234");
    expect(normalizeWhatsapp("+50499991234")).toBe("+50499991234");
    expect(normalizeWhatsapp("+50766661234")).toBe("+50766661234");
    expect(normalizeWhatsapp("+525512345678")).toBe("+525512345678");
  });

  it("strips separators from international full formats", () => {
    expect(normalizeWhatsapp("+1 (555) 123-4567")).toBe("+15551234567");
  });

  it("returns empty for empty input", () => {
    expect(normalizeWhatsapp("")).toBe("");
  });

  it("returns empty for too short values", () => {
    expect(normalizeWhatsapp("1234567")).toBe("");
    expect(normalizeWhatsapp("+1234567")).toBe("");
  });

  it("returns empty for too long values", () => {
    expect(normalizeWhatsapp("1234567890123456")).toBe("");
    expect(normalizeWhatsapp("+1234567890123456")).toBe("");
  });

  it("returns empty for values without digits", () => {
    expect(normalizeWhatsapp("+abc")).toBe("");
  });
});
