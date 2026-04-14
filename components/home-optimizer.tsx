"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { MessageMatchGauge, ScoreGauge } from "@/components/score-gauge";
import { ChevronDown, Loader2 } from "lucide-react";
import type { TransformResult } from "@/lib/pipeline/schemas";

type StageId =
  | "ad_analysis"
  | "page_scrape"
  | "page_analysis"
  | "gap_analysis"
  | "transform";

const STAGE_LABEL: Record<StageId, string> = {
  ad_analysis: "Analyzing ad creative…",
  page_scrape: "Scraping landing page…",
  page_analysis: "Analyzing page structure…",
  gap_analysis: "Scoring message match…",
  transform: "Generating optimized HTML…",
};

type NdjsonLine =
  | { type: "stage"; stage: StageId; detail: string | null }
  | {
      type: "result";
      payload: {
        transform: TransformResult;
        originalHtml: string;
        adAnalysis: Record<string, unknown>;
        pageAnalysis: Record<string, unknown>;
        gapAnalysis: Record<string, unknown>;
        scrapeMeta?: Record<string, unknown>;
        htmlForModelNote?: string;
      };
    }
  | { type: "error"; message: string };

function badgeForTag(tag?: string) {
  switch (tag) {
    case "message_match":
      return <Badge variant="messageMatch">Message match</Badge>;
    case "urgency":
      return <Badge variant="urgency">Urgency</Badge>;
    case "trust":
      return <Badge variant="trust">Trust</Badge>;
    case "friction":
      return <Badge variant="friction">Friction reduction</Badge>;
    default:
      return <Badge variant="cro">CRO</Badge>;
  }
}

function buildMarkdownReport(t: TransformResult): string {
  const lines: string[] = [
    "# Optimization report",
    "",
    `**CRO score:** ${t.cro_score_before} → ${t.cro_score_after}`,
    `**Message match:** ${t.message_match_score_before} → ${t.message_match_score_after}`,
    "",
    "## Changes",
    "",
  ];
  for (const c of t.changes_made) {
    lines.push(`### ${c.section}`);
    lines.push(`- **Original:** ${c.original}`);
    lines.push(`- **Modified:** ${c.modified}`);
    lines.push(`- **Reason:** ${c.reason}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function HomeOptimizer() {
  const [landingUrl, setLandingUrl] = useState("");
  const [adImageUrl, setAdImageUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewShot, setPreviewShot] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [fetchingPreview, setFetchingPreview] = useState(false);

  const [adHeadline, setAdHeadline] = useState("");
  const [adCta, setAdCta] = useState("");
  const [audience, setAudience] = useState("");
  const [conversionGoal, setConversionGoal] = useState("");
  const [painPoint, setPainPoint] = useState("");
  const [useManualHtml, setUseManualHtml] = useState(false);
  const [manualHtml, setManualHtml] = useState("");

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<NdjsonLine & { type: "result" } | null>(
    null,
  );
  const [previewTab, setPreviewTab] = useState<"original" | "optimized">(
    "optimized",
  );

  const canSubmit = useMemo(() => {
    const hasAd = Boolean(file) || adImageUrl.trim().length > 0;
    const hasUrl = landingUrl.trim().length > 0;
    if (useManualHtml) {
      return hasAd && hasUrl && manualHtml.trim().length > 0;
    }
    return hasAd && hasUrl;
  }, [file, adImageUrl, landingUrl, useManualHtml, manualHtml]);

  const fetchPreview = useCallback(async () => {
    setPreviewError(null);
    setPreviewShot(null);
    if (!landingUrl.trim()) {
      setPreviewError("Enter a landing page URL first.");
      return;
    }
    setFetchingPreview(true);
    try {
      const u = new URL(
        `/api/preview?url=${encodeURIComponent(landingUrl.trim())}`,
        window.location.origin,
      );
      const res = await fetch(u.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      setPreviewShot(
        `data:${data.contentType || "image/png"};base64,${data.imageBase64}`,
      );
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setFetchingPreview(false);
    }
  }, [landingUrl]);

  const runOptimize = async () => {
    setError(null);
    setResult(null);
    setLoading(true);
    setProgress(0);
    setStageLabel("Starting…");

    const form = new FormData();
    form.set("landingUrl", landingUrl.trim());
    if (file) form.set("adImage", file);
    if (adImageUrl.trim()) form.set("adImageUrl", adImageUrl.trim());
    if (adHeadline.trim()) form.set("adHeadline", adHeadline.trim());
    if (adCta.trim()) form.set("adCta", adCta.trim());
    if (audience.trim()) form.set("audience", audience.trim());
    if (conversionGoal.trim()) form.set("conversionGoal", conversionGoal.trim());
    if (painPoint.trim()) form.set("painPoint", painPoint.trim());
    form.set("useManualHtml", useManualHtml ? "true" : "false");
    if (useManualHtml) form.set("manualHtml", manualHtml);

    try {
      const res = await fetch("/api/optimize", { method: "POST", body: form });
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n");
        buffer = parts.pop() ?? "";
        for (const line of parts) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line) as NdjsonLine;
          if (msg.type === "stage") {
            setStageLabel(STAGE_LABEL[msg.stage] ?? msg.stage);
            setProgress((p) => Math.min(92, p + 17));
          }
          if (msg.type === "error") {
            throw new Error(msg.message);
          }
          if (msg.type === "result") {
            setResult(msg);
            setProgress(100);
            setStageLabel("Done");
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Optimization failed");
    } finally {
      setLoading(false);
    }
  };

  const copyHtml = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.payload.transform.modified_html);
  };

  const downloadHtml = () => {
    if (!result) return;
    const blob = new Blob([result.payload.transform.modified_html], {
      type: "text/html",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "optimized-landing.html";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const openTab = () => {
    if (!result) return;
    const blob = new Blob([result.payload.transform.modified_html], {
      type: "text/html",
    });
    window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
  };

  const copyMarkdown = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(
      buildMarkdownReport(result.payload.transform),
    );
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-10 space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-amber-400">
          Message match + CRO
        </p>
        <h1 className="text-3xl font-semibold text-white md:text-4xl">
          AI Ad Creative → Personalized Landing Page Optimizer
        </h1>
        <p className="max-w-3xl text-slate-400">
          Upload your ad, paste your landing URL, and get a surgically modified
          HTML version aligned to the ad plus CRO improvements. Each full run
          uses about four Gemini API calls — set{" "}
          <code className="font-mono text-amber-200/90">GEMINI_API_KEY</code>{" "}
          locally (free key from Google AI Studio).
        </p>
      </header>

      {!result && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-slate-800 bg-white">
            <CardHeader>
              <CardTitle className="text-slate-900">Panel A — Ad creative</CardTitle>
              <CardDescription className="text-slate-600">
                PNG, JPG, WEBP, or GIF. Or paste a public image URL.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ad-file">Upload</Label>
                <Input
                  id="ad-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ad-url">Image URL (optional)</Label>
                <Input
                  id="ad-url"
                  placeholder="https://cdn.example.com/ad.png"
                  value={adImageUrl}
                  onChange={(e) => setAdImageUrl(e.target.value)}
                />
              </div>
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-800">
                  <ChevronDown className="size-4" />
                  Advanced options
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="h">Ad headline (optional)</Label>
                    <Input
                      id="h"
                      value={adHeadline}
                      onChange={(e) => setAdHeadline(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cta">Ad CTA text (optional)</Label>
                    <Input
                      id="cta"
                      value={adCta}
                      onChange={(e) => setAdCta(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="aud">Target audience (optional)</Label>
                    <Input
                      id="aud"
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-white">
            <CardHeader>
              <CardTitle className="text-slate-900">
                Panel B — Landing page
              </CardTitle>
              <CardDescription className="text-slate-600">
                We scrape server-side with Playwright. SPAs or bot-blocking sites
                may fail — use manual HTML in that case.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lp">Landing page URL</Label>
                <Input
                  id="lp"
                  placeholder="https://www.example.com/landing"
                  value={landingUrl}
                  onChange={(e) => setLandingUrl(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={fetchPreview}
                  disabled={fetchingPreview}
                >
                  {fetchingPreview && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  Fetch preview
                </Button>
                {previewError && (
                  <span className="text-sm text-red-600">{previewError}</span>
                )}
              </div>
              {previewShot && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewShot}
                  alt="Page screenshot"
                  className="max-h-64 w-full rounded-md border object-contain object-top"
                />
              )}
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-800">
                  <ChevronDown className="size-4" />
                  Advanced options
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="goal">Primary conversion goal</Label>
                    <Input
                      id="goal"
                      placeholder="Purchase / Sign up / Book demo…"
                      value={conversionGoal}
                      onChange={(e) => setConversionGoal(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pain">Main pain / value prop (optional)</Label>
                    <Textarea
                      id="pain"
                      rows={3}
                      value={painPoint}
                      onChange={(e) => setPainPoint(e.target.value)}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="flex items-center justify-between rounded-lg border border-amber-200/60 bg-amber-50 p-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    Paste HTML instead of scraping
                  </div>
                  <div className="text-xs text-slate-600">
                    For auth-only or heavily dynamic pages.
                  </div>
                </div>
                <Switch
                  checked={useManualHtml}
                  onCheckedChange={setUseManualHtml}
                />
              </div>
              {useManualHtml && (
                <div className="space-y-2">
                  <Label htmlFor="mh">Page HTML</Label>
                  <Textarea
                    id="mh"
                    rows={8}
                    className="font-mono text-xs"
                    value={manualHtml}
                    onChange={(e) => setManualHtml(e.target.value)}
                    placeholder="<!DOCTYPE html>..."
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!result && (
        <div className="mt-8 flex flex-col items-start gap-4">
          <Button
            size="lg"
            disabled={!canSubmit || loading}
            onClick={runOptimize}
            className="bg-amber-500 text-slate-900 hover:bg-amber-400"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Optimize my landing page →
          </Button>
          {loading && (
            <div className="w-full max-w-xl space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>{stageLabel}</span>
                <span className="font-mono text-xs text-slate-500">
                  ~4 Gemini calls
                </span>
              </div>
              <Progress value={progress} />
            </div>
          )}
          {error && (
            <p className="rounded-md border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          )}
        </div>
      )}

      {result && (
        <div className="mt-8 space-y-6">
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setResult(null)}>
              New run
            </Button>
            <Button onClick={downloadHtml}>Download HTML</Button>
            <Button variant="outline" onClick={copyHtml}>
              Copy HTML
            </Button>
            <Button variant="outline" onClick={openTab}>
              Open in new tab
            </Button>
            <Button variant="ghost" onClick={copyMarkdown}>
              Copy changes report (Markdown)
            </Button>
          </div>

          {result.payload.htmlForModelNote && (
            <p className="text-sm text-amber-200/90">{result.payload.htmlForModelNote}</p>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-slate-800 bg-slate-900/40">
              <CardHeader>
                <CardTitle className="text-white">Before / after</CardTitle>
                <CardDescription className="text-slate-400">
                  Toggle previews (external assets may not load in{" "}
                  <code className="font-mono">srcdoc</code>).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs
                  value={previewTab}
                  onValueChange={(v) =>
                    setPreviewTab(v as "original" | "optimized")
                  }
                >
                  <TabsList>
                    <TabsTrigger value="original">Original</TabsTrigger>
                    <TabsTrigger value="optimized">Optimized</TabsTrigger>
                  </TabsList>
                  <TabsContent value="original" className="mt-3">
                    <iframe
                      title="Original"
                      className="h-[520px] w-full rounded-md border border-amber-500/30 bg-white"
                      srcDoc={result.payload.originalHtml}
                      sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                    />
                  </TabsContent>
                  <TabsContent value="optimized" className="mt-3">
                    <iframe
                      title="Optimized"
                      className="h-[520px] w-full rounded-md border border-amber-500/30 bg-white"
                      srcDoc={result.payload.transform.modified_html}
                      sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/40">
              <CardHeader>
                <CardTitle className="text-white">Changes report</CardTitle>
                <CardDescription className="text-slate-400">
                  Scores and per-change reasoning.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ScoreGauge
                  label="CRO score (0–100)"
                  before={result.payload.transform.cro_score_before}
                  after={result.payload.transform.cro_score_after}
                  max={100}
                />
                <MessageMatchGauge
                  before={result.payload.transform.message_match_score_before}
                  after={result.payload.transform.message_match_score_after}
                />

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-white">Changes</h3>
                  <ul className="space-y-3">
                    {result.payload.transform.changes_made.map((c, i) => (
                      <li
                        key={i}
                        className="rounded-lg border border-slate-700/80 bg-slate-950/40 p-3 text-sm text-slate-200"
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="font-medium text-white">
                            {c.section}
                          </span>
                          {badgeForTag(c.tag)}
                        </div>
                        <div className="space-y-1 text-xs">
                          <div>
                            <span className="text-amber-200/90">Original: </span>
                            <span className="font-mono text-slate-300">
                              {c.original}
                            </span>
                          </div>
                          <div>
                            <span className="text-emerald-300/90">Modified: </span>
                            <span className="font-mono text-slate-300">
                              {c.modified}
                            </span>
                          </div>
                          <p className="text-slate-400">{c.reason}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </main>
  );
}
