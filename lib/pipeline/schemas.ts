import { z } from "zod";

export const adAnalysisSchema = z
  .object({
    PRIMARY_MESSAGE: z.string().optional().default(""),
    HEADLINE_HOOK: z.string().optional().default(""),
    CTA_TEXT: z.string().optional().default(""),
    VISUAL_TONE: z.string().optional().default(""),
    TARGET_AUDIENCE_SIGNALS: z.string().optional().default(""),
    VALUE_PROPOSITION: z.string().optional().default(""),
    PAIN_POINT_ADDRESSED: z.string().optional().default(""),
    URGENCY_SCARCITY: z.string().optional().default(""),
    TRUST_SIGNALS: z.string().optional().default(""),
    EMOTIONAL_TRIGGER: z.string().optional().default(""),
  })
  .passthrough();

export type AdAnalysis = z.infer<typeof adAnalysisSchema>;

export const pageAnalysisSchema = z
  .object({
    CURRENT_HEADLINE: z.string().optional().default(""),
    CURRENT_SUBHEADLINE: z.string().optional().default(""),
    CURRENT_CTA_TEXT: z.string().optional().default(""),
    SECTIONS: z.array(z.string()).optional().default([]),
    CURRENT_VALUE_PROPS: z.array(z.string()).optional().default([]),
    TRUST_SIGNALS: z.array(z.string()).optional().default([]),
    PAGE_TONE: z.string().optional().default(""),
    IDENTIFIED_CRO_ISSUES: z.array(z.string()).optional().default([]),
    COLOR_PALETTE: z.string().optional().default(""),
    CONVERSION_GOAL: z.string().optional().default(""),
  })
  .passthrough();

export type PageAnalysis = z.infer<typeof pageAnalysisSchema>;

export const gapAnalysisSchema = z
  .object({
    scores: z.record(z.string(), z.coerce.number()).optional().default({}),
    overall_message_match_before: z.number().min(1).max(10).optional(),
    recommendations: z
      .array(
        z.object({
          dimension: z.string(),
          score: z.number().optional(),
          recommendation: z.string(),
        }),
      )
      .optional()
      .default([]),
  })
  .passthrough();

export type GapAnalysis = z.infer<typeof gapAnalysisSchema>;

const changeTag = z.enum([
  "message_match",
  "cro",
  "urgency",
  "trust",
  "friction",
]);

export const transformResultSchema = z.object({
  modified_html: z.string(),
  changes_made: z.array(
    z.object({
      section: z.string(),
      original: z.string(),
      modified: z.string(),
      reason: z.string(),
      tag: changeTag.optional().default("cro"),
    }),
  ),
  cro_score_before: z.coerce.number(),
  cro_score_after: z.coerce.number(),
  message_match_score_before: z.coerce.number(),
  message_match_score_after: z.coerce.number(),
});

export type TransformResult = z.infer<typeof transformResultSchema>;
