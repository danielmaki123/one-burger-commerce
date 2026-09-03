// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSearchParamGet = vi.fn(() => null);

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: mockSearchParamGet,
  }),
}));

import MenuPage from "./page";

describe("MenuPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ categories: [] }),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses the approved menu search placeholder in the browse view", async () => {
    render(<MenuPage />);

    expect(
      await screen.findByPlaceholderText("Buscar en el menú"),
    ).toBeTruthy();
  });
});
