import { defineConfig } from "tsup";
import pkg from "./package.json";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  clean: true,
  external: Object.keys(pkg.dependencies).filter(
    (dependency) => dependency !== "@fontsource/inter",
  ),
  noExternal: ["@fontsource/inter"],
  loader: {
    ".woff": "binary",
  },
});
