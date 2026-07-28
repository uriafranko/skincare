import { describe, expect, test } from "bun:test";
import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { InMemoryStore } from "@mastra/core/storage";
import { Memory } from "@mastra/memory";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";

function modelStream(text: string, initialDelayInMs = 0) {
  return {
    stream: simulateReadableStream({
      initialDelayInMs,
      chunkDelayInMs: 2,
      chunks: [
        { type: "text-start" as const, id: `text-${text}` },
        { type: "text-delta" as const, id: `text-${text}`, delta: text },
        { type: "text-end" as const, id: `text-${text}` },
        {
          type: "finish" as const,
          finishReason: { unified: "stop" as const, raw: undefined },
          logprobs: undefined,
          usage: {
            inputTokens: {
              total: 2,
              noCache: 2,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: 1,
              text: 1,
              reasoning: undefined,
            },
          },
        },
      ],
    }),
  };
}

describe("installed Mastra signal runtime", () => {
  test("injects a second user message into the active thread loop", async () => {
    let modelCall = 0;
    const model = new MockLanguageModelV3({
      doStream: async () => {
        modelCall += 1;
        return modelStream(
          modelCall === 1 ? "first answer" : "steered answer",
          modelCall === 1 ? 30 : 0,
        );
      },
    });
    const storage = new InMemoryStore({ id: "signal-test-storage" });
    const memory = new Memory({ storage });
    const sourceAgent = new Agent({
      id: "signal-test-agent",
      name: "Signal test agent",
      instructions: "Answer briefly.",
      model,
      memory,
    });
    const mastra = new Mastra({
      storage,
      agents: { sourceAgent },
    });
    const agent = mastra.getAgent("sourceAgent");
    const target = { resourceId: "resource-1", threadId: "thread-1" };

    const first = await agent.sendMessage("first message", {
      ...target,
      ifIdle: {
        behavior: "wake",
        streamOptions: {
          memory: { resource: target.resourceId, thread: target.threadId },
          maxSteps: 4,
        },
      },
    }).accepted;
    expect(first.action).toBe("wake");
    if (first.action !== "wake") throw new Error("Expected the first message to wake the thread.");

    const second = await agent.sendMessage("second message", target).accepted;
    expect(second.action).toBe("deliver");

    const output = await first.output.getFullOutput();
    const stepText = output.steps.map((step) => step.text).join(" ");
    expect(model.doStreamCalls).toHaveLength(2);
    expect(stepText).toContain("first answer");
    expect(stepText).toContain("steered answer");
  });
});
