import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Safari 15+ on older iPads and ChromeOS Chrome: keep the output conservative.
export default defineConfig({
  plugins: [react()],
  build: { target: ["es2019", "safari13"] },
  server: { proxy: { "/api": "http://localhost:8090" } },
});
