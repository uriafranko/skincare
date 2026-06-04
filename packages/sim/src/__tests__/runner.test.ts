import { describe, expect, test } from "bun:test";
import { createOnboardingRuntime } from "../onboarding-runtime";
import { createScriptedPersona } from "../personas";
import { runSimulation } from "../runner";
import { getScenario } from "../scenarios";
import type { SimulationRuntime } from "../types";

describe("local simulator", () => {
  test("runs a scripted onboarding scenario to completion with the stub runtime", async () => {
    const scenario = getScenario("onboarding-consent-gap");
    const runtime = createOnboardingRuntime({
      mode: "stub",
      locale: scenario.locale,
      timezone: scenario.timezone,
    });
    const persona =
      scenario.persona.kind === "scripted"
        ? createScriptedPersona(scenario.persona.messages)
        : null;

    expect(persona).not.toBeNull();

    const result = await runSimulation(scenario, runtime, persona!);

    expect(result.complete).toBe(true);
    expect(result.finalState?.name).toBe("Noor");
    expect(result.finalState?.consented).toBe(true);
    expect(result.evaluation.pass).toBe(true);
  });

  test("keeps fragmented onboarding facts stable in stub mode", async () => {
    const scenario = getScenario("onboarding-friction");
    const runtime = createOnboardingRuntime({
      mode: "stub",
      locale: scenario.locale,
      timezone: scenario.timezone,
    });
    const persona =
      scenario.persona.kind === "scripted"
        ? createScriptedPersona(scenario.persona.messages)
        : null;

    expect(persona).not.toBeNull();

    const result = await runSimulation(scenario, runtime, persona!);

    expect(result.complete).toBe(true);
    expect(result.finalState?.name).toBe("Leo");
    expect(result.finalState?.skinType).toBe("unsure");
    expect(result.finalState?.morningReminder).toBe("07:30");
    expect(result.finalState?.eveningReminder).toBe("22:00");
  });

  test("keeps greeting-only setup compact and optional about reminders", async () => {
    const scenario = getScenario("onboarding-friction");
    const runtime = createOnboardingRuntime({
      mode: "stub",
      locale: scenario.locale,
      timezone: scenario.timezone,
    });

    const result = await runSimulation(scenario, runtime, createScriptedPersona(["hey"]), {
      maxTurns: 1,
    });
    const reply = result.transcript.find((message) => message.role === "assistant")?.content ?? "";

    expect(reply).not.toContain("AM/PM reminder times");
    expect(reply.length).toBeLessThanOrEqual(260);
  });

  test("flags assistant boundary leaks", async () => {
    const scenario = getScenario("onboarding-basic");
    const runtime: SimulationRuntime = {
      id: "test:leaky",
      async receive() {
        return {
          messages: ["I saved this in the database using an internal workflow."],
          state: {},
          complete: false,
        };
      },
    };
    const persona = createScriptedPersona(["I'm Maya"]);

    const result = await runSimulation(scenario, runtime, persona, { maxTurns: 1 });

    expect(result.evaluation.pass).toBe(false);
    expect(
      result.evaluation.checks.some((check) => check.id.startsWith("assistant_boundary")),
    ).toBe(true);
  });
});
