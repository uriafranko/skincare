import type { RequestLogger } from "evlog";
import convert from "heic-convert";
import sharp from "sharp";

const MAX_DIMENSION = 1024;
const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const MAX_INPUT_PIXELS = 25_000_000;
const FETCH_TIMEOUT_MS = 10_000;
const OUTPUT_CONTENT_TYPE = "image/jpeg";

export interface NormalizedImage {
  dataUrl: string;
  buffer: Buffer;
  contentType: typeof OUTPUT_CONTENT_TYPE;
  size: number;
}

async function heicToJpeg(buffer: Buffer): Promise<Buffer> {
  const output = await convert({ buffer, format: "JPEG", quality: 0.9 });
  return Buffer.from(output);
}

function resizeAndEncode(input: Buffer): Promise<Buffer> {
  return sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();
}

/**
 * Fetch an image URL, convert HEIC/non-JPEG to JPEG, and resize for storage and vision.
 */
export async function normalizeInboundImage(
  url: string,
  log?: RequestLogger,
): Promise<NormalizedImage | null> {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new TypeError("Inbound image URL must use HTTP or HTTPS.");
  }

  const res = await fetch(parsedUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) return null;

  const contentLength = res.headers.get("content-length");
  if (contentLength) {
    const declaredBytes = Number(contentLength);
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_INPUT_BYTES) {
      throw new RangeError(`Inbound image exceeds the ${MAX_INPUT_BYTES}-byte limit.`);
    }
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > MAX_INPUT_BYTES) {
    throw new RangeError(`Inbound image exceeds the ${MAX_INPUT_BYTES}-byte limit.`);
  }
  const contentType = res.headers.get("content-type") ?? "";
  const isHeic = contentType.includes("heic") || contentType.includes("heif");

  let jpeg: Buffer;

  if (isHeic) {
    log?.set({ image: { sourceFormat: "heif", converted: true } });
    const raw = await heicToJpeg(buffer);
    jpeg = await resizeAndEncode(raw);
  } else {
    const meta = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
      .metadata()
      .catch(() => null);
    log?.set({ image: { sourceFormat: meta?.format ?? "unknown", converted: true } });
    jpeg = await resizeAndEncode(buffer);
  }

  const base64 = jpeg.toString("base64");
  return {
    dataUrl: `data:${OUTPUT_CONTENT_TYPE};base64,${base64}`,
    buffer: jpeg,
    contentType: OUTPUT_CONTENT_TYPE,
    size: jpeg.byteLength,
  };
}

/**
 * Fetch an image URL, convert HEIC/non-JPEG to JPEG, and resize for the vision API.
 * Returns a base64 data URL safe for OpenAI vision APIs, or the original URL if fetching fails.
 */
export async function normalizeImageUrl(url: string, log?: RequestLogger): Promise<string> {
  const normalized = await normalizeInboundImage(url, log);
  return normalized?.dataUrl ?? url;
}
