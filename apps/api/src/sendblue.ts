import { env } from "@skintext/shared";

export {
  markRead,
  sendImageFile,
  sendImageMessage,
  sendMessage,
  sendTyping,
  uploadMediaFile,
} from "@skintext/shared";

// ── Webhook parsing (API-specific) ──────────────────────

export interface InboundMessage {
  phone: string;
  text: string;
  imageUrl: string | undefined;
  messageId: string | undefined;
}

const SECRET_HEADERS = [
  "sb-signing-secret",
  "x-webhook-secret",
  "x-sendblue-signature",
  "sb-webhook-secret",
];

export function parseInbound(headers: Headers, body: unknown): InboundMessage | null {
  const secret = SECRET_HEADERS.reduce<string | null>((v, h) => v ?? headers.get(h), null);
  if (!secret || secret !== env.SENDBLUE_WEBHOOK_SECRET) return null;

  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (b.is_outbound !== false || b.status !== "RECEIVED") return null;

  const phone = b.number;
  const content = b.content;
  const mediaUrl = b.media_url;
  const messageHandle = b.message_handle;
  if (typeof phone !== "string" || !phone) return null;
  if (content !== undefined && content !== null && typeof content !== "string") return null;
  if (mediaUrl !== undefined && mediaUrl !== null && typeof mediaUrl !== "string") return null;
  if (messageHandle !== undefined && messageHandle !== null && typeof messageHandle !== "string") {
    return null;
  }

  const text = content ?? "";
  const imageUrl = mediaUrl || undefined;
  const messageId = messageHandle || undefined;
  if (!text && !imageUrl) return null;

  return { phone, text, imageUrl, messageId };
}
