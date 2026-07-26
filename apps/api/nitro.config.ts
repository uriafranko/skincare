import { defineConfig } from "nitro";

export default defineConfig({
  preset: "vercel",
  modules: ["workflow/nitro"],
  alias: {
    "@": "./src",
  },
  traceDeps: ["@fontsource/inter"],
  routes: {
    "/**": "./src/index.ts",
  },
});
