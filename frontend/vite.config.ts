import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Vite configuration
export default defineConfig({
  server: {
    host: "::",      // Listen on all IPs (good for WSL / Docker setups)
    port: 5173,      // Default React dev server port
  },
  plugins: [
    react(),         // React + TypeScript (JSX/TSX) support
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"), // Shortcut import for your codebase
    },
  },
});