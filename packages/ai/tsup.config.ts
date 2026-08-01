import { defineConfig } from "tsup";
import pkg from "./package.json";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    prompts: "src/prompts/index.ts",
    risk: "src/risk.ts",
    text: "src/text.ts",
  },
  format: ["esm"],
  clean: true,
  external: Object.keys(pkg.dependencies),
});
