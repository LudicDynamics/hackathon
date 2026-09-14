# AIRP shared product vocabulary

Use this file as the product-level vocabulary for the seven AIRP decision skills. It describes player-facing meaning, not an engine schema.

## North star

AIRP lets a player live as a character in a world that responds. A good decision makes it obvious what the player can do, gives a credible response, and makes another attempt meaningful.

## Three layers

1. **Input channel** — pointer, touch, keyboard or assistive input, natural language, or a visible choice.
2. **Product primitive** — `notice/read` (perceive or inspect), `intend/choose` (express an intention or select a declared action), `relate` (act on an entity or establish a relation: take, place, give, use, combine), `enter/return` (move between spaces), and optional `risk-confirm` (accept a disclosed uncertainty). `grow` is a system/content result, never a player verb to expose.
3. **Business result** — a narrative fact, relationship change, object/resource change, spatial change, or readable record.

Different channels must produce the same result only when they resolve to the same confirmed primitive, target, prerequisites, authorization, and risk. A sentence can be an action, proposal, question, clarification request, or rejection; it is not automatically an executed action.

## One product loop

`player intent → prerequisite check / player confirmation → execution or risk decision → world fact and cost land → plain-language response plus optional sensory enhancement → next step / revisit`

A temporary acknowledgement is not a world result. The player must be able to distinguish accepted, processing, landed, revealed, and completed. Rejected, failed, and cancelled are terminal branches. A world result needs a readable, revisitable manifestation; an audit event alone is insufficient.

## Fact boundary

Content files carry recorded world content and facts. Events carry behaviour history. Runtime state carries projections such as layout, presence, and viewpoint. File existence or a filename does not by itself prove a deduction, consent, permission, dice settlement, or ending. A world must distinguish fixed facts, changeable facts, and claims still to be checked.

## Product hard gates vs heuristics

Hard gates protect comprehension, truthful status, causal consistency, recoverability, and revisits. The 6–10 minute first-loop budget, 2–4 player verbs, one new concept, focus count, and first-action timing are `[heuristic]` starting assumptions. They require evidence; they are not universal limits.

## Honest output

Every decision should state: player result, responsible skill, keep/delete/defer call, failure gate, collaboration needed, evidence level, and unknowns. Never call a design, static file, model reply, or single success path “validated” without the corresponding observation.
