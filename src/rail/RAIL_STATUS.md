# Rail UI Design Shootout — Status

*Updated: 2026-02-21 20:00 EST*

## Goal
Build a competitive MARTA Rail real-time tracker that **beats marta.io** in usability and visual appeal. Jake wants to be "PUMPED."

## Architecture
- **Rail API client:** `pullcord/src/rail/api.ts` — 8s cache, typed interfaces
- **Routes:** `pullcord/src/routes/rail.ts` — Hono routes, each candidate at `/rail-{letter}`
- **Candidates:** `pullcord/src/rail/candidates/rail_views_{A-G}.ts`
- **Spec:** `pullcord/src/rail/candidates/SPEC_V2.md` (detailed requirements)
- **Dev server:** `bun run src/index.ts` on port 4200, Caddy at `pullcord.home.jake.town`
- **MARTA_API_KEY:** in `.env` — `REDACTED_MARTA_API_KEY`

## Design Constraints
- **Min font sizes:** 1rem station names, 0.95rem times, nothing below 0.88rem
- **Mobile-first:** 480px max-width centered
- **Dark mode default** + `@media (prefers-color-scheme: light)` support
- **WCAG AA contrast** (4.5:1 minimum)
- **Pills are the design language** — chunky capsules with line-colored direction circles (N/S/E/W) + `:XX` monospace time
- **Station name + pills on same row** (pills wrap for multi-direction stations)
- **Station detail:** soonest-first, NOT grouped by direction. Direction badge per row.
- **Train detail:** vertical timeline with visible line in line color
- **Single file**, zero external deps, all CSS/JS inline, import only from `"../api"`
- **Line colors:** GOLD=#c9a227, RED=#cc3333, BLUE=#0074d9, GREEN=#2ecc40
- **10s polling** (`?partial=1` replaces `#rail-body`)
- Each candidate's internal links use its own `/rail-{letter}/` prefix

## Route Pattern (per candidate)
```
/rail-{X}                    → landing (all stations)
/rail-{X}/:slug              → station detail
/rail-{X}/train/:id          → train detail
```

## Candidates

| ID | Name | Lines | Status | Notes |
|----|------|-------|--------|-------|
| A | Transit Sign | 893 | ❌ Rejected | Sub-agent written. Generic, not exciting |
| B | Modern Native | 313 | ❌ Rejected | Hand-written. Too plain |
| C | Dense & Fast | 315 | ❌ Rejected | Hand-written. Too plain |
| D | Pill-First | ~400 | ⚡ Iterated | Hand-written, 2 rounds of screenshot feedback. Getting closer |
| E | Neon Lines | 600+ | ✅ Live | Sub-agent. Glowing pills, neon left-stripes, dark bg. Looks good! |
| F | Departure Board | — | ❌ Failed | Sub-agent never wrote file |
| G | Glass Morphism | 600+ | 🐛 Bugged | Sub-agent. Uses Object.keys() on Map — shows empty |

## Current Assessment
- **E (Neon Lines)** is the frontrunner — pills pop, neon glow works, line colors dominate
- **D (Pill-First)** is decent but less exciting
- A/B/C were all rejected — "none of these are getting me pumped, marta.io looks better"
- G has potential but needs the Map bug fixed
- F never materialized

## Screenshot Pipeline
- Tool: `/tmp/rail-screenshots/snap_small.ts` (Playwright, 375x700, 1x, dark mode)
- Output: `/tmp/rail-screenshots/rail-{x}.png`
- Process: screenshot → `image` tool for assessment → send to Jake via Telegram

## What marta.io Does Right (the bar to beat)
- Big chunky capsule pills (~44px tall touch targets)
- Direction letter in colored circle + `:XX` time
- Station name + pills on same row
- Five Points shows 4 directions (N/S/E/W) with pills wrapping
- Simple, scannable, immediate

## Known Issues
- **Sub-agent model override is broken** — OpenClaw bug #6295. `sessions_spawn.model` and `agents.defaults.subagents.model` both return `modelApplied: true` but sub-agents always run on primary model (opus). Config workaround doesn't work either.
- Sub-agents are unreliable — ~50% fail to write files (timeout, API errors, no output)

## Next Steps
- Jake starting fresh session, will reference this file
- Fix G's Map bug or write F (departure board) manually
- Keep iterating on whichever candidate Jake likes
- Goal: something worth showing off
