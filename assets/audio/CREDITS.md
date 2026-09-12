# Audio Credits

All tracks in this directory are **royalty-free** and were sourced via the
`search_audio` tool (Pixabay Music / Freesound previews). Every selected track
is **CC0 1.0 (Public Domain Dedication)** — no attribution is legally required,
but the provenance is recorded here for reproducibility.

Files were re-encoded to **128 kbps MP3, 48 kHz** and trimmed/faded for seamless
use as game loops. The original upstream preview URLs are preserved below.

## BGM — `bgm/` (3 moods, crossfaded by writer mood tag: `calm` / `tense` / `crisis`)

| File | Mood | Title | Artist | Source ID | Duration | License | Origin URL |
|---|---|---|---|---|---|---|---|
| `bgm/calm.mp3` | calm | Piano Song Loop #4 Childhood | Kleber_KGF | 355071 | 36.7s | CC0 1.0 | https://cdn.freesound.org/previews/355/355071_6567189-hq.mp3 |
| `bgm/tense.mp3` | tense | Dark Atmospheric Drone (Time-Stretched, Seamless Loop) | kkenny101 | 865550 | 158.4s (trimmed) | CC0 1.0 | https://cdn.freesound.org/previews/865/865550_17997500-hq.mp3 |
| `bgm/crisis.mp3` | crisis | Fight Music Synth Tense Loop | SnowFightStudios | 676998 | 97.3s | CC0 1.0 | https://cdn.freesound.org/previews/676/676998_12064174-hq.mp3 |

## Ambient — `ambient/` (3 scene beds, crossfaded on layer change)

| File | Tone | Title | Artist | Source ID | Duration | License | Origin URL |
|---|---|---|---|---|---|---|---|
| `ambient/rain.mp3` | rain | Forest Rainstorm 01 | rifualk | 648474 | 60s (trimmed from 697s) | CC0 1.0 | https://cdn.freesound.org/previews/648/648474_2968542-hq.mp3 |
| `ambient/fireplace.mp3` | fireplace | Fireplace crackling wood little flame | BonnyOrbit | 484338 | 60s (trimmed from 124s) | CC0 1.0 | https://cdn.freesound.org/previews/484/484338_5902878-hq.mp3 |
| `ambient/cellar-drip.mp3` | cellar-drip | Water Dripping in Cave | Sclolex | 177958 | 60s (trimmed from 90s) | CC0 1.0 | https://cdn.freesound.org/previews/177/177958_985466-hq.mp3 |

## Notes

- **Selection rule**: CC0 preferred over CC-BY, and CC-BY-NC avoided entirely —
  this repo is a public hackathon artifact and the demo may be shown commercially.
- **Why not the assets repo's own audio?** `worldlines-assets/` contains only
  images (375 PNG / 15 JPG); it had no audio. These files are the first audio
  produced for it.
- **Runtime status**: `apps/web/src/lib/audio.ts` still synthesizes placeholder
  drones with Web Audio. Wiring these files in (`lib/audio.ts` → Howler/sample
  playback with the synth as fallback) is a separate follow-up.
