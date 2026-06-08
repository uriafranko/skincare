import { describe, expect, mock, test } from "bun:test";
import { conversationMessages } from "../schema";
import { createFakeDb } from "./fake-db";
import { createSharedMock } from "./shared-mock";

const fakeDb = createFakeDb();

mock.module("../client", () => ({
  getDb: () => fakeDb,
}));

mock.module("@skintext/shared", () =>
  createSharedMock({
    decrypt: async (s: string) => {
      if (!s.startsWith("enc:")) throw new Error("bad ciphertext");
      return s.slice(4);
    },
  }),
);

const {
  appendConversationMessages,
  compactConversationMessages,
  getAllConversationMessages,
  getConversationMessageRecords,
  getConversationMessages,
  deleteAllMessages,
} = await import("../messages");

describe("conversation messages", () => {
  test("appends and retrieves ModelMessage array", async () => {
    const messages = [
      { role: "user", content: "I used my cleanser tonight" },
      { role: "assistant", content: "Evening routine logged." },
    ];
    await appendConversationMessages("usr_test", messages);
    const loaded = await getConversationMessages("usr_test");
    expect(loaded).toEqual(messages);

    const rows = fakeDb.rows(conversationMessages).filter((row) => row.userId === "usr_test");
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.value)).toEqual(messages);
    expect(rows[0]?.createdAt).toBeInstanceOf(Date);
    expect(rows[1]?.createdAt).toBeInstanceOf(Date);
    expect((rows[1]?.createdAt as Date).getTime()).toBeGreaterThan(
      (rows[0]?.createdAt as Date).getTime(),
    );
  });

  test("preserves tool call messages", async () => {
    const messages = [
      { role: "user", content: "I used my moisturizer" },
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tc_1",
            toolName: "logProductUse",
            args: { productName: "moisturizer" },
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "tc_1",
            toolName: "logProductUse",
            output: { logged: true },
          },
        ],
      },
      { role: "assistant", content: "Moisturizer logged for tonight." },
    ];
    await appendConversationMessages("usr_test2", messages);
    const loaded = await getConversationMessages("usr_test2");
    expect(loaded).toEqual(messages);
    expect(loaded).toHaveLength(4);

    const rows = fakeDb.rows(conversationMessages).filter((row) => row.userId === "usr_test2");
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.value)).toEqual(messages);
    expect(rows.every((row) => typeof row.value !== "string")).toBe(true);
  });

  test("preserves internal message metadata", async () => {
    const messages = [
      { role: "user", content: "hello" },
      {
        role: "assistant",
        content: "hi",
        _skintext: {
          usage: {
            inputTokens: 100,
            outputTokens: 20,
            totalTokens: 120,
            cacheReadTokens: 50,
            cacheWriteTokens: 5,
            systemPromptTokens: 10,
            createdAt: "2026-06-04T12:00:00.000Z",
          },
        },
      },
    ];

    await appendConversationMessages("usr_meta", messages);
    const loaded = await getConversationMessages("usr_meta");
    expect(loaded).toEqual(messages);
  });

  test("appends messages without rewriting existing rows", async () => {
    const firstUpdatedAt = new Date("2026-06-04T12:00:00.000Z");
    const secondUpdatedAt = new Date("2026-06-04T12:05:00.000Z");
    const messages = [
      { role: "user", content: "I used my cleanser" },
      { role: "assistant", content: "Cleanser logged." },
    ];
    const appendedMessage = { role: "user", content: "I also used moisturizer" };

    await fakeDb
      .insert(conversationMessages)
      .values(
        messages.map((message, offset) => ({
          userId: "usr_preserve",
          value: message,
          createdAt: new Date(firstUpdatedAt.getTime() + offset),
          updatedAt: offset === 0 ? firstUpdatedAt : secondUpdatedAt,
        })),
      )
      .returning({ createdAt: conversationMessages.createdAt });

    await appendConversationMessages("usr_preserve", [appendedMessage]);

    const rows = fakeDb
      .rows(conversationMessages)
      .filter((row) => row.userId === "usr_preserve")
      .sort(
        (left, right) => (left.createdAt as Date).getTime() - (right.createdAt as Date).getTime(),
      );

    expect(rows).toHaveLength(3);
    expect(rows[0]?.updatedAt).toBe(firstUpdatedAt);
    expect(rows[1]?.updatedAt).toBe(secondUpdatedAt);
    expect(rows[2]?.value).toEqual(appendedMessage);
  });

  test("appends after legacy single-row history", async () => {
    const legacyMessages = [
      { role: "user", content: "legacy hello" },
      { role: "assistant", content: "legacy reply" },
    ];
    const appendedMessage = { role: "user", content: "new hello" };

    await fakeDb
      .insert(conversationMessages)
      .values({
        userId: "usr_legacy_append",
        value: `enc:${JSON.stringify(legacyMessages)}`,
        createdAt: new Date("2026-06-04T12:00:00.000Z"),
      })
      .returning({ createdAt: conversationMessages.createdAt });

    await appendConversationMessages("usr_legacy_append", [appendedMessage]);

    const loaded = await getConversationMessages("usr_legacy_append");
    expect(loaded).toEqual([...legacyMessages, appendedMessage]);
  });

  test("preserves more than 40 messages", async () => {
    const messages = Array.from({ length: 45 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `message ${i}`,
    }));

    await appendConversationMessages("usr_long", messages);
    const loaded = await getConversationMessages("usr_long");

    expect(loaded).toEqual(messages);
    expect(loaded).toHaveLength(45);
  });

  test("orders retrieved messages by createdAt", async () => {
    const early = { role: "assistant", content: "early" };
    const late = { role: "user", content: "late" };

    await fakeDb
      .insert(conversationMessages)
      .values([
        {
          userId: "usr_created_at",
          value: late,
          createdAt: new Date("2026-06-04T12:10:00.000Z"),
        },
        {
          userId: "usr_created_at",
          value: early,
          createdAt: new Date("2026-06-04T12:00:00.000Z"),
        },
      ])
      .returning({ createdAt: conversationMessages.createdAt });

    const loaded = await getConversationMessages("usr_created_at");
    expect(loaded).toEqual([early, late]);
  });

  test("marks compacted rows inactive while keeping them for audit", async () => {
    const messages = [
      { role: "user", content: "old question" },
      { role: "assistant", content: "old answer" },
      { role: "user", content: "recent question" },
    ];
    const summary = {
      role: "system",
      content: "[Skintext conversation summary]\nOld question and answer were summarized.",
    };

    await appendConversationMessages("usr_compact", messages);
    const records = await getConversationMessageRecords("usr_compact");
    await compactConversationMessages("usr_compact", records[1]!.createdAt, summary);

    const active = await getConversationMessages("usr_compact");
    expect(active).toEqual([summary, messages[2]]);

    const auditMessages = await getAllConversationMessages("usr_compact");
    expect(auditMessages).toContainEqual(messages[0]);
    expect(auditMessages).toContainEqual(messages[1]);
    expect(auditMessages).toContainEqual(messages[2]);
    expect(auditMessages).toContainEqual(summary);

    const rows = fakeDb.rows(conversationMessages).filter((row) => row.userId === "usr_compact");
    expect(rows).toHaveLength(4);
    expect(rows.filter((row) => row.compactedAt != null)).toHaveLength(2);
    expect(rows.find((row) => row.value === summary)?.compactedAt).toBeNull();
  });

  test("returns empty array for unknown user", async () => {
    const messages = await getConversationMessages("usr_unknown");
    expect(messages).toEqual([]);
  });

  test("reads legacy single-row encrypted history", async () => {
    const messages = [
      { role: "user", content: "legacy hello" },
      { role: "assistant", content: "legacy reply" },
    ];
    await fakeDb
      .insert(conversationMessages)
      .values({
        userId: "usr_legacy",
        value: `enc:${JSON.stringify(messages)}`,
        createdAt: new Date("2026-06-04T12:00:00.000Z"),
      })
      .returning({ createdAt: conversationMessages.createdAt });

    const loaded = await getConversationMessages("usr_legacy");
    expect(loaded).toEqual(messages);
  });

  test("reads legacy per-message encrypted rows", async () => {
    const messages = [
      { role: "user", content: "legacy row hello" },
      { role: "assistant", content: "legacy row reply" },
    ];
    await fakeDb
      .insert(conversationMessages)
      .values(
        messages.map((message, offset) => ({
          userId: "usr_legacy_rows",
          value: `enc:${JSON.stringify(message)}`,
          createdAt: new Date(Date.UTC(2026, 5, 4, 12, offset)),
        })),
      )
      .returning({ createdAt: conversationMessages.createdAt });

    const loaded = await getConversationMessages("usr_legacy_rows");
    expect(loaded).toEqual(messages);
  });

  test("deleteAllMessages clears conversation", async () => {
    await appendConversationMessages("usr_del", [{ role: "user", content: "hello" }]);
    await deleteAllMessages("usr_del");
    const loaded = await getConversationMessages("usr_del");
    expect(loaded).toEqual([]);
  });
});
