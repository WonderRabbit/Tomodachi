import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("@tanstack")) {
            return "vendor-tanstack";
          }
          if (id.includes("lucide-react")) {
            return "vendor-icons";
          }
          if (id.includes("react") || id.includes("scheduler")) {
            return "vendor-react";
          }
          if (id.includes("ky") || id.includes("zod") || id.includes("zustand")) {
            return "vendor-runtime";
          }

          return "vendor";
        },
      },
    },
  },
  plugins: [react()],
});
