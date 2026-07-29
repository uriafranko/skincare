import { reserveInboundMessage, resolveUserId, tryAcquireMessageLock } from "@skintext/db";
import { encrypt } from "@skintext/shared";
import { createLogger, type RequestLogger } from "evlog";
import { errorForLogging } from "@/logging";
import { capturePostHogException } from "@/posthog";
import { sendReplyBubbles } from "@/replies";
import { routeConcurrentMessage, routeMessage } from "@/router";
import { sendMessage, sendTyping } from "@/sendblue";

const MAX_CACHE_SIZE = 500;
const MESSAGE_LOCK_WAIT_MS = 30_000;
const MESSAGE_LOCK_RETRY_MS = 100;
const encryptCache = new Map<string, string>();
async function cachedEncrypt(phone: string): Promise<string> {
  let enc = encryptCache.get(phone);
  if (!enc) {
    enc = await encrypt(phone);
    if (encryptCache.size >= MAX_CACHE_SIZE) encryptCache.clear();
    encryptCache.set(phone, enc);
  }
  return enc;
}

async function waitForMessageLock(encryptedPhone: string) {
  const deadline = Date.now() + MESSAGE_LOCK_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, MESSAGE_LOCK_RETRY_MS));
    const release = await tryAcquireMessageLock(encryptedPhone);
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

  const encryptedPhone = await cachedEncrypt(phone);
  if (!(await reserveInboundMessage(messageId))) {
    log.set({ skipped: "duplicate" });
    log.emit();
    return;
  }
  let releaseLock = await tryAcquireMessageLock(encryptedPhone);

  try {
    if (!releaseLock) {
      const concurrentReplies = await routeConcurrentMessage(
        log,
        encryptedPhone,
        phone,
        text,
        rawImageUrl,
        messageId,
      );
      if (concurrentReplies) {
        await deliverReplies(log, phone, concurrentReplies, true);
        return;
      }

      releaseLock = await waitForMessageLock(encryptedPhone);
    }

    log.set({ input: { textLength: text.length, hasImage: !!rawImageUrl } });
    void sendTyping(phone).catch(() => undefined);

    const replies = await routeMessage(log, encryptedPhone, phone, text, rawImageUrl, messageId);
    await deliverReplies(log, phone, replies);
  } catch (error) {
    const userId = await resolveUserId(encryptedPhone).catch(() => undefined);
    capturePostHogException(error, userId ?? undefined);
    log.error(errorForLogging(error));
    try {
      await sendMessage(phone, "Oops, something went wrong. Try again in a sec! 🙏");
    } catch {
      // swallow send failure for error message
    }
  } finally {
    await releaseLock?.();
    log.emit();
  }
}
