import { normalizeAssistantText } from "@skintext/ai/text";
import { sendMessage as defaultSendMessage, sendTyping as defaultSendTyping } from "@/sendblue";

const DEFAULT_HARD_MAX_CHARS = 1400;
const NATURAL_DELAY_MIN_MS = 800;
const NATURAL_DELAY_MAX_MS = 2500;

export interface ReplySplitOptions {
  hardMaxChars?: number;
}

export interface ReplyDeliveryOptions extends ReplySplitOptions {
  delayMs?: () => number;
  send?: (phone: string, text: string) => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  typing?: (phone: string) => Promise<void>;
}

/**
 * Keep the agent's intentional response shape. Only split when a message is
 * too large for reliable delivery, preferring a nearby whitespace boundary.
 */
export function splitReplyIntoBubbles(
  text: string,
  { hardMaxChars = DEFAULT_HARD_MAX_CHARS }: ReplySplitOptions = {},
): string[] {
  const normalized = normalizeAssistantText(text);
  if (!normalized) return [];

  const limit = Math.max(1, hardMaxChars);
  const bubbles: string[] = [];
  let remaining = normalized;

  while (remaining.length > limit) {
    const window = remaining.slice(0, limit + 1);
    const whitespaceIndex = Math.max(
      window.lastIndexOf(" "),
      window.lastIndexOf("\n"),
      window.lastIndexOf("\t"),
    );
    const splitAt = whitespaceIndex > limit * 0.45 ? whitespaceIndex : limit;
    bubbles.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) bubbles.push(remaining);
  return bubbles;
}

function naturalDelayMs(): number {
  return Math.round(
    NATURAL_DELAY_MIN_MS + Math.random() * (NATURAL_DELAY_MAX_MS - NATURAL_DELAY_MIN_MS),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendReplyBubbles(
  phone: string,
  replies: string[],
  options: ReplyDeliveryOptions = {},
): Promise<number> {
  const send = options.send ?? defaultSendMessage;
  const typing = options.typing ?? defaultSendTyping;
  const wait = options.sleep ?? sleep;
  const delayMs = options.delayMs ?? naturalDelayMs;
  const bubbles = replies.flatMap((reply) => splitReplyIntoBubbles(reply, options));

  for (let index = 0; index < bubbles.length; index++) {
    if (index > 0) {
      await typing(phone).catch(() => undefined);
      await wait(delayMs());
    }
    await send(phone, bubbles[index]!);
  }

  return bubbles.length;
}
