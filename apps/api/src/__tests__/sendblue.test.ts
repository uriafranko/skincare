import { describe, expect, mock, test } from "bun:test";

mock.module("@skintext/shared", () => ({
  env: { SENDBLUE_WEBHOOK_SECRET: "expected-secret" },
  markRead: async () => {},
  sendMessage: async () => {},
  sendTyping: async () => {},
}));

const { parseInbound } = await import("../sendblue");

const inboundBody = {
  status: "RECEIVED",
  is_outbound: false,
  number: "+15555550123",
  content: "hello",
  media_url: "",
  message_handle: "message-1",
};

describe("parseInbound", () => {
  test("rejects webhook requests without a signing secret", () => {
    expect(parseInbound(new Headers(), inboundBody)).toBeNull();
  });

  test("rejects webhook requests with an invalid signing secret", () => {
    const headers = new Headers({ "sb-signing-secret": "wrong-secret" });

    expect(parseInbound(headers, inboundBody)).toBeNull();
  });

  test("accepts Sendblue's documented signing secret header", () => {
    const headers = new Headers({ "sb-signing-secret": "expected-secret" });

    expect(parseInbound(headers, inboundBody)).toEqual({
      phone: "+15555550123",
      text: "hello",
      imageUrl: undefined,
      messageId: "message-1",
    });
  });
});
