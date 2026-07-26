import { describe, expect, test } from "bun:test";
import type { MastraDBMessage } from "@mastra/core/memory";
import { googleThoughtSignatureCompatRule } from "../provider-history";

describe("Google provider history compatibility", () => {
  test("removes stale signatures from assistant text without touching tool-call signatures", () => {
    const prompt = [
      {
        role: "assistant",
        content: [
          {
            type: "text",
            text: "Previous answer",
            providerOptions: {
              vertex: { thoughtSignature: "stale", keep: true },
              openai: { itemId: "msg_123" },
            },
          },
          {
            type: "tool-call",
            toolCallId: "call_123",
            toolName: "getProfile",
            input: {},
            providerOptions: {
              vertex: { thoughtSignature: "current-tool-signature" },
            },
          },
        ],
      },
      {
        role: "user",
        content: [{ type: "text", text: "Hello" }],
      },
    ] as never;

    const result = googleThoughtSignatureCompatRule.applyToPrompt?.({
      prompt,
      model: "google/gemini-3.5-flash",
    });

    expect(result).toBeDefined();
    expect(result?.[0]?.content).toEqual([
      {
        type: "text",
        text: "Previous answer",
        providerOptions: {
          vertex: { keep: true },
          openai: { itemId: "msg_123" },
        },
      },
      {
        type: "tool-call",
        toolCallId: "call_123",
        toolName: "getProfile",
        input: {},
        providerOptions: {
          vertex: { thoughtSignature: "current-tool-signature" },
        },
      },
    ]);
  });

  test("reactive repair strips Google and Vertex signatures from persisted assistant parts", () => {
    const messages = [
      {
        id: "msg_1",
        role: "assistant",
        content: {
          format: 2,
          parts: [
            {
              type: "text",
              text: "Previous answer",
              providerOptions: {
                vertex: { thoughtSignature: "stale-vertex" },
              },
            },
            {
              type: "tool-invocation",
              toolInvocation: {
                state: "result",
                toolCallId: "call_1",
                toolName: "getProfile",
                args: {},
                result: {},
              },
              providerMetadata: {
                google: { thoughtSignature: "stale-google", keep: "metadata" },
              },
            },
          ],
        },
        createdAt: new Date(),
      },
    ] as MastraDBMessage[];

    expect(googleThoughtSignatureCompatRule.fix?.(messages)).toBe(true);
    expect(messages[0]?.content.parts as unknown).toEqual([
      {
        type: "text",
        text: "Previous answer",
        providerOptions: {
          vertex: {},
        },
      },
      {
        type: "tool-invocation",
        toolInvocation: {
          state: "result",
          toolCallId: "call_1",
          toolName: "getProfile",
          args: {},
          result: {},
        },
        providerMetadata: {
          google: { keep: "metadata" },
        },
      },
    ]);
  });
});
