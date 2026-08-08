import { afterEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { createFakeDb } from "./fake-db";

const fakeDb = createFakeDb();

mock.module("../client", () => ({
  getDb: () => fakeDb,
}));

const { reserveInboundMessage, tryAcquireMessageLock } = await import("../message-slots");

afterEach(() => {
  setSystemTime();
});

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

  test("a stale owner cannot release a newer lock after its lease expires", async () => {
    setSystemTime(new Date("2099-01-01T00:00:00.000Z"));
    const staleRelease = await tryAcquireMessageLock("phone_expired_owner");
    expect(staleRelease).not.toBeNull();

    setSystemTime(new Date("2099-01-01T00:01:01.000Z"));
    const currentRelease = await tryAcquireMessageLock("phone_expired_owner");
    expect(currentRelease).not.toBeNull();

    await staleRelease?.();
    expect(await tryAcquireMessageLock("phone_expired_owner")).toBeNull();

    await currentRelease?.();
    expect(await tryAcquireMessageLock("phone_expired_owner")).not.toBeNull();
  });
});
