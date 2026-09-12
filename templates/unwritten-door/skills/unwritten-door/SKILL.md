---
name: unwritten-door
description: Run The Unwritten Door opening; use for any envelope, phone, cabin, or first-door action in this world. Preserve discovered context and instantiate the outside only when the player opens the door.
---
# The Unwritten Door

Read world/README.md, world/letter.md, world/phone.md, and world/door.md before resolving an opening action. Read the latest player event supplied by the server. The files' Context sections are public discovered facts, not hidden lore.

## Envelope

Only "Open the envelope" reveals the contents. Looking closely at its exterior must not open it. On the first opening, invent one short, concrete contemporary message with a place or person and an unresolved personal stake. Write the actual letter into world/letter.md, replace its Context with what was revealed, set status.data.opened to true, and remove the opening choice. Keep visual: envelope. Subsequent reading preserves the same message verbatim. Do not establish a final explanation for the cabin.

## Phone

"Wake the screen" reveals a small amount of plausible screen information, not a completed conversation. "Call the last number" creates a brief live exchange with a person outside; preserve earlier discoveries, name one concrete audible or spoken detail, and leave the caller's motives uncertain. Write the actual exchange and confirmed information into world/phone.md, set status.data.contacted to true only after contact, and update its choices for the next beat. Keep visual: phone. Never claim real telephone contact: all calls are fictional scene events.

## Door

1. Read world/letter.md and world/phone.md again. If world/outside/README.md exists, read and continue that place; never reroll or overwrite it on re-entry.
2. If it does not exist, write a short threshold chalk in world/ showing the player turning the handle. Read both Context sections to determine the outside. Unopened envelope and unused phone contribute no concealed facts. With neither explored, freely invent a contemporary place consistent with a cabin. An opened letter constrains the place. A completed phone call must have its concrete details reflected outside. If both occurred, honor both; uncertainty about motives may remain.
3. Write world/outside/README.md with type: readme and name; write two meaningful scene objects and a short opening chalk in that directory. Add one gate back to map. Leave room for further discovery, not a completed branching campaign. Do not introduce fantasy merely because facts are absent.
4. Once the text scene exists, call generate_image once for an empty cinematic background of that exact place. Include no UI, text, envelope, or phone in the picture. On success, edit only the README bg field to the returned asset path. On failure leave the text playable and do not invent an asset or retry this turn.

## Every turn

Write one concise chalk response to the player's action, under the correct directory. Update the source prop before starting the next action. Do not create extra investigative props in the cabin. Do not add a predetermined culprit, world-selection menu, or character-creation form. All player-visible prose is English. Use native write/edit for files and AIRP chalk for narration; do not use shell commands to mutate the world.
