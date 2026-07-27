import { beforeEach, describe, expect, mock, test } from "bun:test";
import { RequestContext } from "@mastra/core/request-context";
import "./db-mock";

const deletionOrder: string[] = [];
const deleteUserMemory = mock(() => {
  deletionOrder.push("memory");
  return Promise.resolve();
});
mock.module("../memory", () => ({ deleteUserMemory }));

const { deleteAccountTool } = await import("../tools/delete-account");

function execute(
  resumeData?: { confirmed: boolean },
  runtime: Record<string, unknown> = {},
  suspend: (payload: { message: string }) => Promise<void> = () => Promise.resolve(),
) {
  if (!deleteAccountTool.execute) throw new Error("Tool is not executable.");
  const requestContext = new RequestContext();
  requestContext.set("runtime", {
    userId: "usr_delete",
    ...runtime,
  });
  return deleteAccountTool.execute({}, {
    requestContext,
    agent: {
      agentId: "skintext-agent",
      toolCallId: "call_delete_account",
      messages: [],
      resumeData,
      suspend,
    },
  } as never);
}

describe("deleteAccountTool", () => {
  beforeEach(() => {
    deletionOrder.length = 0;
    deleteUserMemory.mockClear();
  });

  test("uses Mastra suspension to request account-deletion confirmation", async () => {
    const suspend = mock(() => Promise.resolve());
    await execute(undefined, {}, suspend);

    expect(suspend).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("yes, delete everything"),
      }),
      undefined,
    );
  });

  test("deletes confirmed account data and then clears Mastra memory", async () => {
    const deleteAccountData = mock(() => {
      deletionOrder.push("data");
      return Promise.resolve();
    });

    const result = await execute({ confirmed: true }, { deleteAccountData });

    expect(deleteUserMemory).toHaveBeenCalledWith("usr_delete");
    expect(deleteAccountData).toHaveBeenCalledWith("usr_delete");
    expect(deletionOrder).toEqual(["data", "memory"]);
    expect(result).toEqual(expect.objectContaining({ deleted: true }));
  });
});
