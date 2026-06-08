import type { OnboardingState } from "@skintext/shared";

export type SimulationArea = "onboarding";
export type RuntimeMode = "auto" | "live" | "stub";
export type PersonaMode = "scripted" | "model";
export type TranscriptRole = "user" | "assistant";

export interface TranscriptMessage {
  role: TranscriptRole;
  content: string;
  turn: number;
  state?: OnboardingState;
}

export interface SimulationExpectations {
  onboardingComplete?: boolean;
  maxAssistantMessages?: number;
  maxAssistantChars?: number;
  requiredFields?: string[];
  forbiddenAssistantTerms?: string[];
  addressUserByName?: boolean;
}

export interface ScriptedPersonaConfig {
  kind: "scripted";
  profile: string;
  messages: string[];
}

export interface ModelPersonaConfig {
  kind: "model";
  profile: string;
  openingMessage?: string;
}

export type PersonaConfig = ScriptedPersonaConfig | ModelPersonaConfig;

export interface SimulationScenario {
  id: string;
  title: string;
  area: SimulationArea;
  task: string;
  locale: string;
  timezone: string;
  persona: PersonaConfig;
  expectations: SimulationExpectations;
  maxTurns?: number;
}

export interface RuntimeTurnContext {
  scenario: SimulationScenario;
  transcript: TranscriptMessage[];
  turn: number;
}

export interface RuntimeReply {
  messages: string[];
  state?: OnboardingState;
  complete?: boolean;
  metadata?: Record<string, unknown>;
}

export interface SimulationRuntime {
  id: string;
  receive(text: string, ctx: RuntimeTurnContext): Promise<RuntimeReply>;
}

interface PersonaTurnContext {
  scenario: SimulationScenario;
  transcript: TranscriptMessage[];
  state?: OnboardingState;
  complete: boolean;
  turn: number;
}

export interface PersonaDriver {
  id: string;
  next(ctx: PersonaTurnContext): Promise<string | null>;
}

type CheckSeverity = "error" | "warning";

export interface EvaluationCheck {
  id: string;
  pass: boolean;
  severity: CheckSeverity;
  message: string;
}

export interface SimulationEvaluation {
  pass: boolean;
  score: number;
  checks: EvaluationCheck[];
}

export interface SimulationResult {
  scenario: SimulationScenario;
  runtimeId: string;
  personaId: string;
  transcript: TranscriptMessage[];
  finalState?: OnboardingState;
  complete: boolean;
  evaluation: SimulationEvaluation;
}
