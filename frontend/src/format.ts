const NA = "n/a";

export function inr(n: number | null | undefined): string {
  if (n == null) return NA;
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(n);
}

export function num(n: number | null | undefined): string {
  if (n == null) return NA;
  return new Intl.NumberFormat("en-IN").format(n);
}

export function pct(n: number | null | undefined): string {
  if (n == null) return NA;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function moveClass(n: number | null | undefined): string {
  if (n == null) return "text-slate-400";
  if (n > 0) return "text-up";
  if (n < 0) return "text-down";
  return "text-slate-400";
}

export function timeAgo(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}
