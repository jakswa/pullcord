# Rail UI Learnings — Design Shootout Retrospective

*Feb 21, 2026 — 10 candidates, one evening, zero winners (yet)*

---

## What We Tried

| ID | Concept | Fate |
|----|---------|------|
| A | Transit Sign | ❌ Generic, no personality |
| B | Modern Native | ❌ Too plain |
| C | Dense & Fast | ❌ Too plain |
| D | Pill-First | ⚡ Getting warmer, 2 iterations |
| E | Neon Lines | ✅ Frontrunner round 1 — glowing pills, dark bg |
| F | Departure Board | ❌ Sub-agent never wrote the file |
| G | Glass Morphism | 🐛 Map→Object bug, empty state |
| H | Tokyo Metro | 🔵 Clean geometry, grouped by line |
| I | Brutalist Data | 🔵 Raw/heavy, but unpolished (agent timed out) |
| J | Retro CRT | 🔵 Most iterated (v4), scanlines + phosphor + brutalism |

**Branch:** `rail-ui-shootout` (preserved, not merged)

---

## Design Truths (Earned the Hard Way)

### Pills are the design language
The chunky capsule pill (direction letter + time) IS the product. Everything else serves the pills. marta.io got this right — we just need to do it with more personality.

### Accessibility is non-negotiable, not an afterthought
- **Minimum 1.15rem** for station names on mobile. Monospace eats more space — account for it.
- **WCAG AA 4.5:1** on ALL color combinations, in BOTH light and dark mode.
- Light mode needs its own color palette — dark-mode-primary colors (especially green `#2ecc40`) are invisible on light backgrounds. Maintain a `LINE_COLOR_LIGHT` map.
- **Color blindness:** RED/GREEN distinction needs more than hue — use border style (solid vs dashed), luminance difference, or secondary indicators. The direction letter (N/S/E/W) already helps.
- **Never let animations clobber layout.** The `pulse` keyframes `transform: scale()` overrode `translateY(-50%)` on the timeline dots — caused the NOW circle to drop below its text. Animations and positioning transforms must compose, not compete.

### Fixed-width pills for vertical alignment
All pills must be the same width (96px landed well at big font sizes). This is the single most important layout rule — variable-width pills look sloppy and break visual scanning. `flex-shrink: 0` is mandatory.

### Multi-direction stations need a grid, not a wrap
Five Points (4 directions: N/S/E/W) needs a **2×2 CSS grid** for its pills, right-aligned to match 2-pill stations. Station name stays on the left, vertically centered. `flex-wrap` creates inconsistent left-aligned orphan pills — never use it for the pill container.

### Headers: one line or die
Every view (landing, station detail, train detail) should have a **single-line header**. Back button + title + badges + freshness indicator all on one row. Two-line headers waste prime viewport real estate on mobile. "$ marta --realtime" was cute for about 30 seconds.

### Monospace is expensive
Monospace fonts are ~40% wider than proportional fonts at the same size. On a 375px viewport, a 1.3rem monospace station name + two 96px pills barely fits. Either accept truncation for long names or use a proportional font for station names. The CRT theme demanded monospace everywhere — that's a hard constraint to design around.

---

## Technical Lessons

### API caching
- **20s TTL** (longer than 10s poll interval) ensures navigating between views always hits cache.
- **Stale-while-revalidate**: Serve expired cache instantly, refresh in background. First paint should NEVER wait for MARTA's slow API. Only the very first page load blocks.
- The MARTA rail API at `developerservices.itsmarta.com:18096` is notoriously slow (1-3s responses). Design around it.

### Partial rendering / live reload
- 10s polling replaces `#rail-body` innerHTML via `?partial=1`.
- **Partial MUST return ONLY inner content** — not headers, footers, or chrome. Every shootout candidate got this wrong initially. The header appears once in the shell; the partial returns just the data list.
- The freshness counter (`Xs ago`) lives in the header (outside `#rail-body`) and updates via its own `setInterval`, not the poll.

### Dev server doesn't hot-reload
Bun doesn't auto-reload on file changes. **Every code change requires killing and restarting the server.** This bit us repeatedly — edits appeared to "not work" because the old code was still running. Must-do: kill → sleep 1 → restart → verify 200.

### Sub-agent reliability
- ~50% of sub-agents fail to produce working output (timeouts, missing files, API errors).
- Model override is broken (OpenClaw #6295) — sub-agents always run on primary model regardless of config.
- Sub-agents can't send Telegram messages directly — they return results to the main agent.
- For iterative refinement, direct edits beat sub-agents. Sub-agents are best for "write a whole new thing from scratch."

### Screenshot pipeline
- Playwright at `/tmp/rail-screenshots/` — 375×700, 1x scale, dark mode default.
- Full-page screenshots needed for layout verification (viewport crops miss Five Points mid-page).
- Always take both dark and light mode shots before sending to Jake.

---

## What's Hot in 2026 (Design Trends)

**Neobrutalism** is indeed having a moment — NN/Group wrote a formal best-practices guide. The key tension: brutalism grabs attention but fights usability. The winning approach is **"keep the mess visual, not structural"** — bold type, raw aesthetics, heavy borders, BUT with familiar navigation and accessible architecture underneath.

Other relevant 2026 trends:
- **Fluid motion** over abrupt transitions (subtle animations > blink effects)
- **Sound design** as an interaction layer (could be interesting for "train arriving" alerts)
- **Human-centric accessibility** — not just WCAG compliance but thoughtful typography and color psychology baked into the design from the start
- **Anti-template energy** — people respond to interfaces that feel crafted, not generated. This validates the shootout approach: the winning design should feel like it has a point of view.

---

## What We'd Do Different Next Time

1. **Start with the content layout, not the aesthetic.** Pill alignment, header structure, and multi-direction handling should be solved ONCE in a shared base, then skinned.
2. **Build a component test page** — a single route that renders every edge case (1-pill, 2-pill, 4-pill, long name, short name, NOW states, light mode, dark mode) for instant visual QA.
3. **Don't iterate CRT and brutalism separately — merge them from the start.** J tried to add brutalism onto an existing CRT aesthetic. Should have started with the brutalist grid and added CRT flavor on top.
4. **Font stack decision first.** Monospace vs proportional changes everything downstream. Pick it before writing CSS.
5. **Integration before polish.** The next real step isn't another UI experiment — it's connecting bus + rail into a unified experience that makes the whole thing worth building.

---

## Next Steps

- [ ] Bus/rail integration concept — what does a unified landing page look like?
- [ ] Keep the stale-while-revalidate API cache (move to main regardless of UI choice)
- [ ] Component test page for future design rounds
- [ ] Consider neobrutalist direction: bold type + flat surfaces + accessible colors, proportional font, no CRT gimmicks
- [ ] Jake wants "creative on revisits but ok with just a brutal-ass accessible rail view when we finally go for it"
