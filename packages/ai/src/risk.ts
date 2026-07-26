import type { SkintextRiskState } from "@skintext/shared";
import { USER_REMINDER_OPEN_TAG } from "./user-reminder";

const escalationPatterns = [
  /\b(can'?t|cannot|difficulty|trouble)\s+(breathe|breathing)\b/i,
  /\b(facial|face|eye|eyelid|lip)\s+(?:is\s+)?swelling\b/i,
  /\bvision\s+(change|loss|problem)|eye\s+(injury|pain)\b/i,
  /\b(blistering|severe pain|rapidly spreading|pus|infected|infection signs)\b/i,
  /\b(mole|lesion).*(changed shape|changing|bleeding|rapidly growing)\b/i,
  /\b(kill myself|suicide|self[- ]harm|hurt myself)\b/i,
  /קושי\s+בנשימה|נפיחות\s+(בפנים|בעיניים|בעפעפיים|בשפתיים)|כאב\s+חמור|שלפוחיות/,
  /svårt\s+att\s+andas|svullnad\s+(i\s+ansiktet|runt\s+ögonen)|svår\s+smärta|blåsor/i,
];

const cautionPatterns = [
  /\b(burning|burns|stinging|swelling|rash|allergic|allergy|worsening|persistent irritation)\b/i,
  /\b(pregnant|pregnancy|trying to conceive|prescription|retinoid|isotretinoin)\b/i,
  /\b(ugly|disgusting|unattractive|hate my face|face is defective|body dysmorphia)\b/i,
  /\b(eye|eyelid|lip)\s+(area|irritation|redness)\b/i,
  /שורף|צריבה|פריחה|אלרג|הריון|בהריון|מרשם|עיניים/,
  /bränner|svider|utslag|allerg|gravid|recept|ögon/i,
];

const styleOfferExclusions = [
  /\b(photo|image|selfie|picture|save|delete|forget|privacy|consent|export|account)\b/i,
  /\b(remind|reminder|notification|notify)\b/i,
  /\b(ugly|disgusting|unattractive|hate my face|only friend|suicide|self[- ]harm)\b/i,
  /\b(why|what).*(remember|saved)\b/i,
  /תמונה|לשמור|למחוק|פרטיות|הסכמה|מכוער|מגעיל|תזכיר|תזכורת/,
  /foto|bild|spara|radera|integritet|samtycke|ful|påminn/i,
];

export function deriveMinimumRiskState(text: string): SkintextRiskState {
  if (text.includes(USER_REMINDER_OPEN_TAG)) return "routine";
  if (escalationPatterns.some((pattern) => pattern.test(text))) return "escalation";
  if (cautionPatterns.some((pattern) => pattern.test(text))) return "caution";
  return "routine";
}

export function shouldOfferCommunicationStyle(input: {
  text: string;
  hasImage: boolean;
  isScheduledEvent: boolean;
  riskState: SkintextRiskState;
  offerState?: string;
}): boolean {
  if (input.offerState !== "pending") return false;
  if (input.hasImage || input.isScheduledEvent || input.riskState !== "routine") return false;
  const text = input.text.trim();
  if (!text || /^(hi|hey|hello|yo|שלום|היי|hej)[\s!.]*$/i.test(text)) return false;
  return !styleOfferExclusions.some((pattern) => pattern.test(text));
}

export function shouldOfferPhotoRetention(input: {
  text: string;
  hasImage: boolean;
  riskState: SkintextRiskState;
  ageBand: "16_17" | "18_plus" | null;
  consented: boolean;
  offerShown: boolean;
}): boolean {
  if (
    !input.hasImage ||
    input.riskState !== "routine" ||
    input.ageBand !== "18_plus" ||
    input.consented ||
    input.offerShown
  ) {
    return false;
  }
  return !/\b(?:save|store|retain|tracking|delete|privacy|private|forget)\b|(?:לשמור|אל תשמור|פרטיות|מחק)|(?:spara|radera|integritet)/iu.test(
    input.text,
  );
}
