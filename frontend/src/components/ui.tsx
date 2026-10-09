import type { ReactNode } from "react";
import { timeAgo } from "../format";

export function SampleBadge({ isSample, source }: { isSample: boolean; source?: string }) {
  if (isSample) {
    return (
      <span className="badge-sample" title="Illustrative data generated locally, not live NSE data.">
        ● Demonstration data
      </span>
    );
  }
  return (
    <span className="badge-live" title={source}>
      ● Live {source?.replace("nse-mcp:", "NSE ")}
    </span>
  );
}

export function FreshnessChip({ asOf, source, isSample }: { asOf?: string; source?: string; isSample?: boolean }) {
  if (!asOf) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <SampleBadge isSample={!!isSample} source={source} />
      <span>as of {timeAgo(asOf)}</span>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      <div className="text-slate-300 font-medium">{title}</div>
      {hint && <div className="text-sm text-slate-500 mt-1 max-w-sm">{hint}</div>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-4 gap-3">
      <div className="text-down font-medium">{message}</div>
      {onRetry && (
        <button className="btn-ghost" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}
