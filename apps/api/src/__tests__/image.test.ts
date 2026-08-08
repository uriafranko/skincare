import { afterEach, describe, expect, mock, test } from "bun:test";
import sharp from "sharp";
import { normalizeInboundImage } from "@/image";

const originalFetch = globalThis.fetch;
const originalTimeout = AbortSignal.timeout;

afterEach(() => {
  globalThis.fetch = originalFetch;
  AbortSignal.timeout = originalTimeout;
});

describe("inbound image normalization", () => {
  test("rejects non-HTTP image URLs without fetching them", async () => {
    const fetchMock = mock(async () => new Response());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(normalizeInboundImage("data:image/png;base64,aW1hZ2U=")).rejects.toThrow(
      "must use HTTP or HTTPS",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("applies a native fetch timeout signal", async () => {
    const timeoutReason = new DOMException("image fetch timed out", "TimeoutError");
    const timeoutMock = mock((_milliseconds: number) => AbortSignal.abort(timeoutReason));
    AbortSignal.timeout = timeoutMock;
    globalThis.fetch = mock(async (_input, init) => {
      if (init?.signal?.aborted) throw init.signal.reason;
      return new Response();
    }) as unknown as typeof fetch;

    await expect(normalizeInboundImage("https://example.com/photo.jpg")).rejects.toThrow(
      "image fetch timed out",
    );
    expect(timeoutMock).toHaveBeenCalledWith(10_000);
  });

  test("rejects an oversized declared content length before reading the body", async () => {
    let bodyRead = false;
    globalThis.fetch = mock(async () => {
      const response = new Response(null, {
        status: 200,
        headers: { "content-length": String(10 * 1024 * 1024 + 1) },
      });
      Object.defineProperty(response, "arrayBuffer", {
        value: async () => {
          bodyRead = true;
          return new ArrayBuffer(0);
        },
      });
      return response;
    }) as unknown as typeof fetch;

    await expect(normalizeInboundImage("https://example.com/photo.jpg")).rejects.toThrow(
      "exceeds the 10485760-byte limit",
    );
    expect(bodyRead).toBe(false);
  });

  test("rejects an oversized buffered body when content length is absent", async () => {
    globalThis.fetch = mock(
      async () =>
        new Response(new Uint8Array(10 * 1024 * 1024 + 1), {
          headers: { "content-type": "image/jpeg" },
        }),
    ) as unknown as typeof fetch;

    await expect(normalizeInboundImage("https://example.com/photo.jpg")).rejects.toThrow(
      "exceeds the 10485760-byte limit",
    );
  });

  test("rejects a non-image response", async () => {
    globalThis.fetch = mock(
      async () => new Response("not an image", { headers: { "content-type": "text/plain" } }),
    ) as unknown as typeof fetch;

    await expect(normalizeInboundImage("https://example.com/photo.jpg")).rejects.toThrow();
  });

  test("preserves successful JPEG normalization", async () => {
    const source = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    globalThis.fetch = mock(
      async () =>
        new Response(new Uint8Array(source), { headers: { "content-type": "image/png" } }),
    ) as unknown as typeof fetch;

    const result = await normalizeInboundImage("https://example.com/photo.png");

    expect(result?.contentType).toBe("image/jpeg");
    expect(result?.size).toBe(result?.buffer.byteLength);
    expect(result?.dataUrl).toStartWith("data:image/jpeg;base64,");
  });
});
