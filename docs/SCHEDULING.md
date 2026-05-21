# Scheduling philosophy: rest opportunistically

The plan is 250 hours over 13 weeks. No rest days are pre-built. The plan demands what it demands.

**You take rest when you actually need it, not on a schedule.** That's what the app's flex buttons exist for.

## Three ways to flex

### 1. Missed a day — "Redistribute undone tasks"

You skipped study (life happened, you were exhausted, whatever). Click the button on Today's sidebar.

- Finds the phase for today (Foundation / Strategy / Practice / Execution / Test Week)
- Caps each remaining day in the phase at 1.5× the phase average
- Walks each undone task in sort order, finds the next day with capacity
- Phase boundaries are protected — won't push earlier material into later weeks
- Test days are never modified

### 2. Big work day coming — "Cap at 30 / 60 min"

You know tomorrow is brutal at work. Set the date picker to tomorrow, click the button.

- Keeps the first 30 (or 60) minutes of tasks on that day, in sort order
- Pushes the rest into the lightest of the next 3 days

This is the *proactive* version. Different from #1 (reactive).

### 3. Need a structural rewrite — contact your planner

For larger changes the buttons can't handle:
- "Move test date a week later"
- "Replace a study source across multiple weeks"
- "Add extra sessions to a weak area"
- "Take a full week off in late June"

Use the Export tab to download a CSV of all tasks, modify as needed, and re-import via the Supabase Table Editor.

## When to actually use these

**Don't reshuffle out of anxiety.** The button is for actual misses, not for "I'm worried I might fall behind."

**Take rest after big effort, not before it.** If you finish a long session, take the next day genuinely light. The reschedule function will absorb it.

**Watch the "MOVED ×N" tags.** Every redistributed task carries a counter. If by Week 4 you see tags everywhere, the original pace isn't sustainable and you should consider:
- Extending the end date
- Looking at your weekday execution — are 2-hour evenings actually possible after work?

**Trust the structure for the first 2 weeks before you change anything.** Week 1 will feel hard because it's setup + new habits. By Week 3 you'll know what's sustainable.

## The honest tradeoff

Original plan = 250 hours = roughly 19hrs/week average. Take one full weekly rest day and trim Saturdays and you're at 215 hours — 35 hours less. Factor that into your targets accordingly.

## Test Day (Aug 22) is sacred

Cannot be moved by any function. Cannot be capped. Cannot be redistributed. The only way to change it is to update the date in the app's source code.
