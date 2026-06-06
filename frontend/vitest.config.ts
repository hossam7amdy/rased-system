import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	oxc: false,
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./src/test/setup.ts"],
		// Vitest owns *.test.{ts,tsx}; node:test owns *.test.mjs (pure logic).
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
	},
});
