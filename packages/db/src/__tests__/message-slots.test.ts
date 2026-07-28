import { describe, expect, mock, test } from "bun:test";
import { createFakeDb } from "./fake-db";

const fakeDb = createFakeDb();

mock.module("../client", () => ({
  getDb: () => fakeDb,
}));

const { reserveInboundMessage, tryAcquireMessageLock } = await import("../message-slots");

describe("message slots", () => {
  test("reserves each inbound message id once", async () => {
    expect(await reserveInboundMessage("message_once")).toBeTrue();
    expect(await reserveInboundMessage("message_once")).toBeFalse();
    expect(await reserveInboundMessage()).toBeTrue();
  });

  test("retries the phone lock without changing the message reservation", async () => {
    expect(await reserveInboundMessage("message_waiting")).toBeTrue();
    const activeRelease = await tryAcquireMessageLock("phone_retry");
    expect(activeRelease).not.toBeNull();
    expect(await tryAcquireMessageLock("phone_retry")).toBeNull();

    await activeRelease?.();

    const retryRelease = await tryAcquireMessageLock("phone_retry");
    expect(retryRelease).not.toBeNull();
    expect(await reserveInboundMessage("message_waiting")).toBeFalse();
    await retryRelease?.();
  });
});
