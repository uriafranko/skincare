import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { ModelMessage } from "ai";

const generateTextMock = mock(async (_options: { prompt?: string }) => ({
  text: "generated summary",
}));
const openaiMock = mock((modelId: string) => ({ provider: "openai", modelId }));

mock.module("ai", () => ({
  generateText: generateTextMock,
}));

mock.module("@ai-sdk/openai", () => ({
  openai: openaiMock,
}));

mock.module("@skintext/shared", () => ({
  env: { COMPACTION_MODEL: "gpt-4.1-mini" },
}));

const {
  compactMessagesIfNeeded,
  createCompactionSummaryMessage,
  createRescueCompactionPrepareStep,
  isCompactionSummaryMessage,
} = await import("../compaction");

function user(content: string): ModelMessage {
  return { role: "user", content };
}

function assistant(content: string): ModelMessage {
  return { role: "assistant", content };
}

describe("conversation compaction", () => {
  beforeEach(() => {
    generateTextMock.mockClear();
    openaiMock.mockClear();
  });

  test("does not compact below threshold", async () => {
    const messages = [user("What cleanser should I use?"), assistant("Use a gentle cleanser.")];

    const result = await compactMessagesIfNeeded(messages, {
      contextWindowTokens: 10_000,
      threshold: 0.7,
      keepRecentTokens: 50,
      model: {} as never,
    });

    expect(result.compacted).toBe(false);
    expect(result.messages).toEqual(messages);
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  test("compacts above the pre-run threshold and keeps the latest user turn", async () => {
    const latest = user("Can I add azelaic acid tonight?");
    const messages = [
      user(`Earlier routine details ${"a".repeat(500)}`),
      assistant(`Earlier advice ${"b".repeat(300)}`),
      latest,
    ];

    const result = await compactMessagesIfNeeded(messages, {
      contextWindowTokens: 100,
      threshold: 0.7,
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
      threshold: 0.7,
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

  test("prepareStep rescue only compacts above 80 percent", async () => {
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
});
