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
    /**
     * Los tests de DOM (jsdom) con `userEvent` y `fetch` simulado tardan ~0,7 s acá y
     * **más de 5 s** en un runner de CI cargado; con el default de vitest (5 s) el test
     * se mata antes de que la espera legítima encuentre el elemento. El techo sube, pero
     * un test colgado sigue fallando: solo tarda más en decirlo.
     */
    testTimeout: 20_000,
    // Margen de espera para los tests de DOM (`findBy*`, `waitFor`). Ver `src/test-setup.ts`.
    setupFiles: ["./src/test-setup.ts"],
  },
});

