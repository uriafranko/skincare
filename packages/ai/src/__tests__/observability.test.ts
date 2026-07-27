import { describe, expect, test } from "bun:test";
import { mastra } from "../agent";

describe("Mastra observability", () => {
  test("uses the native Mastra Platform exporter with sensitive-data filtering", () => {
    const instance = mastra.observability.getDefaultInstance();

    expect(instance?.getExporters().map(({ name }) => name)).toEqual([
      "mastra-storage-exporter",
      "mastra-platform-exporter",
    ]);
    expect(instance?.getSpanOutputProcessors().map(({ name }) => name)).toContain(
      "sensitive-data-filter",
    );
  });
});
