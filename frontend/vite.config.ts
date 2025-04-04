import path, { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: "@/ui",
        replacement: resolve(__dirname, "src/components/ui"),
      },
      {
        find: "@/components",
        replacement: resolve(__dirname, "src/components"),
      },
      {
        find: "@/state",
        replacement: resolve(__dirname, "src/state"),
      },
    ],
  },
});
