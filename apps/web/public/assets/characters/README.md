# Character Portrait Assets — Notes

> Collected: 2026-09-10
> Purpose: AIRP's "large avatars" (the character tab in the right sidebar) and "half-body portraits" (split-screen left/right inside the dialogue overlay)
> Reference prototype: the `DLG_ASSETS` structure in the v1 canvas prototype (in the `infini-canvas` project)

## Download Results

Successfully downloaded **35 PNG portrait images** (27 under `portraits/` + 8 under `maid/`) and **3 original archives**, roughly 40MB in total.

## Directory Structure

```
assets/characters/
├── portraits/                  # Half-body portraits (used by the dialogue overlay)
│   ├── portrait25_puck.png     # Old Zhou (innkeeper) — already used in the prototype
│   ├── portrait21_sara.png     # Regular patron — already used in the prototype
│   ├── portrait24.png          # LPC anime portrait
│   ├── portrait26.png          # LPC anime portrait
│   ├── LPCportrait1~11.png     # Generic LPC anime portrait set (11 images)
│   ├── Innkeeper_01~08.png     # Innkeeper character (8 separate expression images)
│   ├── fella_1.png / fella_2.png   # Male character portraits (Portrait Pack)
│   ├── lady_1.png / lady_2.png     # Female character portraits (Portrait Pack)
│   ├── maid/                   # Maid character (8 expressions split into PNGs)
│   ├── portraits_pack.zip      # Original Portrait Pack archive (4 characters)
│   ├── Innkeeper.zip           # Original JS Actor Innkeeper archive (includes PSD / Faceset / multiple sizes)
│   ├── maid_portrait.zip       # Original Cute Maid Portrait archive
│   └── avatars/                # Reserved: large avatars (for circular cropping, not yet filled)
└── README.md                   # This file
```

## License Summary

All assets come from **OpenGameArt.org** under **CC-BY 3.0** or compatible licenses; free for commercial use (attribution required).

| Asset | Author / Source | License | Use |
|------|-----------|------|------|
| Sara / Trevor / Puck anime portraits | RPG Action / ZeNeRIA29 | CC-BY 3.0 | Dialogue overlay portraits (already used in the prototype) |
| Anime Portrait for LPC characters | William.Thompsonj / ZeNeRIA29 | CC-BY-SA 3.0 | Generic NPC portraits |
| JS Actor - Innkeeper | JosephSeraph | CC-BY 3.0 | Old Zhou (innkeeper) character portrait |
| Portrait Pack (4 characters) | Calciumtrice | CC-BY 3.0 | Generic male/female character portraits |
| Character Portrait ~ Maid | Anonymous | CC-BY 3.0 | Maid-style character |
| Character Portrait ~ Bandit | Anonymous | CC-BY 3.0 | Male bandit character |

**Attribution requirement**: when using them, credit "Portrait graphics created by [author name]" (the link is optional).

## Asset Mapping (suggested character assignments)

Based on the `DLG_ASSETS` config format, here are suggested uses for the downloaded assets:

| Character | Asset file | Description | Size |
|--------|----------|------|------|
| **Old Zhou** | `portrait25_puck.png` or `Innkeeper_*.png` | Innkeeper / middle-aged man | 900x760 |
| **Regular Patron** | `portrait21_sara.png` | Young female character | 900x760 |
| **Character A** | `LPCportrait1.png` ~ `LPCportrait11.png` | 11 generic LPC anime portraits | 900x760 |
| **Innkeeper (detailed)** | `Innkeeper_01~08.png` | Innkeeper with 8 expressions (layered PSD) | ~700x700 |
| **Maid** | `maid/` directory | Maid with 8 expressions (Neutral/Happy/Sad/Angry/Blush/Confused/Cover) | separate PNGs |
| **Male character** | `fella_1.png`, `fella_2.png` | Portrait Pack male | 1200x1200 |
| **Female character** | `lady_1.png`, `lady_2.png` | Portrait Pack female | 1200x1200 |

## Integrating Into the Prototype Code

See the `DLG_ASSETS` structure in the v1 canvas prototype (`infini-canvas` project):

```js
const DLG_ASSETS = {
  'Old Zhou': { sheet: 'assets/characters/portraits/portrait25_puck.png',
           faces: { normal: [0,0], smile: [50,100], angry: [100,100] } },
  'Regular Patron': { sheet: 'assets/characters/portraits/portrait21_sara.png',
           faces: { normal: [0,0], smile: [0,100], laugh: [50,100], pout: [100,100] } },
  // Add more characters in this format...
};
```

The large avatars (`avatars/`) are used for the circular avatar display in the right sidebar's character tab; crop or scale them from the portraits above into 64x64 circles.

## Assets Not Downloaded

The following were found during the search but not downloaded because the links were dead or they required payment:
- `Character Portrait ~ Bandit` (OGA 404, needs a new link confirmed)
- `portrait28.png`, `portrait29.png` (OGA 404)
- Miki/Kana/Kousei/Aiko/Hoshiko and other character sprites on itch.io (free, but must be downloaded manually from itch.io)
- `Mysterious Man`, `Priest portrait` (OGA links changed)

These can be downloaded manually later as needed.

## File Inventory

```
portraits/ directory (35 PNGs + 3 ZIPs + maid subdirectory):
  Innkeeper_01.png  ~ Innkeeper_08.png    (each ~480KB, separate expressions)
  LPCportrait1.png  ~ LPCportrait11.png   (each ~250-350KB)
  portrait21_sara.png  (404KB)
  portrait24.png       (304KB)
  portrait25_puck.png  (296KB)
  portrait26.png       (260KB)
  fella_1.png         (1.8MB)
  fella_2.png         (2.0MB)
  lady_1.png          (2.4MB)
  lady_2.png          (2.1MB)
  maid/ (8 expression images, each ~172KB)
  portraits_pack.zip  (8.4MB)
  Innkeeper.zip       (13.2MB)
  maid_portrait.zip   (1.2MB)

avatars/ directory: empty, awaiting large avatars (crop from portraits)
```
