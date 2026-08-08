import type { RequestLogger } from "evlog";
import { capturePostHogException } from "@/posthog";

export function errorForLogging(error: unknown): Error {
  const source = error instanceof Error ? error : new Error(String(error));
  const safeError = new Error(source.message);
  Object.defineProperty(safeError, "name", {
    configurable: true,
    value: source.name,
    writable: true,
  });
  safeError.stack = source.stack;
  return safeError;
}

export function reportError(
  log: Pick<RequestLogger, "error">,
  error: unknown,
  distinctId?: string,
): void {
  try {
    const safeError = errorForLogging(error);

    try {
      log.error(safeError);
    } catch {
      // Observability must never interfere with application control flow.
    }

    capturePostHogException(safeError, distinctId);
  } catch {
    // Error normalization itself must never mask the original application failure.
  }
}
