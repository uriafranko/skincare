import { beforeEach, describe, expect, mock, test } from "bun:test";
import { RequestContext } from "@mastra/core/request-context";

const renderMessageCard = mock(() =>
  Promise.resolve({
    svg: "<svg>card</svg>",
    filename: "evening-routine.png",
    width: 840,
    height: 720,
  }),
);

mock.module("@skintext/message-ui", () => ({ renderMessageCard }));

const { sendUiMessageTool } = await import("../tools/send-ui-message");

function executeTool(
  input: Record<string, unknown>,
  sendUiMessage?: (input: Record<string, unknown>) => Promise<void>,
) {
  const requestContext = new RequestContext();
  requestContext.set("runtime", {
    userId: "usr_test",
    timezone: "UTC",
    agentContext: {},
    sendUiMessage,
  });

  return (
    sendUiMessageTool as unknown as {
      execute: (args: Record<string, unknown>, options: unknown) => Promise<unknown>;
    }
  ).execute(input, { requestContext });
}

const card = {
  kind: "routine",
  title: "Evening routine",
  sections: [{ heading: "Tonight", items: ["Cleanser", "Moisturizer"] }],
};

describe("sendUiMessageTool", () => {
  beforeEach(() => {
    renderMessageCard.mockClear();
  });

  test("renders and sends the card through the current user's delivery callback", async () => {
    const sendUiMessage = mock(() => Promise.resolve());

    const result = await executeTool(card, sendUiMessage);

    expect(renderMessageCard).toHaveBeenCalledWith(card);
    expect(sendUiMessage).toHaveBeenCalledWith({
      userId: "usr_test",
      svg: "<svg>card</svg>",
      filename: "evening-routine.png",
      width: 840,
      height: 720,
    });
    expect(result).toEqual({
      sent: true,
      filename: "evening-routine.png",
      width: 840,
      height: 720,
    });
  });

  test("does not render when iMessage attachment delivery is unavailable", async () => {
    const result = await executeTool(card);

    expect(renderMessageCard).not.toHaveBeenCalled();
    expect(result).toEqual({
      sent: false,
      message: "Visual iMessage attachments are unavailable.",
    });
  });

  test("falls back to plain text for unsupported right-to-left card content", async () => {
    const sendUiMessage = mock(() => Promise.resolve());
    const result = await executeTool(
      {
        ...card,
        title: "שגרת ערב",
      },
      sendUiMessage,
    );

    expect(renderMessageCard).not.toHaveBeenCalled();
    expect(sendUiMessage).not.toHaveBeenCalled();
    expect(result).toEqual({
      sent: false,
      message: "Visual cards do not support right-to-left text; reply in plain text.",
    });
  });
});
