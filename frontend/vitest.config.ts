import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Separate from vite.config.js on purpose: the Cloudflare plugin is for
// build/deploy and is not needed (and can interfere) in the jsdom test env.
export default defineConfig({
	plugins: [react()],
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./src/test/setup.ts"],
		// Vitest owns *.test.{ts,tsx}; node:test owns *.test.mjs (pure logic).
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
	},
});
