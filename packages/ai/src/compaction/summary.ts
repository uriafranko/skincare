import type { LanguageModelV3 } from "@ai-sdk/provider";
import { generateText, type ModelMessage } from "ai";
import { SUMMARY_MARKER, SUMMARY_PROMPT, SUMMARY_SYSTEM_PROMPT } from "./constants";
import { safeJson } from "./usage";

export function createCompactionSummaryMessage(summary: string): ModelMessage {
  return {
    role: "system",
    content: `${SUMMARY_MARKER}\n${summary.trim()}`,
  };
}

export function isCompactionSummaryMessage(message: ModelMessage): boolean {
  return (
    message.role === "system" &&
    typeof message.content === "string" &&
    message.content.startsWith(SUMMARY_MARKER)
  );
}

export function getSummaryText(message: ModelMessage): string | undefined {
  if (!isCompactionSummaryMessage(message)) return undefined;
  return String(message.content).slice(SUMMARY_MARKER.length).trim();
}

function serializeMessage(message: ModelMessage): string {
  const content = typeof message.content === "string" ? message.content : safeJson(message.content);
  return `${message.role.toUpperCase()}:\n${content}`;
}

function serializeMessages(messages: ModelMessage[]): string {
  return messages.map(serializeMessage).join("\n\n---\n\n");
}

export async function generateCompactionSummary(
  messagesToSummarize: ModelMessage[],
  previousSummary: string | undefined,
  model: LanguageModelV3,
): Promise<string> {
  const previousSummaryBlock = previousSummary
    ? `<existing_summary>\n${previousSummary}\n</existing_summary>\n\n`
    : "";

  const prompt = `${previousSummaryBlock}<messages_to_summarize>\n${serializeMessages(
    messagesToSummarize,
  )}\n</messages_to_summarize>\n\n${SUMMARY_PROMPT}`;

  const result = await generateText({
    model,
    system: SUMMARY_SYSTEM_PROMPT,
    prompt,
    maxOutputTokens: 1600,
  });

  return result.text.trim();
}
