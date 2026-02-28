# Rail UX Requirements

*From Jake's feedback on marta.io vs roundhouse — 2026-02-21*

## Text Size
- **Minimum 0.8rem** — same rule as bus. Don't repeat history.

## Landing Page — Next Arrivals
- marta.io's biggest differentiator: **next arrival per direction at each station** (like physical MARTA signs)
- Five Points = worst case: 4 cardinal directions (N/S/E/W), one arrival each
- These directional "pills" are the core value prop — **match or beat this UX**
- Goal: at-a-glance "which train is coming soonest in which direction" without scrolling

## Station View — Direction Grouping
- Current marta.io groups arrivals by direction within a station
- Jake OK with grouping **for now**, but:
  - ⚠️ If an imminent train gets buried below others due to direction grouping → **remove grouping**
  - Direction indication is good — explore **per-arrival direction badges** instead of section headers
  - Priority: accessibility of "what's coming soonest" > organizational neatness

## Train View — Train ID Detail
- marta.io pattern: **vertical line** with stops along it, station name on one side, times on the other
- This is clean and scannable — the bar to clear
- Current roundhouse train view is less accessible
- If pullcord can't beat or match this → Jake keeps marta.io for this view

## Design Principle
- Real-time transit = **glanceability over completeness**
- Physical sign metaphor: what would the platform sign show?
- Don't over-organize at the cost of surfacing the most urgent info
