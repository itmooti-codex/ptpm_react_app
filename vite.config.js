import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@features": fileURLToPath(new URL("./src/features", import.meta.url)),
      "@modules": fileURLToPath(new URL("./src/modules", import.meta.url)),
      "@platform": fileURLToPath(new URL("./src/platform", import.meta.url)),
      "@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:4080",
        changeOrigin: true,
      },
    },
  },
});
