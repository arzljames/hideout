/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Empty prefix loads non-VITE_ vars too; these are config-only and never reach the browser.
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.DEV_PORT ?? 5173);
  const apiProxyTarget = env.DEV_API_PROXY_TARGET ?? "http://localhost:3001";

  return {
    plugins: [
      // Must come before the React plugin.
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      css: true,
      env: {
        VITE_API_URL: "http://api.test",
        VITE_SUPABASE_URL: "http://supabase.test",
        VITE_SUPABASE_ANON_KEY: "test-anon-key",
        VITE_LIVEKIT_URL: "ws://livekit.test",
      },
    },
    server: {
      port,
      strictPort: true,
      // Send every /api request to hideout-api, so the browser only ever talks to the dev server
      proxy: {
        "/api": { target: apiProxyTarget, changeOrigin: false },
      },
    },
  };
});
