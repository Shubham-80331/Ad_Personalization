import type { z } from "zod";
import { extractJsonObject } from "@/lib/json-parse";
import { truncateHtmlForModel } from "@/lib/html-truncate";
import { AD_ANALYSIS_SYSTEM, AD_ANALYSIS_USER } from "@/lib/prompts/ad-analysis";
import {
  PAGE_ANALYSIS_SYSTEM,
  PAGE_ANALYSIS_USER,
} from "@/lib/prompts/page-analysis";
import { GAP_ANALYSIS_SYSTEM, buildGapAnalysisUser } from "@/lib/prompts/gap-analysis";
import { TRANSFORM_SYSTEM, buildTransformUser } from "@/lib/prompts/transform";
import { scrapeLandingPage, type ScrapeResult } from "@/lib/scrape-landing-page";
import {
  adAnalysisSchema,
  gapAnalysisSchema,
  pageAnalysisSchema,
  transformResultSchema,
  type TransformResult,
} from "@/lib/pipeline/schemas";
import { generateGeminiText, getGeminiConfig } from "@/lib/llm/gemini";

export type PipelineStageId =
  | "ad_analysis"
  | "page_scrape"
  | "page_analysis"
  | "gap_analysis"
  | "transform";

export type PipelineCallbacks = {
  onStage: (stage: PipelineStageId, detail?: string) => void | Promise<void>;
};

export type OptimizeInput = {
  landingUrl: string;
  /** Raw image bytes */
  adImage: { base64: string; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" };
  /** Optional user hints merged into ad analysis context */
  hints?: {
    adHeadline?: string;
    adCta?: string;
    audience?: string;
    conversionGoal?: string;
    painPoint?: string;
  };
  /** Skip scrape and use this HTML */
  manualHtml?: string;
};

export type OptimizeOutput = {
  adAnalysis: Record<string, unknown>;
  pageAnalysis: Record<string, unknown>;
  gapAnalysis: Record<string, unknown>;
  transform: TransformResult;
  scrapeMeta?: {
    finalUrl?: string;
    paletteHints?: string[];
    fontStackHint?: string;
  };
  originalHtml: string;
  htmlForModelNote?: string;
};

type LlmCtx = { apiKey: string; model: string };

function parseJsonSafe<T>(
  raw: string,
  schema: z.ZodType<T>,
  label: string,
): T {
  const jsonText = extractJsonObject(raw);
  const parsed: unknown = JSON.parse(jsonText);
  const r = schema.safeParse(parsed);
  if (!r.success) {
    throw new Error(`${label} schema validation failed: ${r.error.message}`);
  }
  return r.data;
}

async function callGeminiJson(
  ctx: LlmCtx,
  params: {
    system: string;
    userText: string;
    images?: OptimizeInput["adImage"][];
    maxOutputTokens?: number;
    jsonMode?: boolean;
  },
): Promise<string> {
  return generateGeminiText(ctx.apiKey, ctx.model, {
    system: params.system,
    userText: params.userText,
    images: params.images,
    maxOutputTokens: params.maxOutputTokens,
    jsonMode: params.jsonMode ?? true,
  });
}

async function repairJson(ctx: LlmCtx, broken: string, context: string): Promise<string> {
  const user = `The following text was supposed to be a single valid JSON object but is invalid or truncated.
Return ONLY a valid JSON object fixing the issue. No markdown fences.

CONTEXT: ${context}

BROKEN:
${broken.slice(0, 24_000)}`;

  return generateGeminiText(ctx.apiKey, ctx.model, {
    system: "You output only valid JSON.",
    userText: user,
    maxOutputTokens: 8192,
    jsonMode: true,
  });
}

async function parseWithRepair<T>(params: {
  ctx: LlmCtx;
  raw: string;
  schema: z.ZodType<T>;
  label: string;
  repairContext: string;
}): Promise<T> {
  try {
    return parseJsonSafe(params.raw, params.schema, params.label);
  } catch {
    const fixed = await repairJson(
      params.ctx,
      params.raw,
      params.repairContext,
    );
    return parseJsonSafe(fixed, params.schema, params.label);
  }
}

export async function runOptimizePipeline(
  input: OptimizeInput,
  callbacks: PipelineCallbacks,
): Promise<OptimizeOutput> {
  const ctx: LlmCtx = getGeminiConfig();

  await callbacks.onStage("ad_analysis");
  const adRaw = await callGeminiJson(ctx, {
    system: AD_ANALYSIS_SYSTEM,
    userText: `${AD_ANALYSIS_USER}\n\nOptional marketer-provided hints (may be empty):\n${JSON.stringify(input.hints ?? {}, null, 2)}`,
    images: [input.adImage],
    maxOutputTokens: 2048,
    jsonMode: true,
  });
  const adAnalysis = parseWithRepair({
    ctx,
    raw: adRaw,
    schema: adAnalysisSchema,
    label: "ad_analysis",
    repairContext: "Ad creative analysis JSON with keys PRIMARY_MESSAGE, HEADLINE_HOOK, etc.",
  }) as Record<string, unknown>;

  let html: string;
  let pageScreenshot:
    | { base64: string; mediaType: "image/png" }
    | undefined;
  let scrapeMeta: OptimizeOutput["scrapeMeta"];

  if (input.manualHtml?.trim()) {
    await callbacks.onStage("page_scrape", "manual_html");
    html = input.manualHtml;
    pageScreenshot = undefined;
    scrapeMeta = { finalUrl: input.landingUrl };
  } else {
    await callbacks.onStage("page_scrape");
    const scraped: ScrapeResult = await scrapeLandingPage(input.landingUrl, {
      timeoutMs: 45_000,
    });
    if (!scraped.ok) {
      throw new Error(
        `Scrape failed (${scraped.code}): ${scraped.message}. Try pasting HTML manually.`,
      );
    }
    html = scraped.html;
    pageScreenshot = {
      base64: scraped.screenshotPngBase64,
      mediaType: "image/png",
    };
    scrapeMeta = {
      finalUrl: scraped.finalUrl,
      paletteHints: scraped.paletteHints,
      fontStackHint: scraped.fontStackHint,
    };
  }

  const htmlForPageAnalysis = truncateHtmlForModel(html, 80_000);
  const htmlForTransform = truncateHtmlForModel(html, 120_000);

  await callbacks.onStage("page_analysis");
  const pageUser = `${PAGE_ANALYSIS_USER}

Visual hints from scraper (may be empty): palette ${JSON.stringify(scrapeMeta?.paletteHints ?? [])}, font: ${scrapeMeta?.fontStackHint ?? "unknown"}

HTML:
${htmlForPageAnalysis}`;

  const pageRaw = await callGeminiJson(ctx, {
    system: PAGE_ANALYSIS_SYSTEM,
    userText: pageUser,
    images: pageScreenshot ? [pageScreenshot] : undefined,
    maxOutputTokens: 4096,
    jsonMode: true,
  });

  const pageAnalysis = parseWithRepair({
    ctx,
    raw: pageRaw,
    schema: pageAnalysisSchema,
    label: "page_analysis",
    repairContext: "Landing page analysis JSON with CURRENT_HEADLINE, SECTIONS array, etc.",
  }) as Record<string, unknown>;

  await callbacks.onStage("gap_analysis");
  const gapUser = buildGapAnalysisUser(adAnalysis, pageAnalysis);
  const gapRaw = await callGeminiJson(ctx, {
    system: GAP_ANALYSIS_SYSTEM,
    userText: gapUser,
    maxOutputTokens: 4096,
    jsonMode: true,
  });
  const gapAnalysis = parseWithRepair({
    ctx,
    raw: gapRaw,
    schema: gapAnalysisSchema,
    label: "gap_analysis",
    repairContext: "Message match scores and recommendations JSON",
  }) as Record<string, unknown>;

  await callbacks.onStage("transform");
  const transformUser = buildTransformUser({
    adAnalysis,
    gapAnalysis,
    htmlForModel: htmlForTransform,
  });
  const transformRaw = await callGeminiJson(ctx, {
    system: TRANSFORM_SYSTEM,
    userText: transformUser,
    maxOutputTokens: 16_384,
    jsonMode: true,
  });

  const transform = await parseWithRepair({
    ctx,
    raw: transformRaw,
    schema: transformResultSchema,
    label: "transform",
    repairContext:
      "Object with modified_html string, changes_made array, cro_score_before/after, message_match scores",
  });

  return {
    adAnalysis,
    pageAnalysis,
    gapAnalysis,
    transform,
    scrapeMeta,
    originalHtml: html,
    htmlForModelNote:
      htmlForTransform.length < html.length
        ? "HTML was truncated for the model; export uses full modified output from the model for the truncated portion."
        : undefined,
  };
}
