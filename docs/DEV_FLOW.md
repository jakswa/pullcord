# Dev Flow: AI-Driven Design Iteration

*Documented from the Pullcord D experiment cycle, Feb 13 2026*

## The Pattern

**Brain agent** (main session) does planning, judgment, review, and targeted fixes.
**Worker sub-agents** (spawned sessions) do grunt work: generating complete file sets from briefs.

### Phase 1: Diverge (Sub-Agents Generate Variants)

**Brief format matters.** Sub-agents need:
- Clear deliverables ("WRITE THESE 4 FILES: ...")
- File count + names explicitly listed
- Design constraints as bullet points, not prose
- A working reference to build FROM (existing codebase)
- Explicit "WRITE THE FILES" instruction (Opus sub-agents can burn all tokens thinking)

**Spawn multiple variants in parallel.** Each gets a distinct design direction, not "make it look better." Good briefs name the concept: "Departure Board", "Transit Pro", "Warm & Playful."

**Model selection:** Sonnet for file generation (faster, writes more). Opus overthinks and can exhaust output tokens without producing files.

**Infrastructure for comparison:**
- Feature branches (`experiments` branch keeps `main` clean)
- Variant router serves all experiments side-by-side (`/v/a`, `/v/b`, `/v/c`)
- Screenshot tool (`tools/screenshot.mjs`) for automated captures
- Mock data mode (`?mock=1`) for consistent comparison when no live data

### Phase 2: Evaluate (Brain Judges)

**Self-review before showing the human.** Take screenshots, analyze them, identify issues. Don't show work you're not pumped about. The human said: *"avoid bugging me until the screenshots make you pumped."*

**Use vision analysis** on screenshots to catch issues: layout problems, contrast, dead space, truncation, overlapping elements.

**Compare against competitors** (Transit App was our benchmark). Note what they do well, what we can beat them on.

**Key judgment calls the brain makes:**
- Which experiment has real ideas vs just a reskin?
- What's worth fixing vs what's a dead end?
- When to iterate more vs when to ship?

### Phase 3: Converge (Brain Refines the Winner)

Once a direction wins, the brain agent does the targeted work:

1. **Fix bugs** the sub-agent introduced (stop ordering was alphabetical, not by route sequence)
2. **Add features** that emerged from the design (direction swap, tap-to-hero)
3. **Fuse aesthetics** from multiple experiments (D's structure + B's typography)
4. **Polish interactions** (countdown timer, Pull the Cord notifications)

This phase is iterative: fix → screenshot → evaluate → fix. The loop runs until the brain is satisfied.

### Phase 4: Ship (Merge to Main)

- Commit experiments on feature branch
- Port winning design to main files
- Merge, build, test with live data
- Push to production

## Key Lessons

### Brief Quality > Model Quality
A mediocre model with a great brief beats a powerful model with a vague brief. "Make it look better" produces reskins. "Reimagine the information hierarchy for someone standing at a bus stop" produces real ideas.

### Sub-Agents Can't Judge Their Own Work
They'll write beautiful design docs and broken code. Always screenshot and review before trusting the output. Silent failures (NaN cascades, wrong data ordering) are common.

### The Brain Should Do the Hard Parts
- **Sub-agents:** Generate complete file sets from briefs
- **Brain:** Diagnose bugs, make UX decisions, fuse designs, fix interactions, evaluate quality

Sub-agents are good at "write a complete CSS file for this design system." They're bad at "figure out why the progress strip looks wrong" (requires cross-file reasoning + data pipeline understanding).

### Infrastructure Compounds
Every tool you build (screenshot automation, mock data, variant router, feature branches) makes future iterations faster. The third experiment was 10x faster to wire up than the first.

### The "Am I Pumped?" Test
Don't show half-baked work. The human's time and attention are the scarcest resource. Iterate internally until you'd be excited to present it. This filters out 80% of mediocre output before it wastes anyone's time.

## Timeline (This Session)

```
04:20  Sub-agent D completed (15min run, 90k tokens)
04:25  Wired D to /v/d, took screenshots
04:30  Self-reviewed: tracker exciting, home generic
04:31  Showed Jake the tracker screenshot → pumped
04:40  Jake: progress strip bug, direction confusion
04:43  Diagnosed: stops ordered alphabetically, not by sequence
04:50  Fixed DB query (stop_sequence from stop_times)
04:55  Fixed mock data (real GTFS headsigns per direction)
05:00  Added direction grouping in Coming Up
05:08  Jake: tap-to-swap hero, pull cord on later buses
05:10  Implemented direction swap with URL param
05:15  Implemented tap-any-row-to-hero with vehicle tracking
05:20  Applied B's JetBrains Mono aesthetic to D
05:26  Screenshots of B+D fusion — looks great
05:29  Ported D to main branch files
05:30  Merged experiments → main, tested with live data
05:31  Pushed to Codeberg, live at pullcord.home.jake.town
```

~70 minutes from sub-agent completion to production. The sub-agent did ~30% of the work (file generation). The brain did ~70% (diagnosis, fixes, features, aesthetic fusion, shipping).
</content>
</invoke>