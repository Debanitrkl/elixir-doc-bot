interface DoctorContext {
  name: string;
  specialization: string;
  qualifications: string;
  customPrompt: string;
}

const BASE_MEDICAL_DISCLAIMER = `
IMPORTANT GUIDELINES:
- You are an AI medical assistant, NOT a doctor. You help with preliminary health assessment and triage only.
- NEVER provide a definitive diagnosis. Always recommend consulting the doctor for proper diagnosis.
- NEVER prescribe specific medications or dosages.
- For emergencies (chest pain, difficulty breathing, severe bleeding, etc.), immediately advise calling emergency services (112) or visiting the nearest hospital.
- Be empathetic, patient, and culturally sensitive.
- Ask relevant follow-up questions to understand symptoms better.
- Collect: symptom description, duration, severity (1-10), relevant medical history.
- Keep responses concise and clear - patients may have limited literacy.
- If the patient seems distressed, acknowledge their feelings before asking clinical questions.
`.trim();

/**
 * Build the system prompt for a doctor's AI assistant.
 */
export function buildSystemPrompt(doctor: DoctorContext): string {
  const parts = [
    `You are the AI medical assistant for Dr. ${doctor.name}`,
  ];

  if (doctor.specialization) {
    parts[0] += `, a ${doctor.specialization} specialist`;
  }

  if (doctor.qualifications) {
    parts[0] += ` (${doctor.qualifications})`;
  }

  parts[0] += ".";

  parts.push("");
  parts.push(BASE_MEDICAL_DISCLAIMER);

  if (doctor.customPrompt) {
    parts.push("");
    parts.push("ADDITIONAL INSTRUCTIONS FROM THE DOCTOR:");
    parts.push(doctor.customPrompt);
  }

  parts.push("");
  parts.push("CONVERSATION FORMAT:");
  parts.push("- All patient messages have been translated to English for you.");
  parts.push("- Respond in English. Your response will be translated back to the patient's language.");
  parts.push("- Use simple, clear language that translates well.");
  parts.push("- Avoid idioms, jargon, or complex medical terminology where possible.");
  parts.push("- Use numbered lists for multiple instructions.");

  return parts.join("\n");
}

/**
 * Build context from conversation history for GPT.
 */
export function buildConversationMessages(
  systemPrompt: string,
  history: Array<{ role: string; contentEnglish: string }>,
  newMessage: string
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  // Include recent history (last 20 messages for context)
  const recentHistory = history.slice(-20);
  for (const msg of recentHistory) {
    if (msg.role === "PATIENT") {
      messages.push({ role: "user", content: msg.contentEnglish });
    } else if (msg.role === "AI" || msg.role === "DOCTOR") {
      messages.push({ role: "assistant", content: msg.contentEnglish });
    }
  }

  // Add the new patient message
  messages.push({ role: "user", content: newMessage });

  return messages;
}
