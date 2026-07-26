import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "nitro";

const interPackageDir = fileURLToPath(
  new URL("../../node_modules/@fontsource/inter", import.meta.url),
);
const interFontFiles = [
  "inter-latin-400-normal.woff",
  "inter-latin-500-normal.woff",
  "inter-latin-600-normal.woff",
  "inter-latin-700-normal.woff",
] as const;

async function copyInterFonts(serverDir: string) {
  const targetDir = join(serverDir, "node_modules/@fontsource/inter");
  await mkdir(join(targetDir, "files"), { recursive: true });
  await Promise.all([
    copyFile(join(interPackageDir, "package.json"), join(targetDir, "package.json")),
    ...interFontFiles.map((filename) =>
      copyFile(join(interPackageDir, "files", filename), join(targetDir, "files", filename)),
    ),
  ]);
}

export default defineConfig({
  preset: "vercel",
  modules: [
    "workflow/nitro",
    (nitro) => {
      nitro.hooks.hook("compiled", () => copyInterFonts(nitro.options.output.serverDir));
    },
  ],
  alias: {
    "@": "./src",
  },
  traceDeps: ["@fontsource/inter"],
  routes: {
    "/**": "./src/index.ts",
  },
});
