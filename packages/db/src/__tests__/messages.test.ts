import { describe, expect, mock, test } from "bun:test";

const store: Record<string, string> = {};

const mockRedis = {
  set: mock((key: string, value: string) => {
    store[key] = value;
    return Promise.resolve("OK");
  }),
  get: mock((key: string) => {
    return Promise.resolve(store[key] ?? null);
  }),
  del: mock((key: string) => {
    delete store[key];
    return Promise.resolve(1);
  }),
};

mock.module("../client", () => ({
  getRedis: () => mockRedis,
}));

mock.module("@skintext/shared", () => ({
  env: {},
  encryptContent: async (s: string) => `enc:${s}`,
  decrypt: async (s: string) => {
    if (!s.startsWith("enc:")) throw new Error("bad ciphertext");
    return s.slice(4);
  },
}));

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
  });

  test("returns empty array for unknown user", async () => {
    const messages = await getConversationMessages("usr_unknown");
    expect(messages).toEqual([]);
  });

  test("deleteAllMessages clears conversation", async () => {
    await saveConversationMessages("usr_del", [{ role: "user", content: "hello" }]);
    await deleteAllMessages("usr_del");
    const loaded = await getConversationMessages("usr_del");
    expect(loaded).toEqual([]);
  });
});
