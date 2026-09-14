# AIRP evidence and decision states

Use this contract when a product proposal claims to be ready, validated, or reusable.

## Evidence ladder

- **E0 — intent**: the desired player result and product hypothesis are written.
- **E1 — design**: a concrete loop, boundary, failure path, and counterexample exist on paper.
- **E2 — static**: files, schemas, or a low-fidelity flow support the design; this does not prove runtime behaviour.
- **E3 — live path**: a real model/session or browser path produced the claimed state and visible result.
- **E4 — repeatability**: failure, interruption, revisit, and at least one meaningful variant were observed without contradiction.

A higher level includes the lower claim only when the same version, world, path, and observation are recorded. A screenshot, HTTP success, model sentence, or registration entry alone is not E3.

## Decision states

- **keep** — the player value is clear, the hard gates pass, and evidence is sufficient for the stated claim.
- **revise** — the value may be sound, but a boundary, wording, interaction, or proof is missing.
- **defer** — the idea is plausible but depends on unresolved product or runtime truth; record an owner and trigger.
- **delete** — the idea adds complexity without a distinct player decision, or its removal leaves the intended loop intact.

## Required decision record

State the player outcome, hypothesis, non-negotiable gates, alternatives including “do nothing,” reversibility, complexity/cost, failure and revisit comparison, evidence level, owner for unknowns, and the exact condition that reopens the decision.
