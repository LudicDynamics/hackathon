---
name: airp-play-and-sandbox
description: "Use when designing AIRP's player verbs, first short loop, reward or failure, replay value, sandbox combinations, natural-language intent, choice, or entity relationships. Prove a small, understandable loop before adding primitives or generated content. Do not use for truth/fairness, interaction implementation, copy, visual direction, complexity budgets, or evidence governance."
---

# AIRP play and sandbox

## Use this skill when

Use it to decide **what the player can do and why doing it is worth doing**. If the proposal is mainly about whether a fact is true, load `airp-causality-fairness-growth`; if it is about keeping or deleting a system, load `airp-simplicity-and-generalization` and `airp-decision-governance`.

Read [the shared vocabulary](../_shared/shared-vocabulary.md) first. The player should learn a few meaningful verbs, not the engine's internal vocabulary.

## The product answer

Start with one sentence:

> The player uses **[verb]** on **[target]** to pursue **[meaningful aim]**, receives **[credible result]**, and has a reason to try **[next choice]**.

Build the loop as:

`intent → check/confirmation → action or risk decision → world result → meaning → next step/revisit`

A short loop is a budget, not a stopwatch. `[heuristic]` For a first slice, try four beats: orientation, preparation, commitment or risk, and settlement. Two to four player verbs may be enough; they are not a platform-wide limit.

## Decide in this order

1. **Name the player problem.** What local uncertainty, relationship, obstacle, or promise makes the action matter? If removing the action changes no player decision, delete it.
2. **Choose the smallest player verb set.** Select only the stable primitives needed: notice/read, intend/choose, relate to an entity, enter/return, and optional risk confirmation. `grow` is a world result, not a verb the player must learn.
3. **Give each verb an object and consequence.** Write what can be targeted, what changes, what remains readable, and what the next choice is. Do not add a button merely because the engine can do something.
4. **Make combinations meaningful.** Swap a material, target, order, or stated intention. Keep a combination only when the change affects a condition, risk, relationship, fact, or available route. Do not promise a unique ending for every permutation.
5. **Keep expression open but interpretation honest.** Natural language may execute a low-risk, unambiguous action; it may also be a proposal, question, clarification, or rejection. A plan is not permission to execute. Visible choices are shortcuts, not the only valid expression.
6. **Design for a second attempt.** State what a player learns from success, failure, or refusal and what new strategy becomes possible. A second click must not be the same attempt with a free reroll.
7. **Hand off the hard boundary.** Ask `airp-causality-fairness-growth` to check facts, costs, failure, generation, and revisit identity; ask `airp-natural-flow-direct-manipulation` for the physical input path; ask `airp-simplicity-and-generalization` whether the idea belongs in the core.

## Hard stop conditions

Do not pass the play proposal when:

- the player cannot name the intended action or target;
- a missing prerequisite silently becomes success;
- an animation, model sentence, or HTTP acceptance is the only result;
- failure offers no truthful next action or makes the only route impossible;
- repeated input can double-spend, reroll, duplicate, or rewrite a settled result;
- generated content is larger than one useful, revisitable playable unit;
- the design only changes skin, vocabulary, or asset quantity and not the player's decision.

## Decision output

Return: player outcome; chosen verbs and combinations; loop beats; meaningful alternative or failure; what is deliberately not added; the `airp-causality-fairness-growth` boundary to verify; evidence level and unknowns. Mark 6–10 minutes and verb counts `[heuristic]`, never as validated facts.

## Further reading

- [Failure and revisit contract](../_shared/failure-and-revisit.md)
- `docs/doc-05-AIRP产品构想.md:27-66,70-160`
- `docs/gameplay/六世界短闭环与AI生长验收.md:19-37`
- `docs/gameplay/Chalk玩法形态与判定约定.md:18-60`
- `../../../skills/component-narration/SKILL.md` for choosing a narrative carrier; `../../../skills/tool-craft/SKILL.md` for existing action tools.
