import { waitUntil } from "@vercel/functions";
import { PostHog } from "posthog-node";

const token = process.env.POSTHOG_PROJECT_TOKEN;
const host = process.env.POSTHOG_HOST;

if ((!token || !host) && process.env.NODE_ENV !== "production") {
  const missing = !token ? "POSTHOG_PROJECT_TOKEN" : "POSTHOG_HOST";
  throw new Error(
    `${missing} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missing} is configured`,
  );
}

export const posthog =
  token && host
    ? new PostHog(token, {
        host,
        enableExceptionAutocapture: true,
        flushAt: 1,
        flushInterval: 0,
        waitUntil,
      })
    : null;

export function capturePostHogException(error: unknown, distinctId?: string): void {
  try {
    posthog?.captureException(error, distinctId);
  } catch (captureError) {
    console.error("[PostHog] Failed to enqueue exception", captureError);
  }
}
