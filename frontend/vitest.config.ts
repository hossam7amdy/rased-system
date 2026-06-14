import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  oxc: false,
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // Vitest owns all unit tests. Playwright owns e2e/. No node:test.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
