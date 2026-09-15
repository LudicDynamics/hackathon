# Living Canvas - worldlines

**English** · [简体中文](README.zh-CN.md)

> An AI interactive-fiction game where the player lives inside a *living, infinite canvas world* as one of its characters.
> Design docs live in **[`docs/`](docs)** (start at [`docs/00-文档骨架.md`](docs/00-文档骨架.md)). The developer handbook is **[`AGENTS.md`](AGENTS.md)**. Most internal docs are written in Chinese.

---

## 🏛️ Architecture and design principles

1. **Narrative is the soul of the world; multimodal staging and physical interaction carry the gameplay.**
   - The Writer agent's narration cards (`type: chalk`) direct everything on stage: parallax scenery, ambient sound, character motion and prop interactions.
2. **2.5D paper-cut miniature theatre (shadow box & parallax).**
   - Built on web standards (CSS 3D `perspective: 1200px`) with parallax depth and a floating-dust particle overlay — no heavy 3D engine.
3. **Point-and-click puzzles and big physical dice.**
   - Drag items from the backpack onto scene cards, gates or NPCs to solve puzzles (`use_item_on`: unlock with a key, present evidence, …).
   - A CSS 3D dice animation, backed by true engine-side randomness (`expect: ">50"`) and a dramatic resolution.
4. **Character close-ups (6 expression variants, lazily woken souls).**
   - Characters sit lightly on the canvas as round cursor-like avatars; click one to open a galgame-style close-up that starts that character's own agent.
   - A line prefix `[emo: normal|smile|shock|sad|angry|thinking]` switches between six expression portraits in real time.
5. **Files are the source of truth.**
   - The world directory *is* the truth (no separate state file). State lives in narrative frontmatter (`status.data` / `choice` / `roll_dice`); content is on the file system, architectural state and history in SQLite (`canvas.db` + `history.db`).
   - **`status` is only a snapshot of one entity (a chalk included) — reading it means reading that file. There is never a state system** (`get_state` / `set_state` / `state_update` / `watch_state` / state files / status bars): that would create a second source of truth that bypasses `edit` and the event table. See `docs/protocols/doc-20` §2.3.

---

## 📁 Repository layout

```text
├── apps/
│   ├── server/            # Node.js + WebSocket + pi-rp RPC engine lifecycle
│   │   ├── src/engine/    # rpc-client, lifecycle, event-bridge, brief-builder
│   │   └── src/routes/    # world management, move rewrites, dice resolution, god-mode API
│   └── web/               # React 19 + Tailwind + Vite canvas front end
│       └── src/
│           ├── components/canvas/     # infinite canvas, single transform, camera gestures, card projection
│           ├── components/narrative/  # ink chalk cards, status tables, choices, 3D dice
│           ├── components/overlay/    # character close-up (6 expressions) + streaming galgame dialogue
│           ├── components/sidebar/    # right sidebar: backpack (player/) + characters (travel / talk / follow)
│           └── components/god/        # god-mode toolbar (world freeze + creation)
├── packages/
│   └── shared/            # WorldManifest (Zod), ChalkFrontmatter, WorldStore, SQLite schema
├── presets/               # prompt presets (writer, character, scene-init, nook-init)
├── templates/             # the seven canonical worlds, each in English / Japanese (-jp) / Chinese (-zh)
│   ├── wuwu/              # Fogwharf (English)
│   ├── wuwu-jp/           # Fogwharf (Japanese)
│   ├── wuwu-zh/           # Fogwharf (Chinese)
│   └── ...                # full list below
├── archive/templates/     # older asset builds, playtests and technical fixtures (restorable)
├── docs/                  # design docs (source of truth; start at docs/00-文档骨架.md)
├── tools/
│   ├── scaffold.mjs       # scaffold: copy a template into a playable world
│   └── probe-writer.mjs   # gate probe: verifies the engine and the RPC chain end to end
├── vendor/
│   └── pi-rp/             # pi-rp runtime (git submodule)
└── AGENTS.md              # developer handbook (architecture, doc map, working rules)
```

---

## 🚀 Quick start

### Windows: daily update and launch

With a local model configuration in place, double-click `Start-AIRP.cmd` in the repository root, or run `./Start-AIRP.cmd` in PowerShell.
To update, first run `git pull --ff-only --recurse-submodules`, then the script.

The script installs workspace dependencies, rebuilds pi-rp when its sources changed, builds the project and restarts this project's back end.
The back end serves the page itself: open **http://localhost:3001/** — no separate Vite process is needed.
Your model settings (`.env.local`, local files under `.pi/agent/`) and saves in `worlds/` are kept; launching never calls a model or runs development probes.
It stops with a clear message if the port is taken or an agent is still working, and keeps the running service if the build fails.
Logs are in `.artifacts/local-server/`; use `./Start-AIRP.cmd -NoBrowser` to skip opening the browser.
If Git reports conflicting local changes, resolve them first — the script never overwrites your changes or switches engine versions for you.

### 1. Build the whole repository
```bash
pnpm install
pnpm build
```

### 2. Run the health probe
```bash
pnpm probe
# "=== [AIRP Gate Probe] ALL CHECKS PASSED ===" means the whole chain is ready
```

### 3. Scaffold a new world
```bash
# Create your own world from the Japanese First Snow Radio template
node tools/scaffold.mjs --template first-snow-jp --out worlds/my-first-snow
```

### 4. Run the full stack locally
```bash
# Starts the back-end API/WS and the Vite canvas together
pnpm dev
```
- Front end: `http://localhost:5173`
- Back end: `http://localhost:3001`

### Worlds (English / Japanese / Chinese)

These canonical templates are tracked in Git, with scene READMEs, chalk cards, world skills, characters and their images / animations. After cloning, create a new game straight from the world menu on port 5173 — **no content-generation tool needs to run first**. Real AI play still requires configured model services.

| World | English | 日本語 | 中文 |
|---|---|---|---|
| Fogwharf · 雾坞镇 | [`wuwu`](templates/wuwu/) | [`wuwu-jp`](templates/wuwu-jp/) | [`wuwu-zh`](templates/wuwu-zh/) |
| Holmes: The Fourth Case · 福尔摩斯 | [`whitechapel`](templates/whitechapel/) | [`whitechapel-jp`](templates/whitechapel-jp/) | [`whitechapel-zh`](templates/whitechapel-zh/) |
| Divergence · 分歧线 | [`divergence`](templates/divergence/) | [`divergence-jp`](templates/divergence-jp/) | [`divergence-zh`](templates/divergence-zh/) |
| First Snow Radio · 初雪电台 | [`first-snow`](templates/first-snow/) | [`first-snow-jp`](templates/first-snow-jp/) | [`first-snow-zh`](templates/first-snow-zh/) |
| Magic Academy · 魔法学院 | [`magic-academy`](templates/magic-academy/) | [`magic-academy-jp`](templates/magic-academy-jp/) | [`magic-academy-zh`](templates/magic-academy-zh/) |
| The Unwritten Door · 未写之门 | [`unwritten-door`](templates/unwritten-door/) | [`unwritten-door-jp`](templates/unwritten-door-jp/) | [`unwritten-door-zh`](templates/unwritten-door-zh/) |
| The Moonlit Pact · 月下之誓 | [`moonlit-contract`](templates/moonlit-contract/) | [`moonlit-contract-jp`](templates/moonlit-contract-jp/) | [`moonlit-contract-zh`](templates/moonlit-contract-zh/) |

The English edition is the executable contract; the Japanese and Chinese editions share its IDs, paths, choices, dice and assets and differ only in text (checked by `pnpm check:worlds`). Older templates and playtest builds were moved, restorably, to `archive/templates/pre-bilingual-2026-09-14/` and never appear as new-game entries. Passing the packaging and offline checks does not mean a world has been played through with a real AI.

Canonical content is maintained directly in the templates above. `tools/experiences/` and the archive are only for historical tests and experimental fixtures — don't put old compiler output back into the canonical list. Player saves, keys and runtime caches stay ignored, and template updates never migrate existing saves.
