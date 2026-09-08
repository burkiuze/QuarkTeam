import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: "electron/main.ts",
      },
      preload: {
        input: "electron/preload.ts",
        vite: {
          build: {
            rollupOptions: {
              output: {
                // Sandboxed preload scripts must be CommonJS. The default
                // ".mjs" name makes Electron load the bundle as ESM, where the
                // emitted require("electron") call is undefined and the whole
                // bridge silently fails to install.
                format: "cjs",
                entryFileNames: "[name].cjs",
              },
            },
          },
        },
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
});
