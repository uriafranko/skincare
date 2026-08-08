import { describe, expect, test } from "bun:test";
import { parseArgs } from "../cli";

describe("simulator CLI", () => {
  test("parses validated native options", () => {
    expect(
      parseArgs([
        "run",
        "--scenario",
        "onboarding-basic",
        "--system",
        "stub",
        "--persona",
        "scripted",
        "--max-turns",
        "3",
        "--json",
      ]),
    ).toMatchObject({
      command: "run",
      scenario: "onboarding-basic",
      system: "stub",
      persona: "scripted",
      maxTurns: 3,
      json: true,
    });
  });

  test.each([
    [["--unknown"], /unknown option/i],
    [["--system", "remote"], /invalid --system/i],
    [["--persona", "robot"], /invalid --persona/i],
    [["--max-turns", "0"], /positive integer/i],
    [["--max-turns", "1.5"], /positive integer/i],
  ])("rejects invalid arguments %#", (args, expected) => {
    expect(() => parseArgs(args as string[])).toThrow(expected as RegExp);
  });

  test("returns a failing exit status when evaluation fails", () => {
    const result = Bun.spawnSync({
      cmd: [
        process.execPath,
        new URL("../cli.ts", import.meta.url).pathname,
        "--system",
        "stub",
        "--scenario",
        "onboarding-consent-gap",
        "--max-turns",
        "1",
        "--json",
      ],
      cwd: new URL("../../", import.meta.url).pathname,
      env: process.env,
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout.toString()).evaluation.pass).toBe(false);
  });
});
