---
inclusion: fileMatch
fileMatchPattern: 'frontend/**'
---

# Design Taste (from Leonxlnx/taste-skill)

Anti-slop frontend rules applied to the InvestMate AI UI. Condensed from the
`design-taste-frontend` skill. These are hard rules for anything under
`frontend/`.

## Design read for this project
Fintech research dashboard for Indian retail investors. Trustworthy, calm,
data-dense but readable. Not a flashy marketing landing page. Dark navy theme.

## Typography
- Do NOT default to Inter. Use **Geist** (sans) + **Geist Mono** (numbers,
  tickers, prices). Control hierarchy with weight + color, not giant scale.
- Numbers and tickers render in the mono face so columns align.

## Color (locked)
- One accent only: electric blue (`accent`), saturation kept moderate. No AI
  purple glow, no neon outer glows, no gradient-text headers.
- Neutrals: navy/slate family, consistent warm/cool temperature across the app.
- Market up/down: restrained green (`up`) / red (`down`), used only for actual
  market movement, never as decoration.
- No pure black. `navy-950` is the off-black base.

## Banned "AI tells" (hard bans)
- **Em-dash (— or –) is COMPLETELY banned** in all user-facing text:
  headings, labels, buttons, body, captions, alt text, placeholders. Use a
  regular hyphen `-`, a comma, a period, parentheses, or a colon. En-dash in
  ranges also banned; use a hyphen (`2018-2026`, `1W-5Y`).
- No fake-perfect numbers (`99.99%`, `50%`). Our data is organically seeded, so
  keep it that way; never round sample figures to look clean.
- No generic placeholder names/brands ("John Doe", "Acme"). Use real NSE
  tickers and company names from the catalog.
- No decorative colored status dots. The sample/live badge dot is allowed
  because it conveys real semantic state (demonstration vs live data).
- No version labels, section-number eyebrows, scroll cues, locale/weather
  strips, or fake product screenshots built from divs.
- No 3-column equal "feature cards" marketing row. Data card grids are fine.
- No custom cursors, no hand-rolled decorative SVG icons.

## States (mandatory)
- Every data surface has: loading skeleton, empty state, error state with a
  retry control.
- Respect `prefers-reduced-motion`.
- Sample data is always visibly labelled; freshness/timestamp always shown.

## Pre-flight before shipping a component
1. Scan for any em-dash or en-dash in visible strings. Zero allowed.
2. One accent color used consistently.
3. Loading + empty + error states present.
4. Keyboard focus visible; interactive elements have accessible labels.
5. Numbers in mono; movement colors only on real movement.
