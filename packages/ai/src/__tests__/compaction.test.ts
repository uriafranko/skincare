import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { ModelMessage } from "ai";

const generateTextMock = mock(async (_options: { prompt?: string }) => ({
  text: "generated summary",
}));
const generateObjectMock = mock(async () => ({ object: {} }));
const gatewayMock = mock((modelId: string) => ({ provider: "gateway", modelId }));
const defaultGatewayModel = "openai/test-default";
const sharedEnv = {
  AI_GATEWAY_DEFAULT_MODEL: defaultGatewayModel,
  AI_GATEWAY_COMPACTION_MODEL: undefined as string | undefined,
};

mock.module("ai", () => ({
  Output: {
    object: (value: unknown) => value,
  },
  gateway: gatewayMock,
  generateObject: generateObjectMock,
  generateText: generateTextMock,
  tool: (definition: unknown) => definition,
}));

mock.module("@skintext/shared", () => ({
  DEFAULT_AI_GATEWAY_MODEL: defaultGatewayModel,
  decrypt: async (s: string) => s.replace(/^enc:/, ""),
  encryptContent: async (s: string) => `enc:${s}`,
  env: sharedEnv,
  generateId: () => "reminder_test",
  getLocaleName: (locale: string) => {
    const names: Record<string, string> = { en: "English", sv: "Swedish" };
    return names[locale] ?? "English";
  },
  localDateString: () => "2026-06-04",
  localDateTimeToDate: (date: string, hour: number, minute: number, timezone: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) return null;
    const [, year, month, day] = match;
    const offsetHours = timezone === "America/New_York" ? 4 : 0;
    return new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), hour + offsetHours, minute),
    );
  },
  resolveCompactionGatewayModelName: (source: {
    AI_GATEWAY_DEFAULT_MODEL?: string;
    AI_GATEWAY_COMPACTION_MODEL?: string;
  }) =>
    source.AI_GATEWAY_COMPACTION_MODEL?.trim() ||
    source.AI_GATEWAY_DEFAULT_MODEL?.trim() ||
    defaultGatewayModel,
  resolveDefaultGatewayModelName: (source: { AI_GATEWAY_DEFAULT_MODEL?: string }) =>
    source.AI_GATEWAY_DEFAULT_MODEL?.trim() || defaultGatewayModel,
}));

const {
  annotateLastAssistantMessageUsage,
  compactMessagesIfNeeded,
  createCompactionSummaryMessage,
  createRescueCompactionPrepareStep,
  estimateMessagesContextUsage,
  getCompactionModelName,
  isCompactionSummaryMessage,
  stripInternalMessageMetadata,
} = await import("../compaction");

function user(content: string): ModelMessage {
  return { role: "user", content };
}

function assistant(content: string): ModelMessage {
  return { role: "assistant", content };
}

function usage(overrides: Record<string, unknown> = {}) {
  return {
    inputTokens: 100,
    inputTokenDetails: {
      noCacheTokens: 60,
      cacheReadTokens: 40,
      cacheWriteTokens: 5,
    },
    outputTokens: 20,
    outputTokenDetails: {
      textTokens: 20,
      reasoningTokens: undefined,
    },
    totalTokens: 120,
    ...overrides,
  };
}

describe("conversation compaction", () => {
  beforeEach(() => {
    generateObjectMock.mockClear();
    generateTextMock.mockClear();
    gatewayMock.mockClear();
    sharedEnv.AI_GATEWAY_DEFAULT_MODEL = defaultGatewayModel;
    sharedEnv.AI_GATEWAY_COMPACTION_MODEL = undefined;
  });

  test("uses the default model for compaction unless a compaction override is configured", () => {
    sharedEnv.AI_GATEWAY_DEFAULT_MODEL = "openai/test-main";
    expect(getCompactionModelName()).toBe("openai/test-main");

    sharedEnv.AI_GATEWAY_COMPACTION_MODEL = "openai/test-compact";
    expect(getCompactionModelName()).toBe("openai/test-compact");
  });

  test("does not compact below the reserved-token threshold", async () => {
    const messages = [user("What cleanser should I use?"), assistant("Use a gentle cleanser.")];

    const result = await compactMessagesIfNeeded(messages, {
      contextWindowTokens: 10_000,
      reserveTokens: 1_000,
      keepRecentTokens: 50,
      model: {} as never,
    });

    expect(result.compacted).toBe(false);
    expect(result.thresholdTokens).toBe(9_000);
    expect(result.reserveTokens).toBe(1_000);
    expect(result.messages).toEqual(messages);
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  test("compacts above the reserved-token threshold and keeps the latest user turn", async () => {
    const latest = user("Can I add azelaic acid tonight?");
    const messages = [
      user(`Earlier routine details ${"a".repeat(500)}`),
      assistant(`Earlier advice ${"b".repeat(300)}`),
      latest,
    ];

    const result = await compactMessagesIfNeeded(messages, {
      contextWindowTokens: 100,
      reserveTokens: 30,
      keepRecentTokens: 10,
      model: {} as never,
    });

    expect(result.compacted).toBe(true);
    const summaryMessage = result.messages[0];
    expect(summaryMessage).toBeDefined();
    expect(isCompactionSummaryMessage(summaryMessage!)).toBe(true);
    expect(result.messages).toContainEqual(latest);
    expect(result.messages.filter(isCompactionSummaryMessage)).toHaveLength(1);
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  });

  test("updates an existing summary instead of stacking summaries", async () => {
    const existingSummary = createCompactionSummaryMessage("Old summary with fragrance allergy.");
    const messages = [
      existingSummary,
      user(`Older details ${"a".repeat(500)}`),
      assistant("Noted."),
      user("What should I do this morning?"),
    ];

    const result = await compactMessagesIfNeeded(messages, {
      contextWindowTokens: 100,
      reserveTokens: 30,
      keepRecentTokens: 10,
      model: {} as never,
    });

    expect(result.compacted).toBe(true);
    expect(result.messages.filter(isCompactionSummaryMessage)).toHaveLength(1);
    const summaryMessage = result.messages[0];
    expect(summaryMessage).toBeDefined();
    expect(String(summaryMessage!.content)).toContain("generated summary");
    expect(generateTextMock).toHaveBeenCalledTimes(1);
    const generateTextOptions = generateTextMock.mock.calls[0]?.[0];
    expect(generateTextOptions).toBeDefined();
    expect(generateTextOptions!.prompt).toContain("Old summary with fragrance allergy.");
  });

  test("prepareStep rescue compacts using the rescue reserve", async () => {
    const prepareStep = createRescueCompactionPrepareStep({
      contextWindowTokens: 100,
      keepRecentTokens: 10,
      model: {} as never,
    });

    const smallResult = await prepareStep({
      messages: [user("short"), assistant("short")],
    });
    expect(smallResult).toEqual({});

    const largeResult = await prepareStep({
      messages: [
        user(`Earlier routine details ${"a".repeat(500)}`),
        assistant(`Earlier advice ${"b".repeat(300)}`),
        user("What now?"),
      ],
    });

    expect("messages" in largeResult).toBe(true);
    expect(
      (largeResult as { messages: ModelMessage[] }).messages.filter(isCompactionSummaryMessage),
    ).toHaveLength(1);
  });

  test("prepareStep rescue still honors deprecated threshold option", async () => {
    const prepareStep = createRescueCompactionPrepareStep({
      contextWindowTokens: 100,
      threshold: 0.99,
      keepRecentTokens: 10,
      model: {} as never,
    });

    const result = await prepareStep({
      messages: [user("x".repeat(300)), assistant("short")],
    });

    expect(result).toEqual({});
  });

  test("uses persisted assistant usage as the context estimate anchor", () => {
    const messages = annotateLastAssistantMessageUsage(
      [user("old context"), assistant("old reply")],
      usage({
        inputTokens: 100,
        outputTokens: 20,
        inputTokenDetails: {
          noCacheTokens: 50,
          cacheReadTokens: 1_000,
          cacheWriteTokens: 250,
        },
        totalTokens: 120,
      }) as never,
      { systemPrompt: "old system", estimatedInputTokens: 95 },
    );

    const estimate = estimateMessagesContextUsage(
      [...messages, user("new trailing message")],
      "new system",
    );

    expect(estimate.usageTokens).toBe(120);
    expect(estimate.tokens).toBeLessThan(1_120);
    expect(estimate.trailingTokens).toBeGreaterThan(0);
    expect(estimate.lastUsageIndex).toBe(1);
  });

  test("tracks images separately from text token estimates", () => {
    const imageBase64 = "a".repeat(400);
    const messages: ModelMessage[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "what is this product?" },
          { type: "image", image: `data:image/jpeg;base64,${imageBase64}` },
        ],
      },
      {
        role: "user",
        content: [{ type: "image", image: "https://example.com/photo.jpg" }],
      },
    ];

    const estimate = estimateMessagesContextUsage(messages, "system");

    expect(estimate.imageCount).toBe(2);
    expect(estimate.imageTokens).toBe(2_400);
    expect(estimate.imageDataUrlCount).toBe(1);
    expect(estimate.imageRemoteUrlCount).toBe(1);
    expect(estimate.imagePayloadBytes).toBe(300);
  });

  test("strips internal usage metadata before model calls", () => {
    const messages = annotateLastAssistantMessageUsage(
      [user("hi"), assistant("hello")],
      usage() as never,
      { systemPrompt: "system" },
    );

    expect("_skintext" in messages[1]!).toBe(true);

    const clean = stripInternalMessageMetadata(messages);
    expect("_skintext" in clean[1]!).toBe(false);
    expect(clean).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
  });

  test("does not compact into a dangling tool result", async () => {
    const messages: ModelMessage[] = [
      user(`Original request ${"a".repeat(500)}`),
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tc_1",
            toolName: "getTodayRoutineLog",
            input: {},
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "tc_1",
            toolName: "getTodayRoutineLog",
            output: { type: "json", value: { entryCount: 1 } },
          },
        ],
      },
    ];

    const result = await compactMessagesIfNeeded(messages, {
      contextWindowTokens: 100,
      reserveTokens: 30,
      keepRecentTokens: 10,
      model: {} as never,
    });

    expect(result.compacted).toBe(true);
    expect(result.messages[1]?.role).toBe("assistant");
    expect(result.messages[2]?.role).toBe("tool");
  });
});
