export type SkinType = "dry" | "oily" | "combination" | "normal" | "unsure";

export type SensitivityLevel = "low" | "medium" | "high" | "unsure";

export type RoutinePreference = "simple" | "standard" | "detailed";

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

export interface ProductEntry {
  id: string;
  userId: string;
  name: string;
  category?: string;
  brand?: string;
  ingredients?: string[];
  notes?: string;
  source: "photo" | "text" | "manual";
  createdAt: string;
}

export interface RoutineStep {
  name: string;
  category?: string;
  productId?: string;
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

export interface UserProfile {
  id: string;
  phone: string;
  name: string;
  locale: string;
  timezone: string;
  country: string;
  skinType: SkinType;
  sensitivity: SensitivityLevel;
  concerns: string[];
  goals: string[];
  allergies: string[];
  currentProducts: string[];
  routinePreference: RoutinePreference;
  onboardingComplete: boolean;
  consentedAt: string | null;
  consentVersion: string | null;
  createdAt: string;
}

export interface OnboardingState {
  name?: string;
  timezoneConfirmed?: boolean;
  timezone?: string;
  skinType?: SkinType;
  sensitivity?: SensitivityLevel;
  concerns?: string[];
  goals?: string[];
  allergies?: string[];
  currentProducts?: string[];
  routinePreference?: RoutinePreference;
  morningReminder?: string;
  eveningReminder?: string;
  consented?: boolean;
  detectedLocale?: string;
  lastBotReply?: string;
}

export type OnboardingFieldKey = "name" | "skin_goals" | "skin_profile" | "consent";

export function getMissingFields(state: OnboardingState): OnboardingFieldKey[] {
  const missing: OnboardingFieldKey[] = [];
  if (!state.name) missing.push("name");
  if (!state.concerns?.length && !state.goals?.length) missing.push("skin_goals");
  if (!state.skinType && !state.sensitivity) missing.push("skin_profile");
  if (missing.length === 0 && !state.consented) missing.push("consent");
  return missing;
}

export function isOnboardingComplete(state: OnboardingState): boolean {
  return getMissingFields(state).length === 0 && state.consented === true;
}

export interface AgentContext {
  userId: string;
  userName: string;
  localeName: string;
  locale: string;
  timezone: string;
  localDate: string;
  userProfile: UserProfile | null;
  memories: Record<string, string> | null;
  todayLog: DailyRoutineLog | null;
  streak: number | null;
  products: ProductEntry[];
  imageUrl?: string;
  currentTimestamp?: string;
}

export interface PhoneRegionInfo {
  locale: string;
  timezone: string;
  country: string;
  countryName: string;
}
