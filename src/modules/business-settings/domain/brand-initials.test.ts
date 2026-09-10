import { describe, expect, it } from "vitest";

import { businessInitials } from "@/modules/business-settings/domain/brand-initials";

describe("businessInitials", () => {
  it("toma la inicial de las dos primeras palabras", () => {
    expect(businessInitials("One Burger")).toBe("OB");
    expect(businessInitials("Burger Nick")).toBe("BN");
  });

  it("usa una sola inicial cuando el nombre tiene una palabra", () => {
    expect(businessInitials("McDonalds")).toBe("M");
  });

  it("ignora palabras vacías y limita a dos letras", () => {
    expect(businessInitials("  One   Burger  House ")).toBe("OB");
  });

  it("no rompe con un nombre vacío ni con acentos", () => {
    expect(businessInitials("   ")).toBe("?");
    expect(businessInitials("Ñam Ñam")).toBe("ÑÑ");
  });
});
