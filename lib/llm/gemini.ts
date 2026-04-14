import {
  GoogleGenerativeAI,
  type GenerativeModel,
  type Part,
} from "@google/generative-ai";

export type GeminiImagePart = {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
};

export type GeminiCallParams = {
  system: string;
  userText: string;
  images?: GeminiImagePart[];
  maxOutputTokens?: number;
  /** Prefer JSON-only responses when the model supports it (Gemini 1.5+ / 2.x). */
  jsonMode?: boolean;
};

function buildModel(apiKey: string, model: string, system: string): GenerativeModel {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model,
    systemInstruction: system,
  });
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns true if the error is a 429 / quota-exceeded from Google's API.
 */
function isRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const msg = String((err as { message?: string }).message ?? "");
  return (
    msg.includes("429") ||
    msg.toLowerCase().includes("quota") ||
    msg.toLowerCase().includes("too many requests") ||
    msg.toLowerCase().includes("rate limit")
  );
}

export async function generateGeminiText(
  apiKey: string,
  model: string,
  params: GeminiCallParams,
): Promise<string> {
  const m = buildModel(apiKey, model, params.system);
  const parts: Part[] = [];
  if (params.images?.length) {
    for (const img of params.images) {
      parts.push({
        inlineData: { mimeType: img.mediaType, data: img.base64 },
      });
    }
  }
  parts.push({ text: params.userText });

  // Retry up to 5 times with exponential back-off for free-tier rate limits.
  const MAX_RETRIES = 5;
  const BASE_DELAY_MS = 30_000; // 30 s — free tier resets per minute

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await m.generateContent({
        contents: [{ role: "user", parts }],
        generationConfig: {
          maxOutputTokens: params.maxOutputTokens ?? 8192,
          temperature: 0.35,
          ...(params.jsonMode ? { responseMimeType: "application/json" as const } : {}),
        },
      });

      const text = result.response.text();
      if (!text?.trim()) {
        throw new Error("Gemini returned an empty response (possible safety block).");
      }
      return text;
    } catch (err: unknown) {
      lastError = err;
      if (isRateLimitError(err) && attempt < MAX_RETRIES - 1) {
        // Extract retryDelay from the error message if present (e.g. "retryDelay":"21s")
        let waitMs = BASE_DELAY_MS * Math.pow(2, attempt); // exponential back-off
        const retryMatch = String((err as { message?: string }).message ?? "").match(
          /"retryDelay":"(\d+)s"/
        );
        if (retryMatch) {
          waitMs = Math.max(waitMs, parseInt(retryMatch[1], 10) * 1000 + 2000);
        }
        console.warn(
          `[Gemini] Rate limit hit (attempt ${attempt + 1}/${MAX_RETRIES}). Waiting ${Math.round(waitMs / 1000)}s before retry…`
        );
        await sleep(waitMs);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export function getGeminiConfig(): { apiKey: string; model: string } {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Create a free API key at https://aistudio.google.com/apikey",
    );
  }
  const model =
    process.env.GEMINI_MODEL?.trim() || "gemini-1.5-flash";
  return { apiKey, model };
}
