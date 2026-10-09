import { useRef, useState } from "react";
import { api, ApiError } from "../api";
import { useApp } from "../store";
import type { ResearchResult } from "../types";
import { timeAgo } from "../format";

interface ChatTurn {
  id: number;
  question: string;
  symbol?: string;
  period?: string;
  status: "pending" | "done" | "error";
  result?: ResearchResult;
  error?: string;
}

const PERIODS = ["1W", "1M", "3M", "6M", "1Y", "5Y"];

export function Research() {
  const { beginnerMode } = useApp();
  const [question, setQuestion] = useState(
    "Explain what happened to RELIANCE and help me understand its historical performance."
  );
  const [symbol, setSymbol] = useState("RELIANCE");
  const [period, setPeriod] = useState("3M");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const idRef = useRef(1);

  async function ask(q: string, sym: string, per: string) {
    const id = idRef.current++;
    setTurns((t) => [...t, { id, question: q, symbol: sym, period: per, status: "pending" }]);
    setBusy(true);
    try {
      const { data } = await api.research({
        question: q,
        symbol: sym || undefined,
        period: per,
        beginnerMode,
      });
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, status: "done", result: data } : x)));
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : "Something went wrong. Your question is preserved, please retry.";
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, status: "error", error: msg } : x)));
      // Requirement: preserve the user's question after a recoverable failure.
      setQuestion(q);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || busy) return;
    ask(question.trim(), symbol.trim().toUpperCase(), period);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4 order-2 lg:order-1">
        {turns.length === 0 && (
          <div className="card text-sm text-slate-400 leading-relaxed">
            Ask about any NSE stock. Try "Explain what happened to INFY over the last month" or
            "How volatile has TCS been this year?". With Beginner Mode on, answers are split into
            <span className="text-slate-300"> what the data shows</span>,
            <span className="text-slate-300"> what it might mean</span>, and
            <span className="text-slate-300"> what to research next</span>.
          </div>
        )}
        {turns.map((turn) => (
          <TurnView key={turn.id} turn={turn} onRetry={() => ask(turn.question, turn.symbol || "", turn.period || "3M")} />
        ))}
      </div>

      <form
        onSubmit={onSubmit}
        className="card h-max lg:sticky lg:top-28 space-y-3 order-1 lg:order-2"
        aria-label="Ask a research question"
      >
        <div>
          <label htmlFor="q" className="block text-xs font-medium text-slate-400 mb-1">
            Your question
          </label>
          <textarea
            id="q"
            className="input min-h-[96px] resize-y"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={1000}
            placeholder="Ask about an NSE stock..."
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="sym" className="block text-xs font-medium text-slate-400 mb-1">
              Symbol (optional)
            </label>
            <input
              id="sym"
              className="input tnum uppercase"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="RELIANCE"
            />
          </div>
          <div>
            <label htmlFor="per" className="block text-xs font-medium text-slate-400 mb-1">
              Period
            </label>
            <select id="per" className="input" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" className="btn-primary w-full" disabled={busy || !question.trim()}>
          {busy ? "Researching..." : "Ask InvestMate"}
        </button>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Answers are grounded in retrieved market data. Educational use only, not investment advice.
        </p>
      </form>
    </div>
  );
}

function TurnView({ turn, onRetry }: { turn: ChatTurn; onRetry: () => void }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <div className="bg-navy-700 rounded-xl rounded-tr-sm px-3 py-2 text-sm max-w-[85%]">
          {turn.question}
          {turn.symbol && (
            <span className="ml-2 text-[11px] text-slate-400 tnum">
              {turn.symbol} / {turn.period}
            </span>
          )}
        </div>
      </div>

      {turn.status === "pending" && (
        <div className="card space-y-2" aria-live="polite">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-5/6" />
          <div className="skeleton h-3 w-2/3" />
          <div className="text-xs text-slate-500 pt-1">Selecting tools and retrieving data...</div>
        </div>
      )}

      {turn.status === "error" && (
        <div className="card border-down/40">
          <div className="text-down text-sm font-medium">{turn.error}</div>
          <div className="text-xs text-slate-500 mt-1">
            Your question is saved above. You can retry without retyping.
          </div>
          <button className="btn-ghost mt-3" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}

      {turn.status === "done" && turn.result && <AnswerCard result={turn.result} />}
    </div>
  );
}

function AnswerCard({ result }: { result: ResearchResult }) {
  return (
    <div className="card space-y-3">
      <AnswerBody text={result.answer} />

      <div className="border-t border-navy-700 pt-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400">Tools used:</span>
          {result.usedTools.length ? (
            result.usedTools.map((t, i) => (
              <span key={i} className="badge bg-navy-700 text-slate-300 tnum">
                {t}
              </span>
            ))
          ) : (
            <span className="text-slate-500">none</span>
          )}
        </div>
        <div className="space-y-1">
          {result.sources.map((s, i) => (
            <div key={i} className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
              <span className={s.isSample ? "badge-sample" : "badge-live"}>
                {s.isSample ? "Demonstration data" : `Live ${s.source}`}
              </span>
              <span>as of {timeAgo(s.asOf)}</span>
              {s.note && <span className="opacity-80">{s.note}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Renders Beginner Mode three-section markdown headings nicely, plain text otherwise.
function AnswerBody({ text }: { text: string }) {
  const blocks = text.split(/\n(?=\*\*)/g);
  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-200">
      {blocks.map((block, i) => {
        const m = block.match(/^\*\*(.+?)\*\*\s*([\s\S]*)$/);
        if (m) {
          return (
            <div key={i}>
              <div className="font-semibold text-accent-soft">{m[1]}</div>
              <div className="whitespace-pre-wrap">{cleanBody(m[2])}</div>
            </div>
          );
        }
        return (
          <div key={i} className="whitespace-pre-wrap">
            {cleanBody(block)}
          </div>
        );
      })}
    </div>
  );
}

function cleanBody(s: string): string {
  return s.replace(/\*\*/g, "").trim();
}
