import { runOptimizePipeline } from "@/lib/pipeline/run-pipeline";
import { loadRemoteImage } from "@/lib/load-remote-image";
import { sniffMediaTypeFromBytes } from "@/lib/sniff-image";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

type AdMedia = {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
};

function mimeToMediaType(mime: string): AdMedia["mediaType"] | null {
  const m = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (m === "image/jpg" || m === "image/jpeg") return "image/jpeg";
  if (m === "image/png") return "image/png";
  if (m === "image/gif") return "image/gif";
  if (m === "image/webp") return "image/webp";
  return null;
}

async function adImageFromForm(form: FormData): Promise<AdMedia> {
  const file = form.get("adImage");
  const url = (form.get("adImageUrl") as string | null)?.trim();

  if (file instanceof File && file.size > 0) {
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.byteLength > 12 * 1024 * 1024) {
      throw new Error("Ad image too large (max 12MB)");
    }
    const fromMime = mimeToMediaType(file.type || "");
    const sniffed = sniffMediaTypeFromBytes(new Uint8Array(buf));
    const mediaType = fromMime ?? sniffed;
    if (!mediaType) {
      throw new Error("Unsupported ad image type. Use PNG, JPG, WEBP, or GIF.");
    }
    return { base64: buf.toString("base64"), mediaType };
  }

  if (url) {
    return loadRemoteImage(url);
  }

  throw new Error("Provide an ad image file or image URL.");
}

export async function POST(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      };

      try {
        const form = await req.formData();

        const landingUrl = (form.get("landingUrl") as string)?.trim();
        if (!landingUrl) throw new Error("Landing page URL is required.");

        const useManual = form.get("useManualHtml") === "true";
        const manualHtml = (form.get("manualHtml") as string | null) ?? "";

        const adImage = await adImageFromForm(form);

        const hints = {
          adHeadline: (form.get("adHeadline") as string | null)?.trim() || undefined,
          adCta: (form.get("adCta") as string | null)?.trim() || undefined,
          audience: (form.get("audience") as string | null)?.trim() || undefined,
          conversionGoal:
            (form.get("conversionGoal") as string | null)?.trim() || undefined,
          painPoint: (form.get("painPoint") as string | null)?.trim() || undefined,
        };

        const result = await runOptimizePipeline(
          {
            landingUrl,
            adImage,
            hints,
            manualHtml: useManual ? manualHtml : undefined,
          },
          {
            onStage: async (stage, detail) => {
              send({ type: "stage", stage, detail: detail ?? null });
            },
          },
        );

        send({
          type: "result",
          payload: {
            adAnalysis: result.adAnalysis,
            pageAnalysis: result.pageAnalysis,
            gapAnalysis: result.gapAnalysis,
            transform: result.transform,
            scrapeMeta: result.scrapeMeta,
            originalHtml: result.originalHtml,
            htmlForModelNote: result.htmlForModelNote,
          },
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
