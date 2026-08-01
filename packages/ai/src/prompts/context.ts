import { createHash } from "node:crypto";
import type { AgentContext } from "@skintext/shared";

export interface MainAccountState {
  version: 1;
  mode: "main";
  locale: {
    code: string;
    name: string;
  };
  localDate: string;
  timezone: {
    value: string;
    confirmed: boolean;
  };
  serviceConsent: {
    onboardingComplete: boolean;
    consented: boolean;
    version: string | null;
  };
  photoRetention: {
    enabled: boolean;
    consentVersion: string | null;
  };
  adherenceStreak: number | null;
}

export function buildMainAccountState(ctx: AgentContext): MainAccountState {
  const account = ctx.userAccount;
  return {
    version: 1,
    mode: "main",
    locale: {
      code: ctx.locale,
      name: ctx.localeName,
    },
    localDate: ctx.localDate,
    timezone: {
      value: ctx.timezone,
      confirmed: account?.timezoneConfirmed ?? false,
    },
    serviceConsent: {
      onboardingComplete: account?.onboardingComplete ?? false,
      consented: !!account?.consentedAt,
      version: account?.consentVersion ?? null,
    },
    photoRetention: {
      enabled: !!account?.photoRetentionConsentedAt,
      consentVersion: account?.photoRetentionConsentVersion ?? null,
    },
    adherenceStreak: ctx.streak,
  };
}

export function serializeMainAccountState(state: MainAccountState): string {
  return JSON.stringify(state);
}

export function mainAccountStateCacheKey(state: MainAccountState): string {
  return `account:${createHash("sha256").update(serializeMainAccountState(state)).digest("hex")}`;
}
