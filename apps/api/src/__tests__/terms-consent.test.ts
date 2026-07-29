import { describe, expect, test } from "bun:test";
import {
  isExplicitTermsAcceptance,
  termsAcceptedReply,
  updatedTermsPrompt,
} from "../terms-consent";

describe("updated Terms consent", () => {
  test("accepts only the explicit AGREE keyword", () => {
    expect(isExplicitTermsAcceptance("AGREE")).toBe(true);
    expect(isExplicitTermsAcceptance(" agree. ")).toBe(true);
    expect(isExplicitTermsAcceptance("yes")).toBe(false);
    expect(isExplicitTermsAcceptance("I agree")).toBe(false);
  });

  test("gives conspicuous Terms, privacy, AI, and responsibility notice", () => {
    for (const locale of ["en", "sv"]) {
      const prompt = updatedTermsPrompt(locale);
      expect(prompt).toContain("AGREE");
      expect(prompt).toContain("https://skintext.ai/terms");
      expect(prompt).toContain("https://skintext.ai/privacy");
    }

    expect(updatedTermsPrompt("en")).toContain("not medical care");
    expect(updatedTermsPrompt("en")).toContain("you are responsible");
    expect(updatedTermsPrompt("sv")).toContain("inte vård");
    expect(updatedTermsPrompt("sv")).toContain("du ansvarar");
  });

  test("asks the user to resend the interrupted skincare message", () => {
    expect(termsAcceptedReply("en")).toContain("Send your skincare message again");
    expect(termsAcceptedReply("sv")).toContain("Skicka ditt hudvårdsmeddelande igen");
  });
});
