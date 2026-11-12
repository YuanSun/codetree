import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Safari 15+ on older iPads and ChromeOS Chrome: keep the output conservative.
// base "./": asset URLs are relative, so the same build works at http://mac:8090/ and behind the
// family gateway at http://mac:12999/lecture/ (Caddy strips the /lecture prefix).
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { target: ["es2019", "safari13"] },
  server: { proxy: { "/api": "http://localhost:8090" } },
});
