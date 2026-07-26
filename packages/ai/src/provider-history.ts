import type { MastraDBMessage } from "@mastra/core/memory";
import { type CompatRule, ProviderHistoryCompat } from "@mastra/core/processors";

type UnknownRecord = Record<string, unknown>;

const GOOGLE_PROVIDER_KEYS = ["google", "vertex"] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripThoughtSignatureFromProviderBag(value: unknown): {
  value: unknown;
  changed: boolean;
} {
  if (!isRecord(value)) {
    return { value, changed: false };
  }

  let changed = false;
  const next = { ...value };

  for (const providerKey of GOOGLE_PROVIDER_KEYS) {
    const providerValue = next[providerKey];
    if (!isRecord(providerValue) || !("thoughtSignature" in providerValue)) {
      continue;
    }

    const { thoughtSignature: _thoughtSignature, ...providerOptions } = providerValue;
    next[providerKey] = providerOptions;
    changed = true;
  }

  return { value: changed ? next : value, changed };
}

function stripThoughtSignatureFromPart<T>(part: T): {
  part: T;
  changed: boolean;
} {
  if (!isRecord(part)) {
    return { part, changed: false };
  }

  const providerOptions = stripThoughtSignatureFromProviderBag(part.providerOptions);
  const providerMetadata = stripThoughtSignatureFromProviderBag(part.providerMetadata);

  if (!providerOptions.changed && !providerMetadata.changed) {
    return { part, changed: false };
  }

  return {
    part: {
      ...part,
      ...(providerOptions.changed ? { providerOptions: providerOptions.value } : {}),
      ...(providerMetadata.changed ? { providerMetadata: providerMetadata.value } : {}),
    } as T,
    changed: true,
  };
}

function stripThoughtSignaturesFromMessages(messages: MastraDBMessage[]): boolean {
  let changed = false;

  for (const message of messages) {
    if (message.role !== "assistant" || !message.content.parts) {
      continue;
    }

    for (let index = 0; index < message.content.parts.length; index += 1) {
      const part = message.content.parts[index];
      if (!part) {
        continue;
      }

      const result = stripThoughtSignatureFromPart(part);
      if (!result.changed) {
        continue;
      }

      message.content.parts[index] = result.part;
      changed = true;
    }
  }

  return changed;
}

export const googleThoughtSignatureCompatRule: CompatRule = {
  name: "google-strip-corrupted-thought-signatures",
  errorPatterns: [/corrupted thought signature/i],
  applyToPrompt({ prompt }) {
    let changed = false;
    const nextPrompt = prompt.map((message) => {
      if (
        message.role !== "assistant" ||
        typeof message.content === "string" ||
        !Array.isArray(message.content)
      ) {
        return message;
      }

      let messageChanged = false;
      const nextContent = message.content.map((part) => {
        if (part.type !== "text") {
          return part;
        }

        const result = stripThoughtSignatureFromPart(part);
        messageChanged ||= result.changed;
        return result.part;
      });

      changed ||= messageChanged;
      return messageChanged ? { ...message, content: nextContent } : message;
    });

    return changed ? nextPrompt : undefined;
  },
  fix(messages) {
    return stripThoughtSignaturesFromMessages(messages);
  },
};

export const skintextProviderHistoryCompat = new ProviderHistoryCompat({
  additionalRules: [googleThoughtSignatureCompatRule],
});
