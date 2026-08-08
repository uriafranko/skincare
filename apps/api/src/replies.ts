import { normalizeAssistantText } from "@skintext/ai/text";
import { sendMessage as defaultSendMessage, sendTyping as defaultSendTyping } from "@/sendblue";

const DEFAULT_HARD_MAX_CHARS = 1400;
const NATURAL_DELAY_MIN_MS = 800;
const NATURAL_DELAY_MAX_MS = 2500;
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

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

  let graphemes = Array.from(graphemeSegmenter.segment(remaining), ({ segment }) => segment);
  while (graphemes.length > limit) {
    const window = graphemes.slice(0, limit + 1);
    let whitespaceIndex = -1;
    for (let index = window.length - 1; index >= 0; index--) {
      const segment = window[index];
      if (segment === " " || segment === "\n" || segment === "\t") {
        whitespaceIndex = index;
        break;
      }
    }
    const splitAt = whitespaceIndex > limit * 0.45 ? whitespaceIndex : limit;
    bubbles.push(graphemes.slice(0, splitAt).join("").trim());
    remaining = graphemes.slice(splitAt).join("").trim();
    graphemes = Array.from(graphemeSegmenter.segment(remaining), ({ segment }) => segment);
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
