import { summarizeOnboardingState } from "./onboarding-state";
import type { SimulationResult } from "./types";

function status(value: boolean): string {
  return value ? "PASS" : "FAIL";
}

export function formatSimulationReport(result: SimulationResult): string {
  const lines: string[] = [];

  lines.push(`Scenario: ${result.scenario.id} - ${result.scenario.title}`);
  lines.push(`Task: ${result.scenario.task}`);
  lines.push(`Runtime: ${result.runtimeId}`);
  lines.push(`Persona: ${result.personaId}`);
  lines.push("");
  lines.push("Transcript:");

  for (const message of result.transcript) {
    const label = message.role === "user" ? "USER" : "SKINTEXT";
    lines.push(`${label}: ${message.content}`);
  }

  lines.push("");
  lines.push(`Result: ${status(result.evaluation.pass)} (${result.evaluation.score}/100)`);
  lines.push(`Final state: ${summarizeOnboardingState(result.finalState)}`);
  lines.push("");
  lines.push("Checks:");

  for (const check of result.evaluation.checks) {
    lines.push(`- ${status(check.pass)} ${check.id}: ${check.message}`);
  }

  return lines.join("\n");
}

export function formatScenarioList(results: SimulationResult[]): string {
  const lines = results.map(
    (result) =>
      `${status(result.evaluation.pass)} ${result.scenario.id} (${result.evaluation.score}/100)`,
  );
  return lines.join("\n");
}
