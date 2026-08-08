import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { runSkintextAgent, skintextAgent } from "../agent";
import type { SkintextRuntime } from "../runtime";

const restorers: Array<() => void> = [];

afterEach(() => {
  while (restorers.length > 0) restorers.pop()?.();
});

function runtime(): SkintextRuntime {
  return {
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

function spyAccountStateSignal() {
  return spy("sendStateSignal", (async () => ({
    skipped: false,
    signal: {},
    accepted: Promise.resolve({ action: "persist" }),
    persisted: Promise.resolve(),
  })) as never);
}

function spyDeleteAccountConfirmation() {
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
  return spy("resumeStream", (async () => ({
    getFullOutput: async () => ({
      text: "Confirmation handled.",
      totalUsage: {
        inputTokens: 8,
        outputTokens: 2,
        totalTokens: 10,
      },
      runId: "run_suspended",
      steps: [{ text: "Confirmation handled." }],
    }),
  })) as never);
}

describe("Mastra thread messages", () => {
  test("delivers a concurrent user message to the active run", async () => {
    spy("listSuspendedRuns", async () => ({ runs: [], total: 0 }));
    const sendStateSignal = spyAccountStateSignal();
    const sendMessage = spy("sendMessage", (() => ({
      signal: {},
      accepted: Promise.resolve({ action: "deliver", runId: "run_active" }),
    })) as never);

    const result = await runSkintextAgent({ text: "actually, make it shorter" }, runtime());

    expect(result).toBeNull();
    expect(sendStateSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "account",
        mode: "snapshot",
        tagName: "account-state",
        cacheKey: expect.stringContaining("account:"),
        value: expect.objectContaining({
          mode: "main",
          localDate: "2026-07-28",
          timezone: { value: "UTC", confirmed: false },
        }),
      }),
      {
        resourceId: "usr_signals",
        threadId: "skintext:usr_signals",
        ifActive: { behavior: "deliver" },
        ifIdle: { behavior: "persist" },
      },
    );
    expect(sendMessage).toHaveBeenCalledWith(
      {
        contents: "actually, make it shorter",
        attributes: {
          minimumRiskState: "routine",
          scheduledEvent: false,
          offerCommunicationStyle: false,
          offerPhotoRetention: false,
        },
      },
      expect.objectContaining({
        resourceId: "usr_signals",
        threadId: "skintext:usr_signals",
        ifActive: expect.objectContaining({ behavior: "deliver" }),
      }),
    );
  });

  test("uses the attached file itself instead of an image boolean attribute", async () => {
    spy("listSuspendedRuns", async () => ({ runs: [], total: 0 }));
    spyAccountStateSignal();
    const sendMessage = spy("sendMessage", (() => ({
      signal: {},
      accepted: Promise.resolve({ action: "deliver", runId: "run_active" }),
    })) as never);
    const imageRuntime = runtime();
    imageRuntime.agentContext.hasImage = true;
    imageRuntime.agentContext.shouldOfferPhotoRetention = true;

    await runSkintextAgent(
      { text: "Where does this go?", imageUrl: "data:image/png;base64,aGVsbG8=" },
      imageRuntime,
    );

    expect(sendMessage).toHaveBeenCalledWith(
      {
        contents: [
          { type: "text", text: "Where does this go?\n\n[User attached a skincare/product photo]" },
          { type: "file", data: "data:image/png;base64,aGVsbG8=", mediaType: "image/png" },
        ],
        attributes: {
          minimumRiskState: "routine",
          scheduledEvent: false,
          offerCommunicationStyle: false,
          offerPhotoRetention: true,
        },
      },
      expect.anything(),
    );
  });

  test("uses native output steps to separate text from steered turns", async () => {
    spy("listSuspendedRuns", async () => ({ runs: [], total: 0 }));
    spyAccountStateSignal();
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
    const resumeStream = spyDeleteAccountConfirmation();

    const result = await runSkintextAgent({ text: "yes, delete everything" }, runtime());

    expect(resumeStream).toHaveBeenCalledWith(
      { confirmed: true },
      expect.objectContaining({
        runId: "run_suspended",
        toolCallId: "call_delete",
      }),
    );
    expect(result?.text).toBe("Confirmation handled.");
  });

  test("resumes a destructive action as declined for an explicit negative reply", async () => {
    const resumeStream = spyDeleteAccountConfirmation();

    await runSkintextAgent({ text: "no, keep everything" }, runtime());

    expect(resumeStream).toHaveBeenCalledWith(
      { confirmed: false },
      expect.objectContaining({
        runId: "run_suspended",
        toolCallId: "call_delete",
      }),
    );
  });

  test("does not infer destructive confirmation from an ambiguous reply", async () => {
    const resumeStream = spyDeleteAccountConfirmation();

    await runSkintextAgent({ text: "yesterday would be better" }, runtime());

    expect(resumeStream).toHaveBeenCalledWith(
      { confirmed: false },
      expect.objectContaining({
        runId: "run_suspended",
        toolCallId: "call_delete",
      }),
    );
  });
});
