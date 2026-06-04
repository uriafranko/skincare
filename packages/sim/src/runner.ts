import type { OnboardingState } from "@skintext/shared";
import { evaluateOnboardingSimulation } from "./evaluators";
import type {
  PersonaDriver,
  SimulationResult,
  SimulationRuntime,
  SimulationScenario,
  TranscriptMessage,
} from "./types";

export interface RunSimulationOptions {
  maxTurns?: number;
}

export async function runSimulation(
  scenario: SimulationScenario,
  runtime: SimulationRuntime,
  persona: PersonaDriver,
  options: RunSimulationOptions = {},
): Promise<SimulationResult> {
  const transcript: TranscriptMessage[] = [];
  const maxTurns = options.maxTurns ?? scenario.maxTurns ?? 8;
  let complete = false;
  let finalState: OnboardingState | undefined;

  for (let turn = 0; turn < maxTurns; turn += 1) {
    const userText = await persona.next({
      scenario,
      transcript,
      state: finalState,
      complete,
      turn,
    });

    if (!userText) break;

    transcript.push({ role: "user", content: userText, turn });

    const reply = await runtime.receive(userText, {
      scenario,
      transcript,
      turn,
    });

    finalState = reply.state;
    complete = reply.complete === true;

    for (const message of reply.messages) {
      transcript.push({
        role: "assistant",
        content: message,
        turn,
        state: finalState,
      });
    }

    if (complete) break;
  }

  return {
    scenario,
    runtimeId: runtime.id,
    personaId: persona.id,
    transcript,
    finalState,
    complete,
    evaluation: evaluateOnboardingSimulation(transcript, finalState, scenario.expectations),
  };
}
