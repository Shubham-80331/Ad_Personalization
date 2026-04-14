export const TRANSFORM_SYSTEM = `You are a world-class CRO consultant and conversion copywriter.`;

export function buildTransformUser(params: {
  adAnalysis: unknown;
  gapAnalysis: unknown;
  htmlForModel: string;
}): string {
  return `You have been given:

AD CREATIVE ANALYSIS:
${JSON.stringify(params.adAnalysis, null, 2)}

MESSAGE MATCH GAPS:
${JSON.stringify(params.gapAnalysis, null, 2)}

CURRENT LANDING PAGE HTML (possibly truncated; preserve structure):
${params.htmlForModel}

Your task: Rewrite and enhance the existing HTML to create a personalized, high-converting version.

RULES (CRITICAL):
1. DO NOT create a new page. Work with the existing HTML structure.
2. PRESERVE the brand's visual identity (colors, fonts, logo, images).
3. MAKE SURGICAL CHANGES ONLY — edit text, reorder sections, add/modify elements.
4. EVERY CHANGE must serve either (a) message match with the ad or (b) a CRO principle.

CRO PRINCIPLES TO APPLY:
- Above-the-fold: Headline must directly echo the ad's primary promise within 5 words where possible
- Hero subheadline: Expand on the promise with the specific benefit
- CTA button: Use action-oriented, specific text (not "Submit" or "Click Here")
- Social proof: Move the strongest testimonial/stat above the fold if not already
- Specificity: Replace vague claims with specific numbers where possible
- Urgency: Add a subtle but genuine urgency element if the ad had one
- Visual hierarchy: Ensure the eye path leads naturally to the CTA
- Friction reduction: Simplify forms, remove unnecessary fields, add trust signals near CTAs
- Personalization tokens: Address the ad's target audience explicitly in copy
- FAQ: Add/modify to address objections the ad's audience likely has

OUTPUT FORMAT:
Return ONLY valid JSON (no markdown fences) with:
{
  "modified_html": "<full modified HTML string>",
  "changes_made": [
    {
      "section": "hero_headline",
      "original": "...",
      "modified": "...",
      "reason": "...",
      "tag": "message_match" | "cro" | "urgency" | "trust" | "friction"
    }
  ],
  "cro_score_before": <number 0-100>,
  "cro_score_after": <number 0-100>,
  "message_match_score_before": <number 1-10>,
  "message_match_score_after": <number 1-10>
}

Use realistic integer scores. Ensure modified_html is complete valid HTML.`;
}
