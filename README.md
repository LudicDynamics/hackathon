<div align="center">

# Worldlines: LivingCanvas

**An agent-native AI roleplay game on one infinite canvas.**
You, your AI character agents, and a writer agent share the same world — and it keeps growing as you play.

[![Watch the 1-minute film](https://img.shields.io/badge/YouTube-1--minute%20film-ff0000?logo=youtube&logoColor=white)](https://youtu.be/FnUXFOv74Tg)

[![7 worlds × 3 languages](https://img.shields.io/badge/worlds-7%20%C3%97%20EN%20%2F%20JA%20%2F%20ZH-899b87)](#worlds-english--japanese--chinese)
[![1,180 tests](https://img.shields.io/badge/tests-1%2C180%20passing-brightgreen)](#developing)
[![9 contract gates](https://img.shields.io/badge/contract%20gates-9%20clean-brightgreen)](#developing)
[![GPT Live](https://img.shields.io/badge/GPT%20Live-full--duplex%20character%20calls-10a37f?logo=openai&logoColor=white)](#openai-inside)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](#developing)
[![React 19](https://img.shields.io/badge/React-19-20232a?logo=react&logoColor=61dafb)](#developing)
[![Node ≥ 22](https://img.shields.io/badge/Node-%E2%89%A5%2022-339933?logo=node.js&logoColor=white)](#developing)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-f69220?logo=pnpm&logoColor=white)](#developing)

**English** · [简体中文](README.zh-CN.md)

<a href="https://youtu.be/FnUXFOv74Tg"><img src="https://img.youtube.com/vi/FnUXFOv74Tg/maxresdefault.jpg" alt="Worldlines: LivingCanvas — 1-minute film" width="720"></a>

*▶ [Watch the 1-minute film](https://youtu.be/FnUXFOv74Tg) — most of these 60 seconds are real gameplay.*

</div>

---

## What it is

Books let us read stories. Games let us play them. Chatbots let us talk to one character, alone, in a box.
**Worldlines lets you live in the world, with your character agents.**

- **One infinite canvas, three authors.** The player, a writer agent and a cast of character agents act in the same space. Characters stand on the canvas as entities, follow you between places, keep their own memory, act in real time and stay with you.
- **The world is a folder of Markdown.** Every place is a layer (map → harbour → office → drawer); every scene is a card (chalk narration, letters, props, doors, dice). Agents and players edit the same files; every change is an event. Anyone can write a world in a text editor, and the writer agent can grow one forever.
- **Point-and-click meets improv.** Drag a key onto a lock, roll a physical 3D die, open a door — and the writer agent writes the next place into existence as you walk in.
- **Call a character.** On a live voice line (GPT Live) the character delegates to its own backend agent: what it promises on the call is written into the world as an item, and it tells you what it did.

**SANDBOX + AGENTS + AI ROLEPLAY = LivingCanvas**

## What you see in the film

| | |
|---|---|
| **Fogwharf** | Investigate a harbour where ships vanish. A 3D dice roll decides the outcome, the writer agent writes a new place from your theory, and Vera — a character agent — agrees to come with you, in her own voice. |
| **First Snow** | A promise kept on the night of the first snow. Two routes, two different endings. |
| **Divergence** | Change one day in 1994, and the same street changes. |
| **GPT Live** | Call a character in real time; what he promises on the call is written into the world as an item. |
| **The writer agent** | also writes the game's rules and code as you play. |
| **Next** | bring your friends into the same story. |

One game ran **44 minutes** — until our API credits hit zero.

## Links

| | |
|---|---|
| 🎬 **1-minute film** | https://youtu.be/FnUXFOv74Tg |
| 🎞 Full film & gameplay recordings | https://youtu.be/pMtpObFnOug · https://youtu.be/ao9fL1g0Auc · https://youtu.be/lYuTEUDACMo |
| 💻 Code | https://github.com/LudicDynamics/hackathon |
| 📐 Design docs | [`docs/`](docs) (start at [`docs/00-文档骨架.md`](docs/00-文档骨架.md)); developer handbook [`AGENTS.md`](AGENTS.md). Most internal docs are in Chinese. |

## OpenAI inside

- **GPT Live** (`gpt-live-1`, WebRTC + client delegation) is the voice of every character. The voice front-end carries only identity and a delegation policy; anything that needs memory, judgement or an action goes to the character's backend agent, which runs a real turn and hands back its lines plus a spoken receipt of what it did — a full-duplex link to a living agent, not a chatbot with a voice.
- **GPT-5 family** runs the writer and character agents through our tool-calling runtime (`chalk`, `move`, `use_item_on`, `roll_dice`, `link`, `arrange`, …).
- **GPT Image** draws scene and prop art at play time (~10 s) when the writer invents a place with no picture yet.
- **GPT-4o-transcribe** is the player's voice input.
- A one-click **connection self-test** in Settings probes every model, TTS, STT and Live.

Nothing is scripted: every scene, reply and world change is authored at play time against a file-based world.

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
│   │   ├── src/engine/    # rpc-client, lifecycle, event-bridge, live-session, canvas arranger
│   │   └── src/routes/    # world management, declared actions, dice, TTS / STT / Live, god-mode API
│   └── web/               # React 19 + Tailwind + Vite canvas front end
│       └── src/
│           ├── components/canvas/     # infinite canvas, single transform, camera gestures, card projection
│           ├── components/narrative/  # ink chalk cards, status tables, choices, declared-action dialogs, 3D dice
│           ├── components/overlay/    # character close-up (6 expressions) + streaming galgame dialogue
│           ├── components/sidebar/    # right sidebar: backpack (player/) + characters (travel / talk / follow / call)
│           └── components/god/        # god-mode toolbar (world freeze + creation)
├── packages/
│   └── shared/            # WorldManifest (Zod), ChalkFrontmatter, WorldStore, actions, SQLite schema
├── extensions/            # the agents' tool face (chalk, move, roll_dice, link, arrange, …) on the pi-rp runtime
├── presets/               # prompt presets (writer, character, scene-init, nook-init, canvas-arranger)
├── templates/             # the seven canonical worlds, each in English / Japanese (-jp) / Chinese (-zh)
├── docs/                  # design docs (source of truth; start at docs/00-文档骨架.md)
├── tools/                 # scaffold, probes, the nine contract gates (check:*)
├── video/                 # the Remotion project behind the films
├── vendor/pi-rp/          # pi-rp agent runtime (git submodule)
└── AGENTS.md              # developer handbook (architecture, doc map, working rules)
```

---

## 🚀 Quick start

### 1. Build the whole repository
```bash
pnpm install
pnpm build
```

### 2. Keys
Copy `.env.example` to `.env.local` and fill in what you have: `OPENAI_API_KEY` (writer / character agents, GPT Image, GPT-4o-transcribe, GPT Live), optionally `DASHSCOPE_API_KEY` (online character voices) and a `DEEPSEEK_API_KEY` (alternative writer model). Models and auto-write policy can also be changed per world from the in-game **Agents** panel; **Settings → Connection test** tells you what works.

### 3. Run the health probe
```bash
pnpm probe
# "=== [AIRP Gate Probe] ALL CHECKS PASSED ===" means the whole chain is ready
```

### 4. Run the full stack locally
```bash
pnpm dev     # back-end API/WS on :3001 and the Vite canvas on :5173, together
```
Open **http://localhost:5173**, pick a world in the launcher, start a new game.

### 5. Scaffold your own world
```bash
node tools/scaffold.mjs --template first-snow-jp --out worlds/my-first-snow
```
A world is Markdown: edit the files under `worlds/my-first-snow/world/` and play.

### Windows: daily update and launch

With a local model configuration in place, double-click `Start-AIRP.cmd` in the repository root, or run `./Start-AIRP.cmd` in PowerShell.
To update, first run `git pull --ff-only --recurse-submodules`, then the script.
The script installs workspace dependencies, rebuilds pi-rp when its sources changed, builds the project and restarts this project's back end; the back end serves the page itself at **http://localhost:3001/**. Your model settings (`.env.local`, local files under `.pi/agent/`) and saves in `worlds/` are kept; launching never calls a model. Logs are in `.artifacts/local-server/`; `./Start-AIRP.cmd -NoBrowser` skips opening the browser.

### Worlds (English / Japanese / Chinese)

These canonical templates are tracked in Git, with scene READMEs, chalk cards, world skills, characters and their images / animations. After cloning, create a new game straight from the launcher — **no content-generation tool needs to run first**. Real AI play still requires configured model services.

| World | English | 日本語 | 中文 |
|---|---|---|---|
| Fogwharf · 雾坞镇 | [`wuwu`](templates/wuwu/) | [`wuwu-jp`](templates/wuwu-jp/) | [`wuwu-zh`](templates/wuwu-zh/) |
| Holmes: The Fourth Case · 福尔摩斯 | [`whitechapel`](templates/whitechapel/) | [`whitechapel-jp`](templates/whitechapel-jp/) | [`whitechapel-zh`](templates/whitechapel-zh/) |
| Divergence · 分歧线 | [`divergence`](templates/divergence/) | [`divergence-jp`](templates/divergence-jp/) | [`divergence-zh`](templates/divergence-zh/) |
| First Snow Radio · 初雪电台 | [`first-snow`](templates/first-snow/) | [`first-snow-jp`](templates/first-snow-jp/) | [`first-snow-zh`](templates/first-snow-zh/) |
| Magic Academy · 魔法学院 | [`magic-academy`](templates/magic-academy/) | [`magic-academy-jp`](templates/magic-academy-jp/) | [`magic-academy-zh`](templates/magic-academy-zh/) |
| The Unwritten Door · 未写之门 | [`unwritten-door`](templates/unwritten-door/) | [`unwritten-door-jp`](templates/unwritten-door-jp/) | [`unwritten-door-zh`](templates/unwritten-door-zh/) |
| The Moonlit Pact · 月下之誓 | [`moonlit-contract`](templates/moonlit-contract/) | [`moonlit-contract-jp`](templates/moonlit-contract-jp/) | [`moonlit-contract-zh`](templates/moonlit-contract-zh/) |

Plus [`exp`](templates/exp/), an experimental sandbox: one independent character (Elias) carrying his own memory database onto the canvas.

The English edition is the executable contract; the Japanese and Chinese editions share its IDs, paths, choices, dice and assets and differ only in text (checked by `pnpm check:worlds`). Older templates and playtest builds live, restorably, in `archive/templates/` and never appear as new-game entries.

---

## Developing

- `pnpm build` · `pnpm test` (shared / server / web: 1,180 tests) · `pnpm probe` (end-to-end engine chain)
- Nine mechanical gates pin the contracts: `pnpm check:merge`, `check:docs`, `check:ws`, `check:i18n`, `check:bodies`, `check:worlds`, `check:skills`, `check:voices`, `check:ux`.
- Read [`AGENTS.md`](AGENTS.md) before changing anything: it maps the docs, the frozen contracts and the working rules.

## How it was built

Not a line of code existed before the challenge. From the first Friday we built everything with **Codex** end to end — design, framework, engine, frontend, playability — as a Japan–France relay: one coded while the other slept, each morning started with a merge. All three of us ran out of Codex quota and finished on **Claude Code**. GPT Astra and Blender produced the dice.

Worldlines is the product of three of our papers — a CHI PLAY paper establishing the concept, an EC2026 (Japan) paper on multi-character play with a writer/world agent, and one on worlds that grow naturally through co-play — and our third harness engine, built on [pi](https://github.com/badlogic/pi) with GPT behind it.

## Third-party

[pi-rp](vendor/pi-rp) (our fork of Mario Zechner's `pi`, MIT) · React · Vite · TypeScript · Tailwind · Express · ws · zod · yaml · three.js · cannon-es · Remotion (video) · Google Fonts (LXGW WenKai, Caveat, DM Mono, Manrope) · audio credits in [`assets/audio/CREDITS.md`](assets/audio/CREDITS.md) · a self-hosted character voice fine-tuned on Fish Speech S2 Pro · Alibaba DashScope Qwen-TTS.

---

<div align="center">

Built by **[LudicDynamics](https://github.com/LudicDynamics)** — an agent-native AIRP company. From Tokyo, to the world.

</div>
