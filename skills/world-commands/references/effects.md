# The effect list

The seven verbs a `do` step may name, with the arguments each one accepts. Write the verb, not
the action method behind it: `give`, never `createEntity`.

This file is GENERATED from `packages/shared/src/commands/effects.ts` — do not edit it by hand.
To change an effect, follow `docs/command/04` and run
`node tools/check-command-effects.mjs --write-ref`.

| Effect | Arguments | Required | Exactly one | Array form | What it does |
|---|---|---|---|---|---|
| `give` | `path`, `title`, `body`, `frontmatter`, `link_to`, `rewards` | — | `path` | `rewards` | `rewards` (list-args) | Creates one entity, or one per element when `rewards` is an array. `path` and `rewards` are mutually exclusive. |
| `move` | `from`, `to`, `near` | `from` + `to` | — | — | Moves an entity to another path, or to a layer directory (the filename is kept). |
| `edit` | `path`, `frontmatter`, `body`, `append_body` | `path` | — | — | Edits an entity in place: `frontmatter` shallow-merges, `body` replaces, `append_body` appends. |
| `set_status` | `path`, `values` | `path` + `values` | — | — | Writes scalar keys into the entity's `status.data`. This is the deep-merge form of `edit`. |
| `consume` | `from`, `to`, `mark`, `append_body`, `title` | `from` | — | `from` (scalar) | Takes the first existing path from `from`, then either moves it away (`to`) or changes it in place. |
| `enter` | `layer` | `layer` | — | — | Enters a layer. Usable only when the layer's gate requirement is satisfied. |
| `link` | `from`, `to`, `style`, `label` | `from` + `to` | — | — | A rider of `give`; it writes no event of its own. Prefer `give` with `link_to`. |

## Rules that apply to every effect

- `path` values are world-root-relative: `world/`, `player/`, or `characters/`, and a `.md` file.
- An array argument is passed WHOLE, as a static reference: `"{{ trigger.entry.rewards }}"`. A
  literal array is refused — content lives on the entity, not in the command.
- These keys are never writable: `roll_dice`, `command_log`, `command_error`, `on`.
  They carry already-settled facts, and writing them would forge a result the player has seen.
- Whether an effect CAN happen is not checked at write time (a missing file, an item the player
  does not have). Those fail at trigger time, visibly.
