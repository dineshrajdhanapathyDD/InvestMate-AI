import { api } from "../api";
import { useAsync } from "../useAsync";
import { useApp } from "../store";
import type { IntegrationStatus } from "../types";
import { ErrorState, Section, Skeleton } from "../components/ui";

export function Settings() {
  const { beginnerMode, setBeginnerMode } = useApp();
  const health = useAsync(() => api.health(), []);
  const nse = useAsync<IntegrationStatus>(() => api.integrations(), []);

  return (
    <div className="space-y-4">
      <Section title="Preferences">
        <label className="flex items-center justify-between gap-4 py-2">
          <span>
            <span className="block text-sm text-slate-200">Explain it like I'm new to investing</span>
            <span className="block text-xs text-slate-500">
              Structures answers into what the data shows, what it might mean, and what to research next.
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={beginnerMode}
            aria-label="Toggle Beginner Mode"
            onClick={() => setBeginnerMode(!beginnerMode)}
            className={`relative h-6 w-11 rounded-full transition-colors ${beginnerMode ? "bg-accent" : "bg-navy-600"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${beginnerMode ? "translate-x-5" : "translate-x-0.5"}`}
            />
          </button>
        </label>
      </Section>

      <Section title="Application health">
        {health.loading ? (
          <Skeleton className="h-16" />
        ) : health.error ? (
          <ErrorState message={health.error} onRetry={health.reload} />
        ) : (
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Field label="Status" value="Online" tone="up" />
            <Field label="Model" value={(health.data as any)?.model} mono />
            <Field label="Region" value={(health.data as any)?.region} mono />
            <Field label="Service" value="investmate-ai" mono />
          </dl>
        )}
      </Section>

      <Section title="NSE MCP connection health">
        {nse.loading ? (
          <Skeleton className="h-28" />
        ) : nse.error ? (
          <ErrorState message={nse.error} onRetry={nse.reload} />
        ) : nse.data ? (
          <NseHealth status={nse.data} />
        ) : null}
      </Section>
    </div>
  );
}

function NseHealth({ status }: { status: IntegrationStatus }) {
  const live = status.mode === "live";
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className={live ? "badge-live" : "badge-sample"}>
          {live ? "Live NSE data" : "Demonstration data (fallback)"}
        </span>
        <span className="text-xs text-slate-500">transport: {status.transport}</span>
        <span className="text-xs text-slate-500">mode: {status.mode}</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        {Object.entries(status.endpoints).map(([name, host]) => (
          <div key={name} className="bg-navy-800 rounded-lg p-3">
            <div className="text-xs text-slate-400">{name}</div>
            <div className="text-sm tnum text-slate-200">{host}</div>
          </div>
        ))}
      </div>

      <div className="bg-navy-800 rounded-lg p-3 text-xs text-slate-400 leading-relaxed">
        <div className="text-slate-300 font-medium mb-1">Why demonstration data?</div>
        The official NSE MCP servers are protected by Akamai bot management and respond only to
        interactive browser clients (Claude Desktop, Claude.ai, ChatGPT) that solve a JavaScript
        challenge. A headless backend receives a 504 timeout. InvestMate speaks the real MCP
        streamable-http protocol, so pointing the endpoints at a browser-session proxy switches it
        to live data with no code change. Until then, clearly labelled demonstration data is used.
      </div>

      <details className="text-xs text-slate-500">
        <summary className="cursor-pointer text-slate-400">Raw probe (sanitized)</summary>
        <pre className="mt-2 overflow-x-auto bg-navy-950 rounded-lg p-3 tnum">
          {JSON.stringify(status.probe, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function Field({ label, value, mono, tone }: { label: string; value?: string; mono?: boolean; tone?: string }) {
  return (
    <div className="bg-navy-800 rounded-lg p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`${mono ? "tnum" : ""} ${tone === "up" ? "text-up" : "text-slate-200"} text-sm`}>
        {value || "n/a"}
      </dd>
    </div>
  );
}
