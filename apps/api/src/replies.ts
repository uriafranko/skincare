const DEFAULT_MIN_CHARS = 120;
const DEFAULT_MAX_CHARS = 180;
const DEFAULT_HARD_MAX_CHARS = 1400;
const DEFAULT_MAX_CHUNKS = 4;
const NATURAL_DELAY_MIN_MS = 800;
const NATURAL_DELAY_MAX_MS = 2500;

export interface ReplySplitOptions {
  minChars?: number;
  maxChars?: number;
  hardMaxChars?: number;
  maxChunks?: number;
}

export interface ReplyDeliveryOptions extends ReplySplitOptions {
  delayMs?: () => number;
  send?: (phone: string, text: string) => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  typing?: (phone: string) => Promise<void>;
}

interface ResolvedSplitOptions {
  minChars: number;
  maxChars: number;
  hardMaxChars: number;
  maxChunks: number;
}

const LEADING_OPENERS = [
  "No worries",
  "Got it",
  "Okay",
  "Ok",
  "Sounds good",
  "Perfect",
  "Thanks",
  "Thank you",
  "Sure",
  "Absolutely",
  "Yep",
  "Yeah",
  "All set",
  "Done",
];

let sendblueModule: Promise<typeof import("./sendblue")> | null = null;

function loadSendblue() {
  sendblueModule ??= import("./sendblue");
  return sendblueModule;
}

async function defaultSendMessage(phone: string, text: string): Promise<void> {
  const { sendMessage } = await loadSendblue();
  await sendMessage(phone, text);
}

async function defaultSendTyping(phone: string): Promise<void> {
  const { sendTyping } = await loadSendblue();
  await sendTyping(phone);
}

function resolveSplitOptions(options: ReplySplitOptions): ResolvedSplitOptions {
  const hardMaxChars = Math.max(1, options.hardMaxChars ?? DEFAULT_HARD_MAX_CHARS);
  const maxChars = Math.min(hardMaxChars, Math.max(1, options.maxChars ?? DEFAULT_MAX_CHARS));
  const minChars = Math.min(maxChars, Math.max(1, options.minChars ?? DEFAULT_MIN_CHARS));
  const maxChunks = Math.max(1, options.maxChunks ?? DEFAULT_MAX_CHUNKS);

  return { minChars, maxChars, hardMaxChars, maxChunks };
}

function normalizeText(text: string): string {
  return text
    .replace(/\u2014/g, "-")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isStructuredReply(text: string): boolean {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const first = lines[0] ?? "";
  if (/^✅\s+.+\s+logged\b/i.test(first)) return true;
  if (/^Today$/i.test(first) && lines.some((line) => /^AM:/i.test(line))) return true;
  if (/^AM$/i.test(first) && lines.some((line) => /^PM$/i.test(line))) return true;

  const labeledLines = lines.filter((line) =>
    /^(Image type|Visible|Fit|Watchouts|Next|Reaction|Products|Notes):/i.test(line),
  );
  return labeledLines.length >= 2;
}

function sentenceSegments(text: string): string[] {
  const matches = text.match(/[^.!?。！？]+[.!?。！？]+(?:["')\]]+)?|[^.!?。！？]+$/g);
  return (matches ?? [text]).map((part) => part.trim()).filter(Boolean);
}

function splitLeadingOpener(
  text: string,
  options: ResolvedSplitOptions,
): { opener: string; rest: string } | null {
  if (text.length <= options.maxChars) return null;

  const lower = text.toLowerCase();
  for (const opener of LEADING_OPENERS) {
    if (!lower.startsWith(opener.toLowerCase())) continue;

    const afterOpener = text.slice(opener.length);
    const match = /^([^A-Za-z0-9]*)([\s\S]+)$/.exec(afterOpener);
    if (!match) continue;

    const separator = match[1] ?? "";
    const rest = (match[2] ?? "").trim();
    const openerText = `${opener}${separator}`.trim();
    const hasVisibleSeparator = /[^\s]/.test(separator);
    const restStartsSentence = /^[A-Z]/.test(rest);

    if (
      openerText.length <= 35 &&
      rest.length >= options.minChars &&
      (hasVisibleSeparator || restStartsSentence)
    ) {
      return { opener: openerText, rest };
    }
  }

  return null;
}

function splitLongSegment(segment: string, maxChars: number): string[] {
  if (segment.length <= maxChars) return [segment];

  const chunks: string[] = [];
  let remaining = segment.trim();

  while (remaining.length > maxChars) {
    const window = remaining.slice(0, maxChars + 1);
    const whitespaceIndex = Math.max(
      window.lastIndexOf(" "),
      window.lastIndexOf("\n"),
      window.lastIndexOf("\t"),
    );
    const splitAt = whitespaceIndex > maxChars * 0.45 ? whitespaceIndex : maxChars;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

function chooseSegments(text: string): { joiner: string; segments: string[] } {
  if (/\n\s*\n/.test(text)) {
    return {
      joiner: "\n\n",
      segments: text
        .split(/\n\s*\n/)
        .map((part) => part.trim())
        .filter(Boolean),
    };
  }

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 1) return { joiner: "\n", segments: lines };

  const sentences = sentenceSegments(text);
  if (sentences.length > 1) return { joiner: " ", segments: sentences };

  return {
    joiner: " ",
    segments: text
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean),
  };
}

function packSegments(segments: string[], joiner: string, options: ResolvedSplitOptions): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const rawSegment of segments) {
    const pieces = splitLongSegment(rawSegment, options.hardMaxChars);

    for (const segment of pieces) {
      if (!current) {
        current = segment;
        continue;
      }

      const candidate = `${current}${joiner}${segment}`;
      const canStayNatural = candidate.length <= options.maxChars;
      const avoidsTinyChunk =
        current.length < options.minChars && candidate.length <= options.hardMaxChars;

      if (canStayNatural || avoidsTinyChunk) {
        current = candidate;
      } else {
        chunks.push(current);
        current = segment;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function coalesceChunks(chunks: string[], maxChunks: number, hardMaxChars: number): string[] {
  const merged = [...chunks];

  while (merged.length > maxChunks) {
    let bestIndex = -1;
    let bestLength = Infinity;

    for (let i = 0; i < merged.length - 1; i++) {
      const candidate = `${merged[i]}\n\n${merged[i + 1]}`;
      if (candidate.length <= hardMaxChars && candidate.length < bestLength) {
        bestIndex = i;
        bestLength = candidate.length;
      }
    }

    if (bestIndex === -1) break;
    merged.splice(bestIndex, 2, `${merged[bestIndex]}\n\n${merged[bestIndex + 1]}`);
  }

  return merged;
}

export function splitReplyIntoBubbles(
  text: string,
  splitOptions: ReplySplitOptions = {},
): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const options = resolveSplitOptions(splitOptions);
  if (normalized.length <= options.minChars) return [normalized];
  if (isStructuredReply(normalized) && normalized.length <= options.hardMaxChars) {
    return [normalized];
  }

  const leadingOpener = splitLeadingOpener(normalized, options);
  if (leadingOpener) {
    return coalesceChunks(
      [leadingOpener.opener, ...splitReplyIntoBubbles(leadingOpener.rest, splitOptions)],
      options.maxChunks,
      options.hardMaxChars,
    );
  }

  const { joiner, segments } = chooseSegments(normalized);
  const packed = packSegments(segments, joiner, options);
  return coalesceChunks(packed, options.maxChunks, options.hardMaxChars);
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

  for (let i = 0; i < bubbles.length; i++) {
    if (i > 0) {
      await typing(phone).catch(() => undefined);
      await wait(delayMs());
    }

    await send(phone, bubbles[i]!);
  }

  return bubbles.length;
}
