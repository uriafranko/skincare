import { describe, expect, test } from "bun:test";
import { toMastraModelName } from "@skintext/ai/models";

describe("Mastra model names", () => {
  test("routes existing Gateway model IDs through Mastra's Vercel provider", () => {
    expect(toMastraModelName("google/gemini-3.5-flash")).toBe("vercel/google/gemini-3.5-flash");
  });

  test("does not duplicate an existing provider prefix", () => {
    expect(toMastraModelName("vercel/google/gemini-3.5-flash")).toBe(
      "vercel/google/gemini-3.5-flash",
    );
  });

  test("imports the public models subpath without application environment variables", () => {
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production" };
    for (const key of [
      "AI_GATEWAY_API_KEY",
      "DATABASE_URL",
      "SENDBLUE_API_KEY",
      "SENDBLUE_API_SECRET",
      "SENDBLUE_FROM_NUMBER",
      "SENDBLUE_WEBHOOK_SECRET",
    ]) {
      delete env[key];
    }

    const result = Bun.spawnSync(
      [
        process.execPath,
        "--no-env-file",
        "-e",
        'const models = await import("@skintext/ai/models"); console.log(models.toMastraModelName("openai/gpt-5"));',
      ],
      { cwd: process.cwd(), env },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr.toString()).toBe("");
    expect(result.stdout.toString().trim()).toBe("vercel/openai/gpt-5");
  });
});
