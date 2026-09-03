import { describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => {
  return {
    redirectMock: vi.fn(() => {
      throw new Error("NEXT_REDIRECT");
    }),
  };
});

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import CustomerReservationPage from "./page";

describe("public reservations page", () => {
  it("redirects reservations out of the pickup MVP", () => {
    expect(() => CustomerReservationPage()).toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/menu");
  });
});
