import { env } from "./env";

const BASE = "https://api.sendblue.com/api";
const authHeaders = {
  "sb-api-key-id": env.SENDBLUE_API_KEY,
  "sb-api-secret-key": env.SENDBLUE_API_SECRET,
};

async function sendblueRequest(path: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Sendblue ${path} ${res.status}: ${text}`);
  }
}

export async function sendMessage(phone: string, text: string): Promise<void> {
  await sendblueRequest("/send-message", {
    number: phone,
    from_number: env.SENDBLUE_FROM_NUMBER,
    content: text,
  });
}

export async function sendImageMessage(
  phone: string,
  mediaUrl: string,
  text?: string,
): Promise<void> {
  const body: Record<string, unknown> = {
    number: phone,
    from_number: env.SENDBLUE_FROM_NUMBER,
    media_url: mediaUrl,
  };
  if (text?.trim()) body.content = text.trim();
  await sendblueRequest("/send-message", body);
}

export async function uploadMediaFile(file: Blob, filename = "image.jpg"): Promise<string> {
  const form = new FormData();
  form.append("file", file, filename);

  const res = await fetch(`${BASE}/upload-file`, {
    method: "POST",
    headers: authHeaders,
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Sendblue /upload-file ${res.status}: ${text}`);
  }

  const data = (await res.json().catch(() => null)) as { media_url?: unknown } | null;
  if (typeof data?.media_url !== "string" || !data.media_url) {
    throw new Error("Sendblue /upload-file response did not include media_url.");
  }

  return data.media_url;
}

export async function sendImageFile(
  phone: string,
  file: Blob,
  filename = "image.jpg",
  text?: string,
): Promise<void> {
  const mediaUrl = await uploadMediaFile(file, filename);
  await sendImageMessage(phone, mediaUrl, text);
}

export async function sendTyping(phone: string): Promise<void> {
  await sendblueRequest("/send-typing-indicator", {
    number: phone,
    from_number: env.SENDBLUE_FROM_NUMBER,
  });
}

export async function markRead(phone: string): Promise<void> {
  await sendblueRequest("/mark-read", {
    number: phone,
    from_number: env.SENDBLUE_FROM_NUMBER,
  });
}
