---
type: chalk
title: Who interests you? What next?
choice:
  options:
    - id: investigate-with-dice
      label: Find clues by rolling dice
    - id: action-1
      label: Discuss the suspect and the reasons
    - id: action-2
      label: Consult on a small plan to verify
    - id: action-3
      label: Review your deduction and plan
  allow_free: true
intent: When asked to submit, confirm, or evaluate, read existing player/deduction.md and player/operation-plan.md. Without rewriting full text, provide two short summaries on this turn’s current Chalk, one specific concern, and choices “Execute this plan” and “Revise the plan.” Ask only missing files. Do not end with just reading or insufficient text. If already approved for execution, skip repeated confirmation and follow world skill "Responses and Branching After Submission," moving incorrect deduction to brief result scene.
choice_actions:
  action-1:
    kind: writer
  action-2:
    kind: writer
  action-3:
    kind: stage
    slots:
      - id: material-1
        title: Deductions and reasons
        required: true
        paths:
          - player/deduction.md
      - id: material-2
        title: Safe execution plan
        required: true
        paths:
          - player/operation-plan.md
  investigate-with-dice:
    kind: read
    paths:
      - world/london-map/04-investigation-dice.md
---

A brief phrase like “Wayne interests me, I want to ask about his hand injury” is fine. Watson and the writer will organize it into testable strategies. No need for two long documents.

If unsure, you can let Holmes deduce by dice. Before testing strategies, you can confirm what to do. Even misses provide short results and next clues.
