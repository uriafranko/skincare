import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { runSkintextAgent, skintextAgent } from "../agent";
import type { SkintextRuntime } from "../runtime";

const restorers: Array<() => void> = [];

afterEach(() => {
  while (restorers.length > 0) restorers.pop()?.();
});

function runtime(): SkintextRuntime {
  return {
    userId: "usr_signals",
    timezone: "UTC",
    inputText: "hello",
    hasImage: false,
    isScheduledEvent: false,
    agentContext: {
      userId: "usr_signals",
      localeName: "English",
      locale: "en",
      timezone: "UTC",
      localDate: "2026-07-28",
      userAccount: null,
      riskState: "routine",
      shouldOfferStyle: false,
      shouldOfferPhotoRetention: false,
      hasImage: false,
      isScheduledEvent: false,
      streak: null,
    },
    photoRetentionEnabled: false,
  };
}

function spy<K extends keyof typeof skintextAgent>(
  key: K,
  implementation: (typeof skintextAgent)[K],
) {
  const value = spyOn(skintextAgent, key).mockImplementation(implementation as never);
  restorers.push(() => value.mockRestore());
  return value;
}

describe("Mastra thread messages", () => {
  test("delivers a concurrent user message to the active run", async () => {
    spy("listSuspendedRuns", async () => ({ runs: [], total: 0 }));
    const sendMessage = spy("sendMessage", (() => ({
      signal: {},
      accepted: Promise.resolve({ action: "deliver", runId: "run_active" }),
    })) as never);

    const result = await runSkintextAgent({ text: "actually, make it shorter" }, runtime());

    expect(result).toBeNull();
    expect(sendMessage).toHaveBeenCalledWith(
      "actually, make it shorter",
      expect.objectContaining({
        resourceId: "usr_signals",
        threadId: "skintext:usr_signals",
        ifActive: expect.objectContaining({ behavior: "deliver" }),
      }),
    );
  });

  test("uses native output steps to separate text from steered turns", async () => {
    spy("listSuspendedRuns", async () => ({ runs: [], total: 0 }));
    spy("sendMessage", (() => ({
      signal: {},
      accepted: Promise.resolve({
        action: "wake",
        runId: "run_wake",
        output: {
          status: "running",
          getFullOutput: async () => ({
            text: "FirstUpdated",
            totalUsage: {
              inputTokens: 10,
              outputTokens: 3,
              totalTokens: 13,
            },
            runId: "run_wake",
            steps: [{ text: "First" }, { text: "Updated" }],
          }),
        },
      }),
    })) as never);

    const result = await runSkintextAgent({ text: "start" }, runtime());

    expect(result?.text).toBe("First\n\nUpdated");
    expect(result?.runId).toBe("run_wake");
  });

  test("resumes native deletion confirmation instead of blocking the thread", async () => {
    spy("listSuspendedRuns", async () => ({
      total: 1,
      runs: [
        {
          runId: "run_suspended",
          status: "suspended",
          threadId: "skintext:usr_signals",
          resourceId: "usr_signals",
          suspendedAt: new Date(),
          toolCalls: [
            {
              toolCallId: "call_delete",
              toolName: "deleteAccount",
              requiresApproval: false,
            },
          ],
        },
      ],
    }));
    const resumeStream = spy("resumeStream", (async () => ({
      getFullOutput: async () => ({
        text: "Deleted.",
        totalUsage: {
          inputTokens: 8,
          outputTokens: 2,
          totalTokens: 10,
        },
        runId: "run_suspended",
        steps: [{ text: "Deleted." }],
      }),
    })) as never);

    const result = await runSkintextAgent({ text: "yes, delete everything" }, runtime());

    expect(resumeStream).toHaveBeenCalledWith(
      { confirmed: true },
      expect.objectContaining({
        runId: "run_suspended",
        toolCallId: "call_delete",
      }),
    );
    expect(result?.text).toBe("Deleted.");
  });
});
