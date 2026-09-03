import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("deploy runtime contract", () => {
  it("copies public assets into the runtime image so the PWA files are served", () => {
    const dockerfile = readRepoFile("Dockerfile");

    expect(dockerfile).toContain("COPY --from=builder /app/public ./public");
  });

  it("injects APP_BUILD_VERSION during the image build instead of falling back to dev", () => {
    const dockerfile = readRepoFile("Dockerfile");

    expect(dockerfile).toMatch(/APP_BUILD_VERSION=/);
  });
});
