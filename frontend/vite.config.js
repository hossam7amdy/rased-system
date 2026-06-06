import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	const apiTarget = env.VITE_API_BASE_URL || "http://localhost:5000";

	return {
		plugins: [react(), cloudflare()],
		server: {
			port: 3000,
			proxy: {
				"/api": {
					target: apiTarget,
					changeOrigin: true,
				},
			},
		},
	};
});
