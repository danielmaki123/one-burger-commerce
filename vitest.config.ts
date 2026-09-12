import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Margen de espera para los tests de DOM (`findBy*`, `waitFor`): el default de
    // 1 s no alcanza en un runner de CI cargado. Ver `src/test-setup.ts`.
    setupFiles: ["./src/test-setup.ts"],
  },
});

