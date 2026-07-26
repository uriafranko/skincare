import type {
  OnboardingState,
  RoutinePreference,
  SensitivityLevel,
  SkinType,
} from "@skintext/shared";
import {
  getMissingOnboardingFields,
  isLocalOnboardingComplete,
  mergeOnboardingState,
} from "./onboarding-state";

const GREETING_SETUP_REPLY =
  "Hey, I'm Skintext. I'll build a simple routine that fits you. Send your name, skin goal, skin type/sensitivity if known, avoids, products, and if you want reminders, best times. Unsure is fine. OK if I save this so reminders/logs work? You can delete anytime.";

const CONSENT_ONLY_REPLY = "OK if I save this so reminders/logs work? You can delete it anytime.";
const AGE_GATE_REPLY = "Hey, I'm Skintext. Before we set things up, are you 16-17 or 18+?";
const UNDER_16_REPLY = "Skintext is for people 16 or older, so I can't continue setup.";

const concernKeywords = [
  "acne",
  "breakout",
  "breakouts",
  "redness",
  "dryness",
  "dry cheeks",
  "oily",
  "pores",
  "texture",
  "pigmentation",
  "dark spots",
  "wrinkles",
  "rodnad",
  "torrhet",
  "finnar",
  "אקנה",
  "פצעונים",
  "אדמומיות",
  "יובש",
  "לחיים יבשות",
];

const goalKeywords = [
  "glow",
  "simple routine",
  "simpler routine",
  "clear skin",
  "even tone",
  "enkel rutin",
  "mindre rodnad",
  "פחות אדמומיות",
  "פחות יובש",
  "שגרה פשוטה",
];
const productKeywords = [
  "cleanser",
  "moisturizer",
  "moisturiser",
  "spf",
  "sunscreen",
  "serum",
  "retinol",
  "cerave",
  "tretinoin",
  "rengöring",
  "fuktkräm",
  "solskydd",
  "תכשיר ניקוי",
  "ניקוי",
  "קרם לחות",
  "לחות",
  "מקדם הגנה",
];

function hasNonAscii(value: string): boolean {
  return Array.from(value).some((char) => char.charCodeAt(0) > 127);
}

function titleCaseName(value: string): string {
  const [first] = value.trim().split(/\s+/);
  if (!first) return value;
  if (hasNonAscii(first)) return first;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function extractName(text: string): string | undefined {
  const match =
    /(?:קוראים לי|שמי|אני)\s+([\p{Script=Hebrew}]{2,20})/u.exec(text) ??
    /\b(?:i am|i'm|im|my name is|name is|call me|jag heter|heter)\s+([a-z][a-z'-]*)/i.exec(text) ??
    /^([A-Z][a-z'-]{1,20})\b/.exec(text.trim());
  if (!match?.[1]) return undefined;

  const name = titleCaseName(match[1]);
  if (/^(Yes|Yeah|Yep|Ok|Okay|Sure|Fine|Hi|Hey|Hello|Thanks|Jag|כן|שלום|היי)$/.test(name)) {
    return undefined;
  }
  return name;
}

function extractAge(text: string): Pick<OnboardingState, "ageBand" | "ageEligible"> {
  const lower = text.toLowerCase();
  if (/\b18\s*\+|\badult\b|\bvuxen\b|בן\s*18\s*ומעלה|בת\s*18\s*ומעלה/.test(lower)) {
    return { ageBand: "18_plus", ageEligible: true };
  }
  const match =
    /\b(?:i am|i'm|im|aged?|jag är)\s*(\d{1,2})\b/i.exec(text) ??
    /אני\s+(?:בן|בת)\s*(\d{1,2})/.exec(text);
  const age = match?.[1] ? Number(match[1]) : null;
  if (age === null || age > 120) return {};
  if (age < 16) return { ageEligible: false };
  return { ageBand: age <= 17 ? "16_17" : "18_plus", ageEligible: true };
}

function extractSkinType(lower: string): SkinType | undefined {
  if (/\bnot sure\b|\bunsure\b|\bdon't know\b|לא בטוח|לא בטוחה/.test(lower)) return "unsure";
  if (/\bcombination\b/.test(lower)) return "combination";
  if (/\bkombinerad\b/.test(lower)) return "combination";
  if (/מעורב|מעורבת/.test(lower)) return "combination";
  if (/\boily\b/.test(lower)) return "oily";
  if (/\bfet\b/.test(lower)) return "oily";
  if (/שמן|שמנוני/.test(lower)) return "oily";
  if (/\bdry\b/.test(lower)) return "dry";
  if (/\btorr\b/.test(lower)) return "dry";
  if (/יבש|יבשה/.test(lower)) return "dry";
  if (/\bnormal\b/.test(lower)) return "normal";
  if (/רגיל|רגילה/.test(lower)) return "normal";
  return undefined;
}

function extractSensitivity(lower: string): SensitivityLevel | undefined {
  if (/\bmycket känslig\b|\bhög känslighet\b/.test(lower)) return "high";
  if (/\bmedelkänslig\b|\bmåttligt känslig\b/.test(lower)) return "medium";
  if (/\binte känslig\b|\blåg känslighet\b/.test(lower)) return "low";
  if (/רגישות גבוהה|מאוד רגיש|מאד רגיש/.test(lower)) return "high";
  if (/רגישות בינונית|קצת רגיש/.test(lower)) return "medium";
  if (/רגישות נמוכה|לא רגיש/.test(lower)) return "low";
  if (/רגישות.*(?:לא בטוח|לא בטוחה)/.test(lower)) return "unsure";
  if (/\bhigh sensitivity\b|\bvery sensitive\b|\beasily irritated\b/.test(lower)) return "high";
  if (/\bmedium sensitivity\b|\bsomewhat sensitive\b/.test(lower)) return "medium";
  if (/\blow sensitivity\b|\bnot sensitive\b/.test(lower)) return "low";
  if (/\bsensitivity.*(?:not sure|unsure)\b/.test(lower)) return "unsure";
  return undefined;
}

function extractRoutinePreference(lower: string): RoutinePreference | undefined {
  if (/פשוט|בסיסי|מינימלי/.test(lower)) return "simple";
  if (/מפורט|מתקדם/.test(lower)) return "detailed";
  if (/\bsimple\b|\bbasic\b|\bminimal\b/.test(lower)) return "simple";
  if (/\bdetailed\b|\badvanced\b/.test(lower)) return "detailed";
  if (/\bstandard\b/.test(lower)) return "standard";
  return undefined;
}

function collectKeywords(lower: string, keywords: string[]): string[] {
  return keywords.filter((keyword) => lower.includes(keyword));
}

function extractAllergies(lower: string): string[] {
  const allergies: string[] = [];
  if (/\bfragrance\b/.test(lower)) allergies.push("fragrance");
  if (/בישום|מבושם|ריח/.test(lower)) allergies.push("fragrance");
  if (/\ballerg(?:y|ic|ies)\b/.test(lower)) allergies.push("reported allergy");
  if (/אלרג/.test(lower)) allergies.push("reported allergy");
  return allergies;
}

function normalizeTime(hour: number, minute: number, meridiem?: string): string {
  let normalizedHour = hour;
  if (meridiem?.toLowerCase() === "pm" && normalizedHour < 12) normalizedHour += 12;
  if (meridiem?.toLowerCase() === "am" && normalizedHour === 12) normalizedHour = 0;
  return `${String(normalizedHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function extractReminderTimes(
  text: string,
): Pick<OnboardingState, "morningReminder" | "eveningReminder"> {
  const withoutAges = text
    .replace(/\b(?:i am|i'm|im|aged?|jag är)\s*\d{1,3}\b/gi, "")
    .replace(/אני\s+(?:בן|בת)\s*\d{1,3}/g, "");
  const matches = Array.from(withoutAges.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/gi)).map(
    (match) => {
      const hour = Number(match[1]);
      const minute = match[2] ? Number(match[2]) : 0;
      const meridiem = match[3];
      if (hour > 23 || minute > 59) return null;
      return {
        rawHour: hour,
        value: normalizeTime(hour, minute, meridiem),
        meridiem: meridiem?.toLowerCase(),
      };
    },
  );

  const valid = matches.filter((match): match is NonNullable<typeof match> => !!match);
  const out: Pick<OnboardingState, "morningReminder" | "eveningReminder"> = {};

  for (const match of valid) {
    if (!out.morningReminder && (match.meridiem === "am" || match.rawHour < 12)) {
      out.morningReminder = match.value;
      continue;
    }
    if (!out.eveningReminder) out.eveningReminder = match.value;
  }

  return out;
}

function extractConsent(lower: string, previousBotReply?: string): boolean | undefined {
  const mentionsStorage =
    /\b(save|store|consent|data|spara|lagra|samtycke)\b|לשמור|שמירה|מידע|נתונים/.test(lower);
  const saysSure = /\bsure\b/.test(lower) && !/\bnot\s+sure\b/.test(lower);
  const affirmative =
    /\b(yes|yep|yeah|ok|okay|agree|fine|consent)\b/.test(lower) ||
    /כן|אפשר|בסדר|מאשר|מאשרת/.test(lower) ||
    /\b(ja|okej)\b/.test(lower) ||
    saysSure;
  const previousAskedConsent = /\b(save|store|consent|data)\b/i.test(previousBotReply ?? "");
  if ((mentionsStorage && affirmative) || (previousAskedConsent && affirmative)) return true;
  return undefined;
}

function buildCompleteReply(state: OnboardingState): string {
  if (state.detectedLocale === "he") {
    const name = state.name ? `, ${state.name}` : "";
    return `הכל מוכן${name}. התחלה ברורה. אחרי השגרה אפשר לכתוב סיימתי, או לשלוח תמונת עור/מוצר כשאת רוצה עזרה למקם משהו.`;
  }
  if (state.detectedLocale === "sv") {
    const name = state.name ? `, ${state.name}` : "";
    return `Klart${name}. Bra att hålla det enkelt. Skriv klar efter rutinen, eller skicka en hud- eller produktbild när du vill ha hjälp att placera något.`;
  }

  const name = state.name ? `, ${state.name}` : "";
  const compliment =
    state.routinePreference === "simple" ? "Good call keeping it simple." : "Nice clear setup.";
  return `All set${name}. ${compliment} Text done after your routine, or send a skin/product photo anytime you want help placing something.`;
}

export function extractStubOnboarding(
  text: string,
  state: OnboardingState,
): Partial<OnboardingState> {
  const lower = text.toLowerCase();
  const extracted: Partial<OnboardingState> = {};
  Object.assign(extracted, extractAge(text));

  if (!state.detectedLocale && /\p{Script=Hebrew}/u.test(text)) {
    extracted.detectedLocale = "he";
  } else if (!state.detectedLocale && /\b(?:jag|hud|känslig|spara|påminn)\b/i.test(text)) {
    extracted.detectedLocale = "sv";
  }

  if (!state.name) {
    const name = extractName(text);
    if (name) extracted.name = name;
  }

  const skinType = extractSkinType(lower);
  if (skinType) extracted.skinType = skinType;

  const sensitivity = extractSensitivity(lower);
  if (sensitivity) extracted.sensitivity = sensitivity;

  const concerns = collectKeywords(lower, concernKeywords);
  if (concerns.length) extracted.concerns = concerns;

  const goals = collectKeywords(lower, goalKeywords);
  if (goals.length) extracted.goals = goals;

  const allergies = extractAllergies(lower);
  if (allergies.length) extracted.allergies = allergies;

  const currentProducts = collectKeywords(lower, productKeywords);
  if (currentProducts.length) extracted.currentProducts = currentProducts;

  const routinePreference = extractRoutinePreference(lower);
  if (routinePreference) extracted.routinePreference = routinePreference;

  Object.assign(extracted, extractReminderTimes(text));

  const consented = extractConsent(lower, state.lastBotReply);
  if (consented) extracted.consented = true;

  return extracted;
}

export function buildStubReply(state: OnboardingState, isFirstMessage: boolean): string {
  if (state.ageEligible === false) return UNDER_16_REPLY;
  if (isLocalOnboardingComplete(state)) {
    return buildCompleteReply(state);
  }

  const missing = getMissingOnboardingFields(state);
  if (missing.includes("age_band")) return AGE_GATE_REPLY;
  if (isFirstMessage && missing.length > 1) {
    return GREETING_SETUP_REPLY;
  }

  if (missing.includes("name")) return "What should I call you? I want this to feel personal.";
  if (missing.includes("skin_goals")) {
    return "Nice, that helps. What are you mainly trying to improve right now?";
  }
  if (missing.includes("skin_profile")) {
    return "Good to know. What's your skin type or sensitivity like? Unsure is completely fine.";
  }
  if (missing.includes("consent")) {
    return CONSENT_ONLY_REPLY;
  }

  return "Got it. What else should I know for setup?";
}

export function advanceStubOnboarding(
  text: string,
  state: OnboardingState,
  isFirstMessage: boolean,
): { state: OnboardingState; reply: string; complete: boolean } {
  const rawExtracted = extractStubOnboarding(text, state);
  const extracted =
    rawExtracted.ageEligible === false
      ? {
          ageEligible: false,
          detectedLocale: rawExtracted.detectedLocale,
        }
      : !state.ageBand && !rawExtracted.ageBand
        ? { detectedLocale: rawExtracted.detectedLocale }
        : rawExtracted;
  const merged = mergeOnboardingState(state, extracted);
  const reply = buildStubReply(merged, isFirstMessage);
  return {
    state: { ...merged, lastBotReply: reply },
    reply,
    complete: isLocalOnboardingComplete(merged),
  };
}
