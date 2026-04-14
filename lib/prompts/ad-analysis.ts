export const AD_ANALYSIS_SYSTEM = `You are an expert advertising analyst.`;

export const AD_ANALYSIS_USER = `Analyze this ad creative and extract:

1. PRIMARY_MESSAGE: The single most important message or promise being communicated
2. HEADLINE_HOOK: The main headline or attention-grabbing text
3. CTA_TEXT: The call-to-action button or phrase
4. VISUAL_TONE: Color palette, mood, style (e.g., "dark premium", "bright energetic", "professional clean")
5. TARGET_AUDIENCE_SIGNALS: Who this ad appears targeted at based on imagery, language, and design
6. VALUE_PROPOSITION: The core benefit or transformation promised
7. PAIN_POINT_ADDRESSED: What problem or desire is this ad triggering?
8. URGENCY_SCARCITY: Any urgency, scarcity, or FOMO elements present
9. TRUST_SIGNALS: Social proof, logos, stats, certifications visible
10. EMOTIONAL_TRIGGER: The primary emotion this ad aims to evoke (fear, excitement, aspiration, etc.)

Return ONLY valid JSON with exactly these keys (snake_case as listed). Use strings for all values; use empty string if unknown.`;
