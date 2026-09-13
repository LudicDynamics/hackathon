---
name: airp-simplicity-and-generalization
description: "Use when considering a new panel, value, mode, state, flow, dedicated component, engine capability, cross-world abstraction, or whether a demo-specific idea belongs in AIRP core. Compare player, engine/operations, and content complexity before choosing core, world content, hidden support, or deletion. Do not use for detailed gameplay, truth, gestures, copy, visual direction, or evidence levels."
---

# AIRP simplicity and generalization

## Use this skill when

Use this skill before adding a visible concept or promoting a world-specific trick into the product. AIRP may have a complex engine; the player should face a small, expressive contract. Read [the shared vocabulary](../_shared/shared-vocabulary.md).

## The product answer

Keep a capability in the core only when it preserves a distinct player decision across different worlds, and when its removal would break an observable choice, result, fairness, or recovery path. Otherwise keep it in world content, hide it behind the engine, combine it with an existing primitive, or delete it.

## Decide in this order

1. **Write the player loop first.** Name the player decision, target, result, and recovery path. If the proposal has no player-facing decision, it is not a product feature yet.
2. **Keep three ledgers.** Record added player mental load (concepts, modes, panels, confirmations), engine/operations load (queues, persistence, services, recovery), and content maintenance load (world variants, language, assets). Do not claim “simple” because only the UI is simple.
3. **Run the deletion counterfactual.** Remove the proposal. Which player decision, fact, fair risk, or recovery path disappears? If none does, delete it. If the value survives in an existing primitive, merge it.
4. **Choose the least visible layer.** Hide engine mechanics such as persistence, idempotency, caching, scheduling, and agent context. Keep decision-changing facts, cost, uncertainty, stage, result, and next step visible in human terms.
5. **Run a cross-world substitution.** Replace the detective clue, spell fragment, promise, or timeline object with another domain's material. The same intent → target → response → durable result should still work without a new global mode, button family, field, or route. World meaning and constraints belong in world content.
6. **Check the growth budget.** A first slice should add at most one playable growth unit `[heuristic]`; avoid generating a whole city, several characters, and multiple media at once. More engine or operations cost is acceptable only when it buys truthful, revisitable play.
7. **Escalate the trade-off.** Send “keep / hide / merge / delete / defer,” the three ledgers, the counterfactual, and unresolved evidence to `airp-decision-governance`. Send gameplay value to `airp-play-and-sandbox` and factual safety to `airp-causality-fairness-growth`.

## Hard stop conditions

Do not promote an idea when it only changes one demo, adds a container without a new decision, replaces world meaning with a generic `interaction` label, creates state × language × asset combinations without linear value, or survives deletion unchanged. Do not hide cost, uncertainty, failure, or irreversibility simply to keep the screen clean.

## Decision output

Return: player value; P/E/C ledger; deletion counterfactual; stable primitive or world-content location; cross-world substitution; operations/content risks; keep, hide, merge, delete, or defer; evidence and unknowns. Numeric budgets are `[heuristic]` unless governance records live evidence.

## Further reading

- [Evidence and decision states](../_shared/evidence-and-decision-states.md)
- `docs/doc-05-AIRP产品构想.md:18-25,70-80,121-160,525-667`
- `docs/doc-04-视觉设计风格.md:170-233`
- `docs/gameplay/六世界短闭环与AI生长验收.md:8-29`
