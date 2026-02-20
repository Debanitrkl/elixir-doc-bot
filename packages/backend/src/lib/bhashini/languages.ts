/**
 * Bhashini-supported Indian languages with ISO 639-1 codes.
 * These are the 22 scheduled languages of India.
 */
export const INDIAN_LANGUAGES: Record<string, { name: string; nativeScript: string; bhashiniCode: string }> = {
  as: { name: "Assamese", nativeScript: "অসমীয়া", bhashiniCode: "as" },
  bn: { name: "Bengali", nativeScript: "বাংলা", bhashiniCode: "bn" },
  brx: { name: "Bodo", nativeScript: "बड़ो", bhashiniCode: "brx" },
  doi: { name: "Dogri", nativeScript: "डोगरी", bhashiniCode: "doi" },
  gu: { name: "Gujarati", nativeScript: "ગુજરાતી", bhashiniCode: "gu" },
  hi: { name: "Hindi", nativeScript: "हिन्दी", bhashiniCode: "hi" },
  kn: { name: "Kannada", nativeScript: "ಕನ್ನಡ", bhashiniCode: "kn" },
  ks: { name: "Kashmiri", nativeScript: "कॉशुर", bhashiniCode: "ks" },
  gom: { name: "Konkani", nativeScript: "कोंकणी", bhashiniCode: "gom" },
  mai: { name: "Maithili", nativeScript: "मैथिली", bhashiniCode: "mai" },
  ml: { name: "Malayalam", nativeScript: "മലയാളം", bhashiniCode: "ml" },
  mni: { name: "Manipuri", nativeScript: "মৈতৈলোন্", bhashiniCode: "mni" },
  mr: { name: "Marathi", nativeScript: "मराठी", bhashiniCode: "mr" },
  ne: { name: "Nepali", nativeScript: "नेपाली", bhashiniCode: "ne" },
  or: { name: "Odia", nativeScript: "ଓଡ଼ିଆ", bhashiniCode: "or" },
  pa: { name: "Punjabi", nativeScript: "ਪੰਜਾਬੀ", bhashiniCode: "pa" },
  sa: { name: "Sanskrit", nativeScript: "संस्कृतम्", bhashiniCode: "sa" },
  sat: { name: "Santali", nativeScript: "ᱥᱟᱱᱛᱟᱲᱤ", bhashiniCode: "sat" },
  sd: { name: "Sindhi", nativeScript: "سنڌي", bhashiniCode: "sd" },
  ta: { name: "Tamil", nativeScript: "தமிழ்", bhashiniCode: "ta" },
  te: { name: "Telugu", nativeScript: "తెలుగు", bhashiniCode: "te" },
  ur: { name: "Urdu", nativeScript: "اردو", bhashiniCode: "ur" },
};

/**
 * Check if a language code is a supported Indian language.
 */
export function isSupportedLanguage(code: string): boolean {
  return code in INDIAN_LANGUAGES || code === "en";
}

/**
 * Get language name for display.
 */
export function getLanguageName(code: string): string {
  if (code === "en") return "English";
  return INDIAN_LANGUAGES[code]?.name || code;
}

/**
 * Build language selection message for first-time patients.
 */
export function buildLanguageSelectionMessage(): string {
  const lines = [
    "Welcome! Please select your preferred language / अपनी भाषा चुनें:",
    "",
  ];

  const popularLanguages = ["hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "or", "as", "ur"];

  popularLanguages.forEach((code, idx) => {
    const lang = INDIAN_LANGUAGES[code];
    if (lang) {
      lines.push(`${idx + 1}. ${lang.nativeScript} (${lang.name})`);
    }
  });

  lines.push("");
  lines.push("Reply with the number or language name.");
  lines.push("Or simply send a message in your language - we'll detect it automatically.");

  return lines.join("\n");
}

/**
 * Parse a language selection reply (number or name).
 */
export function parseLanguageSelection(text: string): string | null {
  const trimmed = text.trim().toLowerCase();
  const popularLanguages = ["hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "or", "as", "ur"];

  // Check if it's a number (1-12)
  const num = parseInt(trimmed, 10);
  if (num >= 1 && num <= popularLanguages.length) {
    return popularLanguages[num - 1];
  }

  // Check if it matches a language name
  for (const [code, lang] of Object.entries(INDIAN_LANGUAGES)) {
    if (
      lang.name.toLowerCase() === trimmed ||
      lang.nativeScript === trimmed ||
      code === trimmed
    ) {
      return code;
    }
  }

  return null;
}
