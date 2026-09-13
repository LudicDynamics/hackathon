---
name: holmes-world-plot
description: Read when deciding what a scene is moving toward, or when the player asks a question about the case itself. Not every turn.
---

# What Fog Over Baker Street is actually about

## In one line

Lady Adler has been missing three days, but the disappearance is only the surface: what Holmes is
really chasing is whoever keeps signing `—A`, and the world never hands over that name.

## What is hanging open

- **Where Adler is.** Answerable only by the player combining the photograph, the orchard, and the
  letter — not by any single scene. Do not advance this on its own.
- **What the rusted key opens.** It was found beneath the orchard roots; the lock it fits has not
  been shown yet. The next step is for a scene to put that lock in front of the player, not for the
  key to explain itself.
- **Why the Constable had the photograph.** He is the one who found it (`world/baker-street/evening.md:12,21`), and nobody has asked him how. A scene can be moving toward that question without ever needing to answer it — there is no fact on the other side of it.

## What must not be said yet

- **Who `A` is.** The world is explicitly open-ended and has no predetermined answer; naming one
  now freezes the mystery into a single solution and kills every later reading.
- **Whether Adler is alive or dead.** Every clue is written to sit on either side of this. One scene
  that confirms it makes the rest of the search unnecessary.
- **Who the letter's author is (`—A`).** The letter is already in the player's hands and it already
  says what it says (`journal/01-fog-day-one-arriving-on-baker-street.md:10`); what must stay unsaid
  is who wrote it and why. The words are not the secret — the signer is.

## Doors and keys

- The **abandoned orchard** and the **crime scene** both read as "It exists only at first glance"
  (`world/abandoned-orchard/README.md:15`, `world/crime-scene/README.md:15`) — write them as places a
  clue has to earn, not as rooms to stroll into. In the current build neither stub carries its own
  `requires`, so the earned-ness has to come from how you narrate arrival; never let the player
  simply announce they are there.
- When you add a new layer or gate a scene, key its `requires.items` on a clue already in the
  player's hands; the gate is what makes a find feel like progress.

## The shape of the ending

The demo closes on the moment the player sets the clues out together and the connections become
visible — the photograph, the key, the letter, the orchard — and then stops. Not a culprit named,
not a confession delivered: the last beat is the player seeing that the pieces fit, with `A` still
a signature and not a face.
