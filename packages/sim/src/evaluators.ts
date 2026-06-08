import type { OnboardingState } from "@skintext/shared";
import { getMissingOnboardingFields, isLocalOnboardingComplete } from "./onboarding-state";
import type {
  EvaluationCheck,
  SimulationEvaluation,
  SimulationExpectations,
  TranscriptMessage,
} from "./types";

const defaultForbiddenTerms = [
  "tool",
  "internal workflow",
  "database",
  "model",
  "prompt",
  "system prompt",
];

function assistantMessages(transcript: TranscriptMessage[]): TranscriptMessage[] {
  return transcript.filter((message) => message.role === "assistant");
}

function pushCheck(checks: EvaluationCheck[], check: EvaluationCheck) {
  checks.push(check);
}

function includesForbiddenTerm(text: string, terms: string[]): string | null {
  const lower = text.toLowerCase();
  return terms.find((term) => lower.includes(term.toLowerCase())) ?? null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasNonAscii(value: string): boolean {
  return Array.from(value).some((char) => char.charCodeAt(0) > 127);
}

function assistantMentionsName(transcript: TranscriptMessage[], name: string): boolean {
  if (hasNonAscii(name)) {
    return assistantMessages(transcript).some((message) => message.content.includes(name));
  }

  const namePattern = new RegExp(`\\b${escapeRegExp(name)}\\b`, "i");
  return assistantMessages(transcript).some((message) => namePattern.test(message.content));
}

function mentionsNameAsk(text: string): boolean {
  return /\b(name|call you)\b/i.test(text);
}

function mentionsGoalsAsk(text: string): boolean {
  return /\b(goal|concern|main skin|skin issue|help with)\b/i.test(text);
}

function mentionsSkinProfileAsk(text: string): boolean {
  return /\b(skin type|sensitivity|sensitive)\b/i.test(text);
}

function mentionsConsentAsk(text: string): boolean {
  return /\b(consent|save|store|data|delete anytime)\b/i.test(text);
}

function asksForCollectedField(message: TranscriptMessage): string | null {
  const state = message.state;
  if (!state) return null;
  const text = message.content;

  if (state.name && mentionsNameAsk(text)) return "name";
  if ((state.concerns?.length || state.goals?.length) && mentionsGoalsAsk(text)) {
    return "skin goals/concerns";
  }
  if ((state.skinType || state.sensitivity) && mentionsSkinProfileAsk(text)) {
    return "skin profile";
  }
  if (state.consented && mentionsConsentAsk(text)) return "consent";

  return null;
}

function fieldIsPresent(field: string, state?: OnboardingState): boolean {
  if (!state) return false;
  switch (field) {
    case "name":
      return !!state.name;
    case "skin_goals":
      return !!state.concerns?.length || !!state.goals?.length;
    case "skin_profile":
      return !!state.skinType || !!state.sensitivity;
    case "consent":
      return state.consented === true;
    default:
      return true;
  }
}

export function evaluateOnboardingSimulation(
  transcript: TranscriptMessage[],
  finalState: OnboardingState | undefined,
  expectations: SimulationExpectations,
): SimulationEvaluation {
  const checks: EvaluationCheck[] = [];
  const assistants = assistantMessages(transcript);
  const shouldComplete = expectations.onboardingComplete ?? true;

  pushCheck(checks, {
    id: "onboarding_complete",
    pass: shouldComplete ? isLocalOnboardingComplete(finalState ?? {}) : true,
    severity: "error",
    message: shouldComplete
      ? `Onboarding should complete. Missing: ${getMissingOnboardingFields(finalState ?? {}).join(", ") || "none"}.`
      : "Onboarding is not required to complete.",
  });

  const requiredFields = expectations.requiredFields ?? [];
  for (const field of requiredFields) {
    pushCheck(checks, {
      id: `required_field:${field}`,
      pass: fieldIsPresent(field, finalState),
      severity: "error",
      message: `Required field "${field}" should be captured.`,
    });
  }

  if (expectations.maxAssistantMessages) {
    pushCheck(checks, {
      id: "assistant_message_count",
      pass: assistants.length <= expectations.maxAssistantMessages,
      severity: "error",
      message: `Assistant used ${assistants.length}/${expectations.maxAssistantMessages} allowed messages.`,
    });
  }

  if (expectations.maxAssistantChars) {
    const longest = assistants.reduce((max, message) => Math.max(max, message.content.length), 0);
    pushCheck(checks, {
      id: "assistant_message_length",
      pass: longest <= expectations.maxAssistantChars,
      severity: "warning",
      message: `Longest assistant message was ${longest}/${expectations.maxAssistantChars} chars.`,
    });
  }

  if (expectations.addressUserByName) {
    const name = finalState?.name;
    pushCheck(checks, {
      id: "personalized_name",
      pass: !!name && assistantMentionsName(transcript, name),
      severity: "warning",
      message: name
        ? `Assistant should address ${name} by name at least once.`
        : "Assistant should address the user by name once a name is captured.",
    });
  }

  const forbiddenTerms = expectations.forbiddenAssistantTerms ?? defaultForbiddenTerms;
  for (const message of assistants) {
    const term = includesForbiddenTerm(message.content, forbiddenTerms);
    pushCheck(checks, {
      id: `assistant_boundary:${message.turn}`,
      pass: !term,
      severity: "error",
      message: term
        ? `Assistant exposed internal term "${term}" in turn ${message.turn}.`
        : `Assistant boundary held for turn ${message.turn}.`,
    });
  }

  for (const message of assistants) {
    const field = asksForCollectedField(message);
    pushCheck(checks, {
      id: `no_reask:${message.turn}`,
      pass: !field,
      severity: "warning",
      message: field
        ? `Assistant may have re-asked for already collected ${field} on turn ${message.turn}.`
        : `No obvious re-ask on turn ${message.turn}.`,
    });
  }

  const errorFailures = checks.filter((check) => !check.pass && check.severity === "error").length;
  const warningFailures = checks.filter(
    (check) => !check.pass && check.severity === "warning",
  ).length;
  const score = Math.max(0, 100 - errorFailures * 25 - warningFailures * 8);

  return {
    pass: errorFailures === 0,
    score,
    checks,
  };
}
