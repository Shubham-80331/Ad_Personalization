"use client";

import { cn } from "@/lib/utils";

type Props = {
  label: string;
  before: number;
  after: number;
  max?: number;
  className?: string;
};

export function ScoreGauge({
  label,
  before,
  after,
  max = 100,
  className,
}: Props) {
  const pct = (v: number) => Math.min(100, Math.max(0, (v / max) * 100));
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm text-slate-300">
        <span>{label}</span>
        <span className="font-mono text-amber-400">
          {Math.round(before)} → {Math.round(after)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="mb-1 text-xs text-slate-500">Before</div>
          <ProgressBar value={pct(before)} />
        </div>
        <div>
          <div className="mb-1 text-xs text-slate-500">After</div>
          <ProgressBar value={pct(after)} highlight />
        </div>
      </div>
    </div>
  );
}

function ProgressBar({
  value,
  highlight,
}: {
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-700 ease-out",
          highlight ? "bg-amber-500" : "bg-slate-600",
        )}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function MessageMatchGauge({
  before,
  after,
}: {
  before: number;
  after: number;
}) {
  return (
    <ScoreGauge
      label="Message match (1–10)"
      before={before}
      after={after}
      max={10}
    />
  );
}
