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

const { saveConversationMessages, getConversationMessages, deleteAllMessages } = await import(
  "../messages"
);

describe("conversation messages", () => {
  test("saves and retrieves ModelMessage array", async () => {
    const messages = [
      { role: "user", content: "I used my cleanser tonight" },
      { role: "assistant", content: "Evening routine logged." },
    ];
    await saveConversationMessages("usr_test", messages);
    const loaded = await getConversationMessages("usr_test");
    expect(loaded).toEqual(messages);

    const rows = fakeDb.rows(conversationMessages).filter((row) => row.userId === "usr_test");
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.messageIndex)).toEqual([0, 1]);
    expect(rows.map((row) => row.value)).toEqual(messages);
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
    await saveConversationMessages("usr_test2", messages);
    const loaded = await getConversationMessages("usr_test2");
    expect(loaded).toEqual(messages);
    expect(loaded).toHaveLength(4);

    const rows = fakeDb.rows(conversationMessages).filter((row) => row.userId === "usr_test2");
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.value)).toEqual(messages);
    expect(rows.every((row) => typeof row.value !== "string")).toBe(true);
  });

  test("preserves more than 40 messages", async () => {
    const messages = Array.from({ length: 45 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `message ${i}`,
    }));

    await saveConversationMessages("usr_long", messages);
    const loaded = await getConversationMessages("usr_long");

    expect(loaded).toEqual(messages);
    expect(loaded).toHaveLength(45);
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
        messageIndex: 0,
        value: `enc:${JSON.stringify(messages)}`,
      })
      .returning({ messageIndex: conversationMessages.messageIndex });

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
        messages.map((message, messageIndex) => ({
          userId: "usr_legacy_rows",
          messageIndex,
          value: `enc:${JSON.stringify(message)}`,
        })),
      )
      .returning({ messageIndex: conversationMessages.messageIndex });

    const loaded = await getConversationMessages("usr_legacy_rows");
    expect(loaded).toEqual(messages);
  });

  test("deleteAllMessages clears conversation", async () => {
    await saveConversationMessages("usr_del", [{ role: "user", content: "hello" }]);
    await deleteAllMessages("usr_del");
    const loaded = await getConversationMessages("usr_del");
    expect(loaded).toEqual([]);
  });
});
