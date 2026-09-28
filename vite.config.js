import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// SECURITY: Vite's dev-server host-check exists to stop DNS-rebinding
// attacks (a malicious website tricking your browser into talking to your
// local dev server and reading source/proxy responses). We keep that
// protection ON by default. It is only relaxed when explicitly opted in via
// the DEV_ALLOW_ALL_HOSTS=true env var, which is meant for throwaway sandbox
// previews (e.g. this repo's own cloud sandbox) — never enable it for a
// dev server reachable from an untrusted network.
const allowAllHostsForSandboxPreview = process.env.DEV_ALLOW_ALL_HOSTS === 'true';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/arka/',
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
    ...(allowAllHostsForSandboxPreview ? { allowedHosts: true } : {}),
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
