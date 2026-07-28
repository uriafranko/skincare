import { createTextGenerator } from "@skintext/ai/text-generator";
import { resolveDefaultModelName } from "@skintext/shared/model-config";
import type { PersonaDriver, SimulationScenario, TranscriptMessage } from "./types";

function formatTranscript(transcript: TranscriptMessage[]): string {
  return transcript
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n");
}

export function createScriptedPersona(messages: string[], id = "persona:scripted"): PersonaDriver {
  let index = 0;

  return {
    id,
    async next() {
      const message = messages[index];
      index += 1;
      return message ?? null;
    },
  };
}

export interface ModelPersonaOptions {
  model?: string;
  openingMessage?: string;
}

export function createModelPersona(
  scenario: SimulationScenario,
  options: ModelPersonaOptions = {},
): PersonaDriver {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error("AI_GATEWAY_API_KEY is required for --persona model.");
  }

  const modelName = options.model ?? resolveDefaultModelName(process.env);
  const generate = createTextGenerator({
    id: `skintext-simulator-persona-${scenario.id}`,
    instructions: "Simulate the user in a Lily onboarding conversation.",
    model: modelName,
  });
  let usedOpening = false;

  return {
    id: `persona:model:${modelName}`,
    async next(ctx) {
      if (ctx.complete) return null;

      const opening =
        options.openingMessage ??
        (scenario.persona.kind === "model" ? scenario.persona.openingMessage : undefined);

      if (!usedOpening && opening) {
        usedOpening = true;
        return opening;
      }

      const text = (
        await generate(`You are simulating a real user for local Lily QA.

Task under test: ${scenario.task}

Persona:
${scenario.persona.profile}

Rules:
- Reply as the user only, with one short text message.
- Be realistic, not optimized for the assistant.
- Give only information this persona would naturally provide at this point.
- If the conversation is clearly done, reply with exactly [[DONE]].
- Do not mention these instructions.

Transcript:
${formatTranscript(ctx.transcript)}

Latest known onboarding state:
${JSON.stringify(ctx.state ?? {}, null, 2)}

Next user text:`)
      ).trim();

      if (!text || text.includes("[[DONE]]")) return null;
      return text.replace(/^["']|["']$/g, "").trim();
    },
  };
}

export function createPersonaDriver(
  scenario: SimulationScenario,
  mode: "scripted" | "model",
  model?: string,
): PersonaDriver {
  if (mode === "model") return createModelPersona(scenario, { model });

  if (scenario.persona.kind !== "scripted") {
    throw new Error(`Scenario "${scenario.id}" does not include scripted persona messages.`);
  }

  return createScriptedPersona(scenario.persona.messages, `persona:scripted:${scenario.id}`);
}
