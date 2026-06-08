import type { ModelMessage } from "ai";
import { estimateMessageTokens } from "./usage";

function messageToolCallIds(message: ModelMessage): Set<string> {
  const ids = new Set<string>();
  if (message.role !== "assistant" || !Array.isArray(message.content)) return ids;

  for (const part of message.content as Array<Record<string, unknown>>) {
    if (part.type === "tool-call" && typeof part.toolCallId === "string") {
      ids.add(part.toolCallId);
    }
  }

  return ids;
}

function messageToolResultIds(message: ModelMessage): Set<string> {
  const ids = new Set<string>();
  if (message.role !== "tool" && message.role !== "assistant") return ids;
  if (!Array.isArray(message.content)) return ids;

  for (const part of message.content as Array<Record<string, unknown>>) {
    if (part.type === "tool-result" && typeof part.toolCallId === "string") {
      ids.add(part.toolCallId);
    }
  }

  return ids;
}

function hasDanglingToolResults(messages: ModelMessage[], startIndex: number): boolean {
  const retainedToolCalls = new Set<string>();

  for (let i = startIndex; i < messages.length; i++) {
    const message = messages[i];
    if (!message) continue;

    for (const toolCallId of messageToolCallIds(message)) {
      retainedToolCalls.add(toolCallId);
    }

    for (const toolCallId of messageToolResultIds(message)) {
      if (!retainedToolCalls.has(toolCallId)) return true;
    }
  }

  return false;
}

function findSafeTailStart(messages: ModelMessage[], candidate: number): number {
  if (candidate <= 0) return 0;

  for (let i = candidate; i < messages.length; i++) {
    if (messages[i]?.role === "user") return i;
  }

  let safeCandidate = candidate;
  while (safeCandidate > 0 && hasDanglingToolResults(messages, safeCandidate)) {
    safeCandidate--;
  }

  return safeCandidate;
}

export function findTailStart(messages: ModelMessage[], keepRecentTokens: number): number {
  if (messages.length <= 1) return 0;

  let accumulated = 0;
  let candidate = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (!message) continue;
    accumulated += estimateMessageTokens(message);
    if (accumulated >= keepRecentTokens) {
      candidate = i;
      break;
    }
  }

  return findSafeTailStart(messages, candidate);
}
