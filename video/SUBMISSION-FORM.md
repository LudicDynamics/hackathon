# OpenAI x Tokyo AI — 100-Hour Game Challenge · Submission draft (Worldlines)

**Email**: nikoloside@gmail.com
**Team or Solo**: Team
**Team name**: Ludic Dynamics
**Members** (one per line — fill real names):
- Yuhang Huang (niko)
- yoshi
- Sunjian Fang
**Track**: Track 1: AI-Native Game Prototype
**Project title**: Worldlines — live in a story with your character agents
**Demo URL**: https://ludic-test.xvps.jp/airp-infini-canvas/
**Repository URL**: https://github.com/LudicDynamics/hackathon
**Demo video URL**: 〈待上传，≤1 分钟〉

---

## Project description (≤200 words)

Worldlines is a playable agent world: an infinite canvas where you, a writer agent and a cast of character agents live in the same continuously simulated world — and that world is just a folder of Markdown files. Play it casually, or design a world with care; six worlds ship prebuilt.

It is for anyone who wants to live alongside their own characters in a world that responds. Characters are not chat windows: they stand on the canvas as entities, follow you from place to place, keep their own memory, act in real time and stay with you. You can talk to a character, watch her act inside the world, or change the world yourself — through the writer agent or through interactive components (props, doors, dice, letters).

The result is an immersive, endlessly expanding world that is generated and maintained by AI yet belongs to you and your companion — a harbour explored together with Vera, and whatever comes after the fog.

The same engine makes it simple to create and play complex RPG worlds, romance/companion simulators, and detective or puzzle games.

## Judging criteria 1 — Meaningful use of OpenAI tools (≤200 words)

The core of the project is a **full-duplex GPT Live character environment**. We built an agent runtime that is natively matched to our world: the voice front-end (gpt-live-1, WebRTC + client delegation) carries only identity and a delegation policy; anything needing memory, judgement or an action is delegated to the character's backend agent, which runs a real turn (moves items, writes scenes, rolls dice) and hands back its lines plus a spoken receipt of what it did. So a character on a call is a living agent that changes the world with you — not a chatbot with a voice.

- **GPT Image** generates scene and prop art for the interactive game at play time, in about 10 seconds, whenever the writer invents a place that has no picture. When GPT offers real-time video, the same seam becomes real-time animation.
- **GPT-5 family** runs the writer and character agents through our tool-calling runtime (chalk, move, use_item_on, roll_dice, link, arrange…).
- **GPT-4o-transcribe** is the player's voice input.
- **GPT Astra + Blender** produced the 3D dice model.

Nothing is scripted: every scene, reply and world change is authored by these models against a file-based world.

## Judging criteria 2 — Originality (≤200 words)

Worldlines is the product of three of our papers: a CHI PLAY paper establishing the concept; an EC2026 (Japan) paper on multi-character play with a writer/world agent; and one on worlds that grow naturally through co-play. All three land here.

New for this hackathon:

1. **One canvas, multiple authors.** Player, writer agent and character agents act in the same infinite canvas, not a chat log. Characters are physically present, follow you between layers, have places of their own, and can be called on a live voice line while you explore.
2. **Our own harness engine** — our third: the first lived in the paper, the second in our shipping product; this one is built on pi with GPT behind it, specialised for world evolution, simulation and character operation.
3. **Chalk**, the narrative tool at the centre of the design: the writer's words live on the canvas as objects.
4. **Files are the world.** No hidden state; anyone can write one in Markdown.

Chatbots give one character in a box; traditional games give a field that needs programmers and cannot react in real time. Worldlines gives characters that truly live in — and change — the field, near real time.

## Judging criteria 3 — Playability / Utility (≤200 words)

Playable now, in a browser, at the demo URL (five concurrent seats). Seven worlds × three languages ship as templates, each a launcher tile into a save you can return to.

Four samples show the range: **Fogwharf**, a harbour mystery — take the badge, roll to search a berth, ask Vera along, share a theory, and the writer agent writes the next dock into the world; **First Snow**, a romance simulation that keeps generating new scenes for real-time role-play with the character; **Divergence**, a time-fork across parallel timelines; and **Holmes: The Fourth Case**, detective play. Beyond these the engine is open-ended — whatever you imagine, it can host.

We got hooked ourselves: one of us burned $60 of credits on images and story in Fogwharf and played 45 minutes straight; another spent consecutive all-nighters immersed in building his own world.

The practical value is the engine: a unique world simulator that agents and players share.

Known limits: no separate authoring tool yet — you create while you play, not in a linear pipeline; a turn takes 5–20 s; live voice works but is not as polished as we want under current OpenAI limits; no multiplayer. Those are our next focus.

## Judging criteria 4 — Execution and craft (≤200 words)

We polished the whole stack: a complete harness engine (isolated agent processes on a tool-calling runtime, per-role tool sets, serialized revision-guarded writes) and every frontend component. We defined the framework end to end — file-system world model, fallbacks, chunking, WS frame contract — and built it as code: nine mechanical gates and 1,180 passing tests pin the contracts, request bodies, i18n (452 keys, three languages), the seven worlds' structure and 24 UX rules.

Every modality was fitted in with care: a 2.5D parchment canvas with parallax and particles, hand-written chalk, 3D physics dice with a reveal gate, six-emotion portraits, layered audio (ambient, BGM, foley, stingers), a glass world launcher with intro videos, saves and rollback, reduced-motion support — and UI/UX passes over every overlay so the play loop feels good in all three languages. We played it ourselves throughout — 45-minute sessions, all-nighters building worlds — and fixed every painful moment of play as we hit it.

Not a line of code existed before the challenge. From Friday we built everything with Codex end to end — design, framework, engine, frontend, playability — switching to Claude Code when Codex quota ran out. GPT Astra and Blender produced the dice.

## Pre-existing code, open-source components, datasets, third-party tools (≤200 words)

- **pi-rp** (our fork of Mario Zechner's `pi` coding-agent monorepo, MIT) — the agent RPC runtime; vendored as a submodule.
- Runtime/libraries (MIT unless noted): React, React DOM, Vite, TypeScript, Tailwind CSS, Express, ws, cors, zod, yaml, three.js, cannon-es, lucide-react, clsx, tailwind-merge; Remotion (Remotion licence) for the demo video; edge-tts for the video's temporary narration.
- Fonts via Google Fonts: LXGW WenKai, Caveat, DM Mono, Manrope (SIL OFL).
- Audio: CC-BY 4.0 tracks credited in `assets/audio/CREDITS.md`; foley/ambient from CC0 sources; the launcher theme is our own Suno-generated track (not redistributed).
- **Local TTS**: a self-hosted voice fine-tuned by us on an open-source TTS model, 〈模型名, licence〉, trained on our own recordings — used for one character; other voices use Alibaba DashScope Qwen-TTS.
- Model/API services: OpenAI (GPT Live, GPT-5, GPT-4o-transcribe, GPT Image, GPT Astra), DeepSeek (optional writer model), Vercel AI Gateway.
- Art: scene backgrounds, portraits and intro clips generated during the build period with image/video generation tools (Stable-Diffusion-based pipelines and Seedance) from our own prompts; dice modelled with GPT Astra + Blender.
- Pre-existing: an earlier internal prototype contributed design documents only; all code was written during the build period.

**Submission confirmation**: ✅ We confirm…
