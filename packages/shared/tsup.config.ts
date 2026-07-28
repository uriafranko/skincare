import { defineConfig } from "tsup";
import pkg from "./package.json";

export default defineConfig({
  entry: ["src/index.ts", "src/model-config.ts", "src/onboarding.ts"],
  format: ["esm"],
  clean: true,
  external: Object.keys(pkg.dependencies),
});
