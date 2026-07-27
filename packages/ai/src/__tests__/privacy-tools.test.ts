import { beforeEach, describe, expect, mock, test } from "bun:test";
import { RequestContext } from "@mastra/core/request-context";
import type { UserAccount } from "@skintext/shared";
import { updateUser } from "./db-mock";
import { createSharedMock } from "./shared-mock";

mock.module("@skintext/shared", () => createSharedMock());

const { saveCurrentPhotoTool, setPhotoRetentionTool } = await import("../tools/privacy");

function account(): UserAccount {
  return {
    id: "usr_photo",
    phone: "encrypted",
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
) {
  const context = new RequestContext();
  context.set("runtime", {
    userId: userAccount.id,
    timezone: "UTC",
    inputText: "save this for tracking",
    hasImage: true,
    isScheduledEvent: false,
    agentContext: { userAccount },
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
      saveCurrentPhotoTool,
      { consentToThirtyDayRetention: true },
      context,
    );
    const second = await execute(
      saveCurrentPhotoTool,
      { consentToThirtyDayRetention: true },
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
      saveCurrentPhotoTool,
      { consentToThirtyDayRetention: true },
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
    const result = await execute(setPhotoRetentionTool, { enabled: false }, context);

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
});
