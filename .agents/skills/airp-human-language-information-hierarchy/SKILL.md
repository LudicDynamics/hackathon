---
name: airp-human-language-information-hierarchy
description: "Use when writing or reviewing AIRP UI copy, empty states, errors, waiting or stop messages, choices, status summaries, Agent or character receipts, help, details, or localization. Put the truthful status first, then its reason and next action, with machine detail progressively disclosed. Do not use for business truth, gestures, visual tokens, or translation implementation."
---

# AIRP human language and information hierarchy

## Use this skill when

Use it whenever a player has to understand what happened, why it happened, or what to do next. Read [the shared vocabulary](../_shared/shared-vocabulary.md) and [the failure contract](../_shared/failure-and-revisit.md). `airp-causality-fairness-growth` supplies the facts; `airp-natural-flow-direct-manipulation` supplies the actual stage; `airp-aesthetic-performance-attention` supplies non-verbal reinforcement.

## The product answer

The first layer always says:

`current status or conclusion → checkable reason → current valid next step`

Use human language to lower guessing cost, not to soften or conceal uncertainty. System status must not impersonate a character, world fact, or writer response.

## Decide in this order

1. **Identify the speaker and fact.** Label system status, world result, Writer/Character response, player action, or machine diagnosis. Say only what that source actually knows.
2. **Choose the real stage.** Use accepted, processing, landed, revealed, completed, rejected, failed, or cancelled. “The writer is writing” is valid only when a writer task is running; an event-only path must say it is recorded and waiting, not completed.
3. **Write status, reason, next step.** Replace “success,” “error,” “no data,” and “continue” with the concrete action, cause, and next move. Empty state = what is missing + where to act. A refusal = why + a viable direction, without silent retry.
4. **Make choices carry meaning.** A choice label names the action and consequence or commitment, not a generic confirmation. Show risk, cost, missing material, and reversibility before asking for confirmation.
5. **Layer detail.** Keep the player-facing conclusion and next step visible; place world context and cost behind the next layer; fold machine evidence, paths, IDs, and diagnostics away. More detail must not contradict the first layer.
6. **Localize the meaning.** Preserve responsibility, certainty, action, warmth, and length in each world language. Do not translate technical wording word-for-word when it hides the player action or changes who is speaking.
7. **Review with the player task.** Give a reader one message and ask them to name the state, reason, next action, speaker, and whether a world fact changed. Mark the result as design/static/live evidence rather than assuming “natural” means understood.

## Hard stop conditions

Do not deliver copy whose first layer only says success/failure/processing, lacks a reason or next step, contradicts the actual stage, presents system text as character speech, exposes raw protocol errors, uses an empty state as a service failure, or lets a translation hide action, cost, responsibility, or uncertainty.

## Decision output

Return: speaker and fact source; real stage; first-layer status/reason/next step; disclosed cost or uncertainty; progressive details; localization notes; failure/unknown variants; reader observation and evidence level. Hand business truth to `airp-causality-fairness-growth`, input timing to `airp-natural-flow-direct-manipulation`, and visual reinforcement to `airp-aesthetic-performance-attention`.

## Further reading

- `docs/doc-03-文案语言.md:33-43,47-85,89-125,145-168`
- `docs/doc-06-演出与交互设计.md:1-17,113-130,204-216,385-387`
- [Failure and revisit contract](../_shared/failure-and-revisit.md)
