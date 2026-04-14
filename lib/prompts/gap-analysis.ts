export const GAP_ANALYSIS_SYSTEM = `You compare ad messaging to landing page messaging for message match.`;

export function buildGapAnalysisUser(
  adAnalysis: unknown,
  pageAnalysis: unknown,
): string {
  return `Given this ad analysis:
${JSON.stringify(adAnalysis, null, 2)}

And this landing page analysis:
${JSON.stringify(pageAnalysis, null, 2)}

Score the MESSAGE MATCH from 1-10 across these dimensions (integers):
- headline_continuity
- visual_tone_continuity
- cta_continuity
- audience_relevance
- value_prop_alignment
- urgency_preservation

Return ONLY valid JSON:
{
  "scores": { ...each key above... },
  "overall_message_match_before": <number 1-10>,
  "recommendations": [
    { "dimension": "headline_continuity", "score": <n>, "recommendation": "<specific fix>" }
  ]
}

For each dimension with score below 8, include a recommendation entry (dedupe dimensions).`;
}
