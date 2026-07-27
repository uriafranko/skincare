export type SkinType = "dry" | "oily" | "combination" | "normal" | "unsure";

export type SensitivityLevel = "low" | "medium" | "high" | "unsure";

export type RoutinePreference = "simple" | "standard" | "detailed";

export type CommunicationStyle =
  | "clear_expert"
  | "gentle_coach"
  | "playful_guide"
  | "straight_talk";

export type StyleOfferState = "pending" | "shown";

export type SkintextRiskState = "routine" | "caution" | "escalation";

export type RoutineSlot = "morning" | "evening" | "custom";

export type OneOffReminderKind = "routine_followup" | "skin_checkin" | "custom";

export type OneOffReminderStatus = "scheduled" | "sent" | "cancelled" | "failed";

export interface OneOffReminder {
  id: string;
  userId: string;
  sendAt: string;
  timezone: string;
  kind: OneOffReminderKind;
  message: string;
  status: OneOffReminderStatus;
  createdAt: string;
  updatedAt?: string;
  sentAt?: string;
  cancelledAt?: string;
  failedAt?: string;
  workflowRunId?: string;
}

export interface UserImage {
  id: string;
  userId: string;
  key: string;
  contentType: string;
  size: number;
  source: "inbound";
  sourceMessageId?: string;
  sourceText?: string;
  createdAt: string;
  expiresAt: string;
}

export interface RoutineStep {
  name: string;
  category?: string;
  productName?: string;
  notes?: string;
}

export interface RoutineLogEntry {
  id: string;
  userId: string;
  slot: RoutineSlot;
  steps: RoutineStep[];
  completed: boolean;
  reaction?: string;
  notes?: string;
  source: "photo" | "text" | "manual";
  timestamp: string;
  localDate: string;
}

export interface DailyRoutineLog {
  entries: RoutineLogEntry[];
  entryCount: number;
  completedSlots: RoutineSlot[];
  productsUsed: string[];
  reactions: string[];
}

export interface AdherenceStreak {
  current: number;
  longest: number;
  lastLogDate: string;
}

export interface UserAccount {
  id: string;
  phone: string;
  locale: string;
  timezone: string;
  timezoneConfirmed: boolean;
  country: string;
  styleOfferState: StyleOfferState;
  photoRetentionConsentedAt: string | null;
  photoRetentionConsentVersion: string | null;
  photoRetentionOfferShownAt: string | null;
  onboardingComplete: boolean;
  consentedAt: string | null;
  consentVersion: string | null;
  createdAt: string;
}

export interface OnboardingState {
  ageEligible?: boolean;
  name?: string;
  timezoneConfirmed?: boolean;
  timezone?: string;
  skinType?: SkinType;
  sensitivity?: SensitivityLevel;
  concerns?: readonly string[];
  goals?: readonly string[];
  allergies?: readonly string[];
  currentProducts?: readonly string[];
  routinePreference?: RoutinePreference;
  morningReminder?: string;
  eveningReminder?: string;
  consented?: boolean;
  detectedLocale?: string;
  lastBotReply?: string;
}

export type OnboardingFieldKey =
  | "age_eligibility"
  | "name"
  | "skin_goals"
  | "skin_profile"
  | "timezone"
  | "consent";

export function getMissingFields(state: OnboardingState): OnboardingFieldKey[] {
  const missing: OnboardingFieldKey[] = [];
  if (state.ageEligible !== true) missing.push("age_eligibility");
  if (!state.name) missing.push("name");
  if (!state.concerns?.length && !state.goals?.length) missing.push("skin_goals");
  if (!state.skinType && !state.sensitivity) missing.push("skin_profile");
  if ((state.morningReminder || state.eveningReminder) && !state.timezoneConfirmed) {
    missing.push("timezone");
  }
  if (missing.length === 0 && !state.consented) missing.push("consent");
  return missing;
}

export function isOnboardingComplete(state: OnboardingState): boolean {
  return getMissingFields(state).length === 0 && state.consented === true;
}

export interface AgentContext {
  userId: string;
  localeName: string;
  locale: string;
  timezone: string;
  localDate: string;
  userAccount: UserAccount | null;
  riskState: SkintextRiskState;
  shouldOfferStyle: boolean;
  shouldOfferPhotoRetention: boolean;
  hasImage: boolean;
  isScheduledEvent: boolean;
  streak: number | null;
}

export interface PhoneRegionInfo {
  locale: string;
  timezone: string;
  country: string;
  countryName: string;
}
