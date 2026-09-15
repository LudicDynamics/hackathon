# OpenAI x Tokyo AI — 100-Hour Game Challenge · Submission draft (Worldlines)

**Email**: nikoloside@gmail.com
**Team or Solo**: Team
**Team name**: Ludic Dynamics
**Members** (one per line — fill real names):
- Yuhang Huang (niko) — product / design / worlds / voice & audio
- yoshi — engine / agent runtime / canvas
- Sunjian Fang — infra / local TTS
**Track**: Track 1: AI-Native Game Prototype
**Project title**: Worldlines — live in a story with your character agents
**Demo URL**: https://ludic-test.xvps.jp/airp-infini-canvas/
**Repository URL**: https://github.com/LudicDynamics/hackathon
**Demo video URL**: 〈待上传，≤1 分钟〉

---

## Project description (≤200 words)

Worldlines is an AI-native narrative game: one infinite canvas where you, a writer agent and a cast of character agents share the same world — and the world is just a folder of Markdown files.

Every place is a layer (map → harbour → office → drawer). Scenes are cards on the canvas: chalk narration, letters, props, doors, dice. You drag a key onto a lock, roll a physical 3D die, open a door and the writer agent writes the next place into existence as you walk in. Characters are present on the canvas; click one and a galgame-style dialogue opens, or call them on a live voice line and they act inside the world while you talk.

Seven playable worlds ship in English, Japanese and Chinese — a fog-bound harbour mystery, a first-snow radio romance with two endings, a 1994 time-fork, a Holmes case, a magic academy, a moonlit pact and a door that writes itself — plus a world launcher, saves, per-world settings and layered audio.

It is for people who want to live inside a story instead of reading or chatting to one — and for authors: a world is files, so anyone can write one.

## Judging criteria 1 — Meaningful use of OpenAI tools (≤200 words)

- **GPT Live (gpt-live-1, WebRTC + client delegation)** is the voice of every character. The voice front-end only carries identity and a delegation policy; anything that needs memory, judgement or an action in the world is delegated to the character's backend agent, which runs a real turn (moves items, writes scenes, rolls dice) and hands its lines back through `session.commentary.append`, plus a spoken receipt of what it actually did. The call is a duplex link to a living agent, not a chatbot with a voice.
- **GPT-4o-transcribe** is the player's voice input into the writer.
- **GPT-5 / GPT-4.1 family** run the writer and character agents through our tool-calling runtime (chalk, move, use_item_on, roll_dice, link, arrange…), with per-world model settings.
- **OpenAI image generation (gpt-image)** draws scene and prop art on demand when the writer invents a place that has no picture yet.
- **A one-click connection self-test** probes each model, TTS, STT and Live from the settings panel.

Why it matters: the game has no scripted branches. Every scene, reply and world change is authored at play time by these models against a file-based world — the OpenAI stack is the engine's authoring layer, not a bolted-on feature.

## Judging criteria 2 — Originality (≤200 words)

1. **Files are the world.** There is no hidden game state: a world is a directory of Markdown with frontmatter (`type: gate`, `choice_actions`, `dice_outcomes`, `requires.items`). Agents and players edit the same files; every change is an event. Anyone can write a world with a text editor, and the writer agent can grow one forever.
2. **One canvas, three authors.** Player, writer agent and character agents act in the same space. Characters are physically present on the canvas, follow you between layers, have a "nook" of their own, and can be called on a live voice line while you keep exploring.
3. **Point-and-click meets improv.** Declared actions (enter / read / take / stage / character) resolve instantly and deterministically; free choices go to the writer. Dice are real dice — the server rolls, a 3D die tumbles, and outcome bands write persistent reward cards.
4. **A layered infinite canvas** instead of a chat log: zoom from a harbour map into a drawer, with parallax, particles and chalk that flips ink and frame with the backdrop.

AI games give you one character in a box; visual novels give you fixed branches. Worldlines gives you a place to live in.

## Judging criteria 3 — Playability / Utility (≤200 words)

It is playable now, in a browser, at the demo URL (five concurrent seats). Seven worlds × three languages are shipped as templates; each starts from a launcher tile into a save you can return to.

A typical Fogwharf session: read the commission, take the badge, cross the harbour map, roll to search a berth, drag the badge onto the lighthouse keeper, ask Vera to come along, share a theory, and watch the writer agent write the next dock into the world. Our own playtest ran 44 minutes without a scripted end — it stopped when the API credits did.

Beyond the games, the same stack is a usable authoring tool: worlds are Markdown, so the six shipped worlds were produced in the 100 hours by writing files and letting the writer agent fill gaps. A per-world settings panel controls models, auto-write policy and voices; a connection self-test catches a dead key before a session starts.

Known limits: turn latency depends on the model (5–20 s per writer turn), live voice needs an OpenAI key with Live access, and the canvas arranger is a single-flight background agent.

## Judging criteria 4 — Execution and craft (≤200 words)

- **Engine**: pnpm monorepo — Express + WebSocket server, React 19 / Vite canvas, a shared package with the world model, action services and SQLite-backed canvas/history stores. Agents run as isolated RPC processes on a tool-calling runtime with per-role tool sets and a serialized, revision-guarded write path (no two agents can commit the same seat).
- **Contracts as code**: nine mechanical gates (`check:merge/docs/ws/i18n/bodies/worlds/skills/voices/ux`) pin the WS frame contract, request bodies, i18n coverage of 452 keys, the seven worlds' structure, and 24 UX-contract rules. 1,180 tests pass across shared/server/web.
- **Presentation**: 2.5D parchment canvas with parallax and particles, hand-written chalk, 3D physics dice with a reveal gate so results never leak before the ceremony, six-emotion character portraits, layered audio (ambient, BGM, foley, stingers) with loudness-normalised tracks, and a glass "brick wall" world launcher with per-world intro videos.
- **Polish**: three-language worlds and UI, saves and rollback, focus/escape discipline across every overlay, reduced-motion support, and a settings panel with local-only connection tests.

Everything above was built in the 100-hour window on top of the listed open-source components.

## Pre-existing code, open-source components, datasets, third-party tools (≤200 words)

- **pi-rp** (our fork of Mario Zechner's `pi` coding-agent monorepo, MIT) — the agent RPC runtime the writer/character/arranger agents run on; vendored as a submodule.
- Runtime/libraries (all MIT unless noted): React, React DOM, Vite, TypeScript, Tailwind CSS, Express, ws, cors, zod, yaml, three.js, cannon-es, lucide-react, clsx, tailwind-merge; Remotion (Remotion licence, free for individuals/small teams) for the demo video; edge-tts for the video's temporary narration.
- Fonts via Google Fonts: LXGW WenKai, Caveat, DM Mono, Manrope (SIL OFL).
- Audio: CC-BY 4.0 tracks credited in `assets/audio/CREDITS.md`; foley/ambient from CC0 sources; the launcher theme is our own Suno-generated track (not redistributed).
- Model/API services: OpenAI (GPT Live, GPT-4o-transcribe, GPT-5/4.1, gpt-image), DeepSeek (optional writer model), Alibaba DashScope Qwen-TTS (online character voices), a self-hosted local TTS for one character.
- Art: scene backgrounds, portraits and intro clips were generated during the build period with image/video generation tools (Stable-Diffusion-based pipelines and Seedance) from our own prompts.
- Pre-existing: an earlier internal infinite-canvas prototype (retired 2026-09-11) contributed design documents only; all game code was written during the build period.

**Submission confirmation**: ✅ We confirm…
