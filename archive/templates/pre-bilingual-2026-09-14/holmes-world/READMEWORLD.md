# Fog Over Baker Street — Complete Example World

> Product: AIRP (AI Interactive Narrative Game)
> Theme: Sherlock Holmes × the Adler disappearance case
> Genre: open-ended mystery
> Design doc source: doc-05 AIRP Product Vision.md §8 World file structure

## World Overview

The player takes on the role of **Sherlock Holmes**, investigating **the disappearance of Lady Adler** from 221B Baker Street. There is no predetermined killer — every truth is pieced together from clues alone.

**Watson** is the companion (navigable / chat / follow via the character tab in the right sidebar), and the **Constable** provides the initial clue.

## Layered Canvas

```
221B Baker Street (world map · material: parchment)
├── Baker Street (scene layer · material: warm)
│   ├── Crime Scene (stub layer · instantiated on first entry)
│   └── Abandoned Orchard (stub layer · instantiated on first entry)
└── Apartment (scene layer · material: wood)
```

## Clue Chaining (narrative script keyword triggers)

| Keyword | Trigger scene | Clue gained |
|---------|---------------|-------------|
| "look", "clue", "observe", "discover" | Baker Street | A blurred photograph (points to the Abandoned Orchard) |
| "Adler", "missing", "woman" | Baker Street | An anonymous note ("She's gone to the abandoned orchard.") |
| "fog", "weather", "evening", "night" | Baker Street | Watson reminds you of the orchard clue |
| Enter the Crime Scene | Crime Scene | A rusted key appears automatically |
| "orchard", "abandoned", "trees", "tree" | Crime Scene | A mud-stained letter (signed "A") |
| "walk", "leave", "back", "return" | Baker Street | The fog thickens; the world awaits your next move |

## File List

| File | Type | Description |
|------|------|-------------|
| `README.md` | type: readme | World introduction |
| `world.json` | manifest | World configuration (characters, mystery — layers are scanned from directories, not declared) |
| `world/README.md` | type: readme | World map description |
| `world/baker-street/README.md` | type: readme | Baker Street scene description |
| `world/baker-street/evening.md` | type: chalk + frontmatter | Photograph-clue narrative |
| `world/baker-street/late-night.md` | type: chalk + frontmatter | Fog reminder narrative |
| `world/crime-scene/README.md` | type: readme | Crime Scene (stub) |
| `world/crime-scene/evening.md` | type: chalk + frontmatter | Key-discovery narrative |
| `world/abandoned-orchard/README.md` | type: readme | Abandoned Orchard (stub) |
| `characters/watson/README.md` | type: readme | Watson character profile |
| `characters/watson/preset.json` | pi-rp preset | Watson prompt preset |
| `characters/constable/README.md` | type: readme | Constable character profile |
| `characters/constable/preset.json` | pi-rp preset | Constable prompt preset |
| `world/README.md` | type: readme | Player's own space |
| `player/old-boat-ticket.md` | type: note | Starting item (inventory) |
| `journal/README.md` | type: readme | Journal directory notes |
| `journal/01-fog-day-one-arriving-on-baker-street.md` | type: chalk | Case journal |
| `.airpworld/openings/holmes.json` | opening seed | Writer's opening line and initial state |

## Character Setup

### Watson (player companion)
- Identity: Dr. John H. Watson, Holmes's closest friend and chronicler
- Role: dialogue prompts, clue reinforcement, emotional anchor
- Position: right sidebar "Characters" tab → navigate / chat / follow
- Portrait: `assets/characters/portraits/portrait21_sara.png`

### The Constable (NPC)
- Identity: sergeant of the Baker Street police station
- Role: provides the anonymous-note clue
- Position: right sidebar "Characters" tab → navigate / chat
- Portrait: `assets/characters/portraits/LPCportrait5.png`

## Open-Ended Design Principles

1. **No predetermined killer** — every truth is pieced together from clues
2. **Open deduction** — players can combine clues freely to reach different conclusions
3. **Fog is a metaphor** — the thicker the fog, the closer to the truth, and the more blurred it becomes
4. **The Writer writes only the environment** — what characters say and the items you find is narrative text; the Writer adds only environmental atmosphere
5. **Multiple endings possible** — how clues are interpreted determines where the story goes

## How to Use

### Option 1: Use directly as a file world (recommended)
Place the entire `holmes-world/` directory into the AIRP engine's worlds directory; the engine automatically scans `world.json` and the `.airpworld/` configuration.

### Option 2: Copy into an existing project
```bash
cp -r holmes-world/ <your world directory>/
```

### Option 3: Package and share
```bash
cd holmes-world && zip -r holmes-world.airpworld.zip .
```

## Relationship to the Front-End Prototype

The **v1 canvas prototype** is this world's **front-end rendering prototype** (paper-textured canvas, layer traversal, streaming chalk writing, character dialogue overlay, inventory drag-and-drop). It lives in the retired **`infini-canvas`** project — clone that repository as a sibling directory to compare.
- The map data, narrative scripts, and character configuration are written into this directory
- The front-end HTML's LAYERS / WRITER_SCRIPTS / DLG_ASSETS map one-to-one to this directory
- This directory is the **source of truth** (files are the world state); the HTML is the **projection** (the canvas as rendered)
