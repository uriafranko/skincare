export function isExplicitTermsAcceptance(text: string): boolean {
  return /^\s*agree[\s.!]*$/i.test(text);
}

export function updatedTermsPrompt(locale: string): string {
  if (locale.toLowerCase().startsWith("sv")) {
    return "Innan vi fortsätter: svara AGREE för att godkänna de uppdaterade användarvillkoren: https://skintext.ai/terms och samtycka till att Lily behandlar och lagrar dina hudvårdsuppgifter enligt integritetspolicyn: https://skintext.ai/privacy. Lily är AI, inte vård; du ansvarar för dina beslut. Du kan radera dina uppgifter när som helst.";
  }

  return "Before we continue, reply AGREE to accept the updated Terms of Use: https://skintext.ai/terms and consent to Lily processing and storing your skincare data as described in the Privacy Policy: https://skintext.ai/privacy. Lily is AI, not medical care; you are responsible for decisions you make. You can delete your data anytime.";
}

export function termsAcceptedReply(locale: string): string {
  if (locale.toLowerCase().startsWith("sv")) {
    return "Tack, de uppdaterade villkoren är godkända. Skicka ditt hudvårdsmeddelande igen så fortsätter vi.";
  }

  return "Thanks, the updated Terms are accepted. Send your skincare message again and we'll continue.";
}
