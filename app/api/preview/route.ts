import { NextResponse } from "next/server";
import { scrapeLandingPage } from "@/lib/scrape-landing-page";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  const scraped = await scrapeLandingPage(url, { timeoutMs: 25_000 });
  if (!scraped.ok) {
    return NextResponse.json(
      { error: scraped.message, code: scraped.code },
      { status: 422 },
    );
  }

  return NextResponse.json({
    imageBase64: scraped.screenshotPngBase64,
    contentType: "image/png",
    finalUrl: scraped.finalUrl,
  });
}
