import { describe, expect, it } from "vitest";
import { inr, num, pct, moveClass } from "./format";

describe("format helpers", () => {
  it("renders n/a (not an em-dash) for null values", () => {
    expect(inr(null)).toBe("n/a");
    expect(num(undefined)).toBe("n/a");
    expect(pct(null)).toBe("n/a");
    // Design rule: no em-dash or en-dash anywhere user-facing.
    expect(inr(null)).not.toContain("\u2014");
    expect(inr(null)).not.toContain("\u2013");
  });

  it("formats percentages with explicit sign", () => {
    expect(pct(12.3)).toBe("+12.30%");
    expect(pct(-4)).toBe("-4.00%");
    expect(pct(0)).toBe("0.00%");
  });

  it("maps movement direction to color classes", () => {
    expect(moveClass(5)).toBe("text-up");
    expect(moveClass(-5)).toBe("text-down");
    expect(moveClass(0)).toBe("text-slate-400");
  });
});
