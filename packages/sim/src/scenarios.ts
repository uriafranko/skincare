import type { SimulationScenario } from "./types";

export const onboardingScenarios: SimulationScenario[] = [
  {
    id: "onboarding-basic",
    title: "Cooperative one-message setup",
    area: "onboarding",
    task: "Optimize onboarding so a cooperative new user can provide everything once and get set up without repeated asks.",
    locale: "en",
    timezone: "America/New_York",
    persona: {
      kind: "scripted",
      profile:
        "Maya wants a simple routine, dislikes long setup flows, and is comfortable with data storage when asked plainly.",
      messages: [
        "Hi, I'm Maya. My goals are less redness and dryness. I have combination skin, medium sensitivity, and I avoid fragrance. I use a CeraVe cleanser and moisturizer. Remind me at 8am and 9pm. Yes, you can save this so reminders work.",
      ],
    },
    expectations: {
      onboardingComplete: true,
      maxAssistantMessages: 1,
      maxAssistantChars: 700,
      requiredFields: ["name", "skin_goals", "skin_profile", "consent"],
    },
    maxTurns: 4,
  },
  {
    id: "onboarding-consent-gap",
    title: "Complete profile but missing consent",
    area: "onboarding",
    task: "Optimize onboarding so consent is requested clearly only after useful skincare details have been captured.",
    locale: "en",
    timezone: "America/Los_Angeles",
    persona: {
      kind: "scripted",
      profile:
        "Noor answers the skincare questions but does not proactively agree to data storage until Skintext asks.",
      messages: [
        "I'm Noor. Oily skin, high sensitivity, acne is my main concern. I use a gentle cleanser and SPF. Mornings 7:30, evenings 10.",
        "Yes, that's fine. You can save it.",
      ],
    },
    expectations: {
      onboardingComplete: true,
      maxAssistantMessages: 2,
      maxAssistantChars: 500,
      requiredFields: ["name", "skin_goals", "skin_profile", "consent"],
    },
    maxTurns: 4,
  },
  {
    id: "onboarding-friction",
    title: "Fragmented setup with uncertainty",
    area: "onboarding",
    task: "Optimize onboarding so uncertain users can answer in fragments without being forced through a rigid form.",
    locale: "en",
    timezone: "Europe/Stockholm",
    persona: {
      kind: "scripted",
      profile:
        "Leo is impatient, unsure about skin type, and gives information in short fragments across several texts.",
      messages: [
        "hey",
        "Leo. Not sure on skin type. I get dry cheeks and breakouts. No fragrance please.",
        "Keep it simple. Remind me 07:30 and 22:00.",
        "yes, save it",
      ],
    },
    expectations: {
      onboardingComplete: true,
      maxAssistantMessages: 4,
      maxAssistantChars: 550,
      requiredFields: ["name", "skin_goals", "skin_profile", "consent"],
    },
    maxTurns: 6,
  },
];

export const scenarios = onboardingScenarios;

export function getScenario(id: string): SimulationScenario {
  const scenario = scenarios.find((item) => item.id === id);
  if (!scenario) {
    throw new Error(`Unknown scenario "${id}". Run "bun run sim list" to see available scenarios.`);
  }
  return scenario;
}
