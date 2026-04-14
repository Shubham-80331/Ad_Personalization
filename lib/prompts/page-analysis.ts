export const PAGE_ANALYSIS_SYSTEM = `You are a CRO (Conversion Rate Optimization) expert.`;

export const PAGE_ANALYSIS_USER = `Analyze this landing page HTML and the attached full-page screenshot.

Extract and return ONLY valid JSON with these keys:
1. CURRENT_HEADLINE: The H1 or main hero headline
2. CURRENT_SUBHEADLINE: The subtitle or supporting text
3. CURRENT_CTA_TEXT: Primary CTA button text
4. SECTIONS: Array of section labels on the page (hero, features, social_proof, pricing, FAQ, etc.)
5. CURRENT_VALUE_PROPS: Array of key benefits/features listed
6. TRUST_SIGNALS: Array of testimonials, logos, reviews, stats present (short strings)
7. PAGE_TONE: Current tone and style of writing
8. IDENTIFIED_CRO_ISSUES: Array of CRO friction points (vague headline, weak CTA, missing urgency, poor message match potential, etc.)
9. COLOR_PALETTE: Primary and accent colors detected (string summary)
10. CONVERSION_GOAL: What action the page is trying to drive

Use arrays where specified. Strings otherwise.`;
