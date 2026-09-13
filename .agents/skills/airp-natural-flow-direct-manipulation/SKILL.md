---
name: airp-natural-flow-direct-manipulation
description: "Use when designing AIRP click, double-click, drag, touch, keyboard or assistive input, natural-language entry, navigation, waiting, stop, interruption, responsive behaviour, or low-performance recovery. Give each intent one discoverable action, an equivalent goal path, honest stages, and recovery. Do not use for gameplay value, causality, copy, or visual tokens."
---

# AIRP natural flow and direct manipulation

## Use this skill when

Use it when the question is how a player performs an already chosen action and stays oriented while doing it. Read [the shared vocabulary](../_shared/shared-vocabulary.md) and [the failure contract](../_shared/failure-and-revisit.md). Ask `airp-play-and-sandbox` for the verb and `airp-causality-fairness-growth` for the consequence.

## The product answer

Every player intent gets one discoverable primary action, a safe alternative when appropriate, visible stage changes, and a way to recover without losing a landed fact. Different controls need not look identical; they must preserve the same player goal, causal result, and recovery ability when they represent the same confirmed intent.

## Decide in this order

1. **Name the intent and target.** Separate inspect, use, consume, give, enter, return, cancel, and ask. Never let one gesture silently carry two meanings.
2. **Assign the primary action.** Choose the least surprising pointer, touch, keyboard, assistive, or natural-language path. Record what a first-time player can see before acting. Keep the final door/card activation gesture `[unknown]` until the product source freezes one mapping; do not encode conflicting click/double-click rules here.
3. **Map equivalent goal paths.** An accessible alternative may use focus → target → confirm instead of a drag. Natural language is equivalent only when it resolves to the same confirmed primitive, target, prerequisites, authorization, and risk; a plan or question must not execute.
4. **Show the real stage.** Use `accepted → processing → landed → revealed → completed`, with rejected/failed/cancelled branches. Do not show “writer is writing” unless a writer is actually running. Distinguish temporary performance from a landed world change.
5. **Define interruption and repeat.** Specify Enter/Escape, stop, layer changes, lost focus, duplicate clicks, reload, and revisit. Preserve committed facts, discard only uncommitted presentation, and reuse the original action identity.
6. **Design recovery.** For missing material, service failure, slow generation, media failure, and low performance, state the next action. Text and core interaction must remain usable with effects off, audio muted, narrow layouts, or assistive input.
7. **Observe the flow.** Ask a player to point to the action, complete it, name the state, recover from failure, and revisit the result. Treat timing targets as `[heuristic]` until governance records live evidence.

## Hard stop conditions

Do not pass an interaction when the same gesture is ambiguous, acceptance looks like completion, stop is reported before work stops, a repeat double-settles, a layer change loses a fact, an effect is required to operate, or an assistive path cannot complete the same player goal.

## Decision output

Return: player intent; primary action; equivalent goal path; stage map; interruption/repeat identity; recovery path; performance/accessibility mode; unknown gesture decisions; observation required; collaborators (`airp-causality-fairness-growth`, `airp-human-language-information-hierarchy`, or `airp-aesthetic-performance-attention`).

## Further reading

- [Failure and revisit contract](../_shared/failure-and-revisit.md)
- `docs/doc-05-AIRP产品构想.md:121-160`
- `docs/doc-06-演出与交互设计.md:113-146,184-241`
- `docs/gameplay/Chalk玩法形态与判定约定.md:45-97`
