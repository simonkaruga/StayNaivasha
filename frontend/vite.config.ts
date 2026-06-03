import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      srcDir: "src/sw",
      filename: "service-worker.ts",
      strategies: "injectManifest",
      manifest: false,
      injectManifest: {
        swSrc: "src/sw/service-worker.ts",
        swDest: "dist/service-worker.js",
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          query:  ["@tanstack/react-query"],
        },
      },
    },
  },
});
