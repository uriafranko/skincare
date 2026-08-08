import { reserveInboundMessage, resolveUserId, tryAcquireMessageLock } from "@skintext/db";
import { createLogger, type RequestLogger } from "evlog";
import { reportError } from "@/logging";
import { sendReplyBubbles } from "@/replies";
import { routeConcurrentMessage, routeMessage } from "@/router";
import { sendMessage } from "@/sendblue";

const MESSAGE_LOCK_WAIT_MS = 30_000;
const MESSAGE_LOCK_RETRY_MS = 100;

async function waitForMessageLock(phone: string) {
  const deadline = Date.now() + MESSAGE_LOCK_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, MESSAGE_LOCK_RETRY_MS));
    const release = await tryAcquireMessageLock(phone);
    if (release) return release;
  }
  throw new Error("Timed out waiting for the user's active message to finish.");
}

async function deliverReplies(
  log: RequestLogger,
  phone: string,
  replies: string[],
  concurrent = false,
) {
  const bubbles = await sendReplyBubbles(phone, replies);
  log.set({
    output: {
      replies: replies.length,
      bubbles,
      ...(concurrent ? { steered: replies.length === 0 } : {}),
    },
  });
}

export async function handleIncoming(
  phone: string,
  text: string,
  rawImageUrl?: string,
  messageId?: string,
) {
  const log: RequestLogger = createLogger({
    scope: "message",
    phone: phone.slice(-4),
  });
  let releaseLock: Awaited<ReturnType<typeof tryAcquireMessageLock>> | undefined;

  try {
    if (!(await reserveInboundMessage(messageId))) {
      log.set({ skipped: "duplicate" });
      return;
    }

    releaseLock = await tryAcquireMessageLock(phone);
    if (!releaseLock) {
      const concurrentReplies = await routeConcurrentMessage(
        log,
        phone,
        text,
        rawImageUrl,
        messageId,
      );
      if (concurrentReplies) {
        await deliverReplies(log, phone, concurrentReplies, true);
        return;
      }

      releaseLock = await waitForMessageLock(phone);
    }

    log.set({ input: { textLength: text.length, hasImage: !!rawImageUrl } });

    const replies = await routeMessage(log, phone, text, rawImageUrl, messageId);
    await deliverReplies(log, phone, replies);
  } catch (error) {
    const userId = await resolveUserId(phone).catch(() => undefined);
    reportError(log, error, userId ?? undefined);
    try {
      await sendMessage(phone, "I hit a snag with that. Could you send it once more?");
    } catch {
      // swallow send failure for error message
    }
  } finally {
    try {
      await releaseLock?.();
    } finally {
      log.emit();
    }
  }
}
