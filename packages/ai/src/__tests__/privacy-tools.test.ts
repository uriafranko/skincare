import { beforeEach, describe, expect, mock, test } from "bun:test";
import { RequestContext } from "@mastra/core/request-context";
import type { UserAccount } from "@skintext/shared";
import type { z } from "zod";
import { updateUser } from "./db-mock";
import { createSharedMock } from "./shared-mock";

mock.module("@skintext/shared", () => createSharedMock());

const { deleteSavedPhotosTool, managePhotoRetentionTool } = await import("../tools/privacy");

function account(): UserAccount {
  return {
    id: "usr_photo",
    phone: "+15555550123",
    locale: "en",
    timezone: "UTC",
    timezoneConfirmed: true,
    country: "US",
    styleOfferState: "shown",
    photoRetentionConsentedAt: null,
    photoRetentionConsentVersion: null,
    photoRetentionOfferShownAt: null,
    onboardingComplete: true,
    consentedAt: "2026-07-26T00:00:00.000Z",
    consentVersion: "2026-07-26",
    createdAt: "2026-07-26T00:00:00.000Z",
  };
}

function requestContext(
  userAccount: UserAccount,
  saveCurrentPhoto?: () => Promise<Record<string, unknown>>,
  hasImage = true,
) {
  const context = new RequestContext();
  context.set("runtime", {
    agentContext: {
      userId: userAccount.id,
      timezone: "UTC",
      hasImage,
      isScheduledEvent: false,
      userAccount,
    },
    saveCurrentPhoto,
    photoRetentionEnabled: false,
  });
  return context;
}

function execute(tool: unknown, input: Record<string, unknown>, context: RequestContext) {
  return (
    tool as { execute: (args: Record<string, unknown>, options: unknown) => Promise<unknown> }
  ).execute(input, { requestContext: context });
}

describe("photo-retention privacy tools", () => {
  beforeEach(() => {
    updateUser.mockClear();
  });

  test("validates action-specific consent fields", () => {
    const inputSchema = managePhotoRetentionTool.inputSchema as z.ZodType;
    expect(inputSchema.safeParse({ action: "set_future_retention" }).success).toBe(false);
    expect(inputSchema.safeParse({ action: "save_current" }).success).toBe(false);
    expect(
      inputSchema.safeParse({
        action: "set_future_retention",
        enabled: false,
      }).success,
    ).toBe(true);
    expect(
      inputSchema.safeParse({
        action: "save_current",
        consentToThirtyDayRetention: true,
      }).success,
    ).toBe(true);
  });

  test("records separate consent and saves the current photo idempotently", async () => {
    const image = {
      id: "img_1",
      userId: "usr_photo",
      key: "private/img_1",
      contentType: "image/jpeg",
      size: 123,
      source: "inbound",
      createdAt: "2026-07-26T00:00:00.000Z",
      expiresAt: "2026-08-25T00:00:00.000Z",
    };
    const save = mock(() => Promise.resolve(image));
    const user = account();
    const context = requestContext(user, save);

    const first = await execute(
      managePhotoRetentionTool,
      { action: "save_current", consentToThirtyDayRetention: true },
      context,
    );
    const second = await execute(
      managePhotoRetentionTool,
      { action: "save_current", consentToThirtyDayRetention: true },
      context,
    );

    expect(first).toEqual(expect.objectContaining({ saved: true }));
    expect(second).toEqual(expect.objectContaining({ saved: true, alreadySaved: true }));
    expect(save).toHaveBeenCalledTimes(1);
    expect(updateUser).toHaveBeenCalledWith(
      "usr_photo",
      expect.objectContaining({
        photoRetentionConsentVersion: "2026-07-26",
      }),
    );
    expect(user.photoRetentionConsentedAt).not.toBeNull();
  });

  test("reports storage failure instead of claiming success", async () => {
    const context = requestContext(account(), async () => {
      throw new Error("blob unavailable");
    });
    const result = await execute(
      managePhotoRetentionTool,
      { action: "save_current", consentToThirtyDayRetention: true },
      context,
    );
    expect(result).toEqual(
      expect.objectContaining({
        saved: false,
        message: expect.stringContaining("was not retained"),
      }),
    );
  });

  test("can opt out of future retention in the same turn", async () => {
    const user = account();
    user.photoRetentionConsentedAt = "2026-07-20T00:00:00.000Z";
    user.photoRetentionConsentVersion = "2026-07-26";
    const context = requestContext(user);
    const result = await execute(
      managePhotoRetentionTool,
      { action: "set_future_retention", enabled: false },
      context,
    );

    expect(result).toEqual(
      expect.objectContaining({
        updated: true,
        enabled: false,
        message: expect.stringContaining("Previously saved photos were not deleted"),
      }),
    );
    expect(user.photoRetentionConsentedAt).toBeNull();
    expect(updateUser).toHaveBeenCalledWith(
      "usr_photo",
      expect.objectContaining({
        photoRetentionConsentedAt: "",
        photoRetentionConsentVersion: "",
      }),
    );
  });

  test("can enable future retention without saving the current attachment", async () => {
    const save = mock(() => Promise.resolve({}));
    const user = account();
    const context = requestContext(user, save);
    const result = await execute(
      managePhotoRetentionTool,
      { action: "set_future_retention", enabled: true },
      context,
    );

    expect(result).toEqual(
      expect.objectContaining({
        updated: true,
        enabled: true,
        message: expect.stringContaining("current photo was not saved"),
      }),
    );
    expect(save).not.toHaveBeenCalled();
    expect(context.get("runtime")).toEqual(
      expect.objectContaining({
        photoRetentionEnabled: true,
        skipCurrentPhotoRetention: true,
      }),
    );
  });

  test("does not mention a current photo when none was attached", async () => {
    const user = account();
    const context = requestContext(user, undefined, false);
    const result = await execute(
      managePhotoRetentionTool,
      { action: "set_future_retention", enabled: true },
      context,
    );

    expect(result).toEqual(
      expect.objectContaining({
        updated: true,
        message: "Future photos may be retained for 30 days after processing.",
      }),
    );
  });
});

describe("saved-photo deletion confirmation", () => {
  test("uses Mastra suspension to request confirmation", async () => {
    const context = requestContext(account());
    const suspend = mock(() => Promise.resolve());
    if (!deleteSavedPhotosTool.execute) throw new Error("Tool is not executable.");

    await deleteSavedPhotosTool.execute({}, {
      requestContext: context,
      agent: {
        agentId: "skintext-agent",
        toolCallId: "call_delete_photos",
        messages: [],
        suspend,
      },
    } as never);

    expect(suspend).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Reply yes to confirm"),
      }),
      undefined,
    );
  });

  test("deletes only after Mastra resumes with confirmation", async () => {
    const deleteSavedPhotos = mock(() =>
      Promise.resolve({ attempted: 2, deleted: 2, queued: 0, errors: 0 }),
    );
    const context = requestContext(account());
    const runtime = context.get("runtime") as Record<string, unknown>;
    runtime.deleteSavedPhotos = deleteSavedPhotos;

    if (!deleteSavedPhotosTool.execute) throw new Error("Tool is not executable.");
    const result = await deleteSavedPhotosTool.execute({}, {
      requestContext: context,
      agent: {
        agentId: "skintext-agent",
        toolCallId: "call_delete_photos",
        messages: [],
        resumeData: { confirmed: true },
        suspend: () => Promise.resolve(),
      },
    } as never);

    expect(deleteSavedPhotos).toHaveBeenCalledWith("usr_photo");
    expect(result).toEqual(expect.objectContaining({ deleted: true }));
  });
});
