"use client";

import { useEffect, useRef, useState } from "react";

type VideoWithFrameCallback = HTMLVideoElement & {
  cancelVideoFrameCallback?: (handle: number) => void;
  requestVideoFrameCallback?: (callback: () => void) => number;
};

type ChromaCharacterProps = {
  active?: boolean;
  className?: string;
  label?: string;
  resolution?: "compact" | "large";
};

const VIDEO_SRC = "/character/skintext-guide-loop.mp4";
const POSTER_SRC = "/character/skintext-guide.png";

export function ChromaCharacter({
  active = true,
  className = "",
  label,
  resolution = "large",
}: ChromaCharacterProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const width = resolution === "compact" ? 180 : 360;
  const height = Math.round((width * 4) / 3);

  useEffect(() => {
    const video = videoRef.current as VideoWithFrameCallback | null;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { willReadFrequently: true });
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!video || !canvas || !context || reducedMotion || !active) {
      return;
    }

    let cancelled = false;
    let frameHandle: number | null = null;
    let animationHandle: number | null = null;
    let hasDrawn = false;

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          video.play().catch(() => {
            // The transparent PNG remains visible if autoplay is unavailable.
          });
        } else {
          video.pause();
        }
      },
      { rootMargin: "120px" },
    );

    visibilityObserver.observe(canvas);

    const schedule = () => {
      if (cancelled) return;

      if (video.requestVideoFrameCallback) {
        frameHandle = video.requestVideoFrameCallback(draw);
      } else {
        animationHandle = window.requestAnimationFrame(draw);
      }
    };

    const draw = () => {
      if (cancelled) return;

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        context.clearRect(0, 0, width, height);
        context.drawImage(video, 0, 0, width, height);

        const frame = context.getImageData(0, 0, width, height);
        const pixels = frame.data;

        for (let index = 0; index < pixels.length; index += 4) {
          const red = pixels[index] ?? 0;
          const green = pixels[index + 1] ?? 0;
          const blue = pixels[index + 2] ?? 0;
          const greenExcess = green - Math.max(red, blue);

          if (green > 72 && greenExcess > 18) {
            const alpha = Math.max(0, Math.min(255, ((78 - greenExcess) / 60) * 255));
            pixels[index + 1] = Math.min(green, Math.max(red, blue) + 6);
            pixels[index + 3] = alpha;
          }
        }

        context.putImageData(frame, 0, 0);

        if (!hasDrawn) {
          hasDrawn = true;
          setReady(true);
        }
      }

      schedule();
    };

    const start = () => {
      video.play().catch(() => {
        // The transparent PNG remains visible if autoplay is unavailable.
      });
      schedule();
    };

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      start();
    } else {
      video.addEventListener("loadeddata", start, { once: true });
    }

    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", start);
      visibilityObserver.disconnect();

      if (frameHandle !== null && video.cancelVideoFrameCallback) {
        video.cancelVideoFrameCallback(frameHandle);
      }

      if (animationHandle !== null) {
        window.cancelAnimationFrame(animationHandle);
      }

      video.pause();
    };
  }, [active, height, width]);

  const character = (
    <>
      <img
        src={POSTER_SRC}
        alt=""
        className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${
          ready ? "opacity-0" : "opacity-100"
        }`}
        draggable={false}
      />
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      />
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        muted
        loop
        playsInline
        preload="auto"
        className="pointer-events-none absolute h-px w-px opacity-0"
        tabIndex={-1}
        aria-hidden="true"
      />
    </>
  );

  if (label) {
    return (
      <div className={`relative aspect-[3/4] ${className}`} role="img" aria-label={label}>
        {character}
      </div>
    );
  }

  return (
    <div className={`relative aspect-[3/4] ${className}`} aria-hidden="true">
      {character}
    </div>
  );
}
