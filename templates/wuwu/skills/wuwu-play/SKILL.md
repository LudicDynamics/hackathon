---
name: wuwu-play
description: |
  All actions, movement, checks, generating, and revisits in this world must be read. Continuity and completion conditions of the world.
---

# World Execution Rules

This is play updating files for real. Do not declare success only by dialogue. First, read the action source, current location and its parent README, the intent, related physical items, character memory, and given previous visit history. README gives places and known exits. Chalk offers current choices and concrete generation intents. This skill keeps invariants of the world. Intent is instruction to the author, not a new engine command.

## Language and knowledge
Narration, titles, choices and generation prompts are English. Filenames, directories and character IDs stay stable lowercase English kebab-case; never use a display name as a path. Examples: world/harbor-chart/beyond-the-fog/lighthouse-road/README.md, player/introduction-letter.md, characters/nanami/memory.md. Preserve README.md, SKILL.md, world.json, preset.json and existing asset paths. Give new Chalk a stable English path and English title and body. Characters know only what they witnessed or were told. Never turn secrets the player has not encountered into memories in an epilogue.

## Completing Actions
Return one concrete change per choice. Items taken move, reading only does not move. README does not move. Do not treat characters as tools. Submissions are references, not consumptions. Confirm item paths and player meanings. Do not write unspoken inference, plans, or confessions just by pressing choices. Draft writing done only by player request and review.

Before execution, list files to create, update, or finally release. Write one piece of text mid-way but don’t end prematurely; reread all files. If unmet conditions or tool failure occur, report shortage and do not release. Retry reads existing results and fixes only missing parts. Avoid duplicate rewards and consumptions on double-click. Don’t create new world state files; record facts flatly in item texts and status.data.

## Checks
Before a roll, show target, needed items, why uncertain, formulas, success conditions, probabilities, normal and great success, failures and rare harm, and option to cancel in same Chalk. roll_dice must be multi-line YAML. Inline {type:...} doesn’t support writing back results. expect must be quoted. roll_dice is not called by submissions or entrances alone. Player rolls after seeing conditions; if conditions change, show again. Don’t decide truth or consent by dice. Don’t delete existing results to reroll free.


## Generating New Places
Create one child folder only within parent README and entry Chalk bounds. Searching a normal room doesn’t add towns. First write a visible one-liner at entrance, then README, two meaningful items, action Chalk, and gate returning to parent. If needed, make one item a note introducing a new inhabitant with name, job, and witnessable words. Do not create chat buttons for unregistered character IDs. Author will act such meetings.


Don’t treat existence of README alone as completion. Confirm child's README, two items, Chalk, and return gate; fix deficiencies if any. Do not redraw places or characters on revisits. After finishing text, call generate_image once only, requesting background matching actual place lighting, objects, time. Write returned real assets only to README’s bg. Image failure does not fail text. On failure, report picture missing, no auto retry. Remove old bgVideo if contradicting new picture. Completed text playable first. 1–2 is budget for directing, not speed guarantee.


## Fogwharf Truths and Short Reach
The ghost ship is a decoy. The lord’s ledger, old customs tunnel, and twelve minutes after lights-out link together. Old Mo does not know of the pursuing ship. Don’t turn Vera’s rudder clasp or Silver Kite’s empty box into easy confessions.


## Second Hybrid Check
Confirm two or more independent observations submitted at world/harbor-chart/02-two-wakes.md and method by content. Do not count duplicate records twice. Track item locations by move history. Record adopted evidence paths and brief reasons. If valid, create world/harbor-chart/03-lighting-terms.md with confirmation and choices. If no oil yet, guide to lighthouse. Don’t put dice accessible to all first.


Demo conditions:2d10, expect ">=11". Fog and rocking footing cause uncertainty. 2–4 fail at 6/100 (6%), losing one oil use. 5–10 fail at 39/100 (39%) without consumption; alternate observation can fix method. 11–17 succeed normally at 49/100 (49%), discovering second ship and safe shore path. 18–20 great success at 6/100 (6%), gaining introduction letter for next town help. Total success rate 55%. Check is for discovery success, not existing truth. Great success and engine crit (all max) differ.


Initial prompt places choices: “Prepare check with this condition,” “Return to investigation without rolling.” Upon approval, add same roll_dice multiline YAML to same Chalk; type "2d10", desc "Confirm beyond fog with spotlight", expect ">=11". Only approval waits for player dice; doesn't call roll_dice tool. Confirm oil remaining both in filename and text.


## Chalk That Keeps Going After the Dice Roll
1. When preparing the dice, update the same Chalk's choices to "Act on the dice result" and "Return to investigation." The text should say, "After rolling, proceed with choices here. On failure, check the clue at your feet; on success, look beyond the light," while preserving the four-level result above. The intent must reference this section and the source judgment world/harbor-chart/03-lighting-terms.md. This serves as the entry point for returning to the writer from existing choices. If only the dice roll is displayed, it need not wait indefinitely. If continuation is pressed without a result, briefly indicate the judgment hasn't happened yet; do not roll or consume anything.
2. On the writer's next action after reading the result, apply the published four-level results. Keep the dice result, expectation, and adopted evidence unchanged. Return to the same Chalk a brief note on actual damage and next possible actions in one or two sentences. Do not mandate long result texts, images, or scene changes. Reflect damage on real items immediately without waiting for images. Record in the judgment source's status.data flat values for rollOutcome (failure / success / great-success), oilLossApplied (true / false), and revealState (pending / revealed, only on success). These are for writer's record, not engine commands. Recheck real items and records; on resume from pauses, fix only deficiencies. Do not draw oil a second time for empty bottles.
3. For results 2–4, update player/lamp-oil.md text to reflect an empty bottle that lost one unit of oil, keeping a portable bottle. Briefly indicate, "The light cuts off; the bottle is empty. The ship is still not visible, but tidal traces at your feet can be read."
For results 5–10, do not reduce oil and state, "The fog repelled the light. Oil remains. Check from another angle."
Choices remain "Compare tide marks and journal" and "Consult Vera about the method." The investigation does not simply end with failure or continuation. Do not keep the pre-judgment-only choice "Return to investigation without rolling" as the only choice post-judgment.
4. "Compare tide marks and journal" requires no kerosene or re-roll. Match the already-read water level traces with the lighthouse journal and guide to specific known lacking records. Once matched, write in world/harbor-chart/tide-route-note.md the next point to confirm on the old customs side, generating a Chalk for that walk. Do not mention a discovered safe shoreline path, issue no letters of introduction or notifications about a second ship or new town yet. Only when the player chooses this walk can a small investigation scene world/harbor-chart/tidal-approach/ be generated. This is a spot to examine footing and tide traces, distinct from a success-only shortcut. Provide README, two objects, choice Chalk for next observation, and a return path to the harbor, allowing continued investigation. Do not substitute failures with free successes, or restore lost oil. Consulting Vera handles actual method adjustments; do not use it to erase the same result.
5. For results 11–17 and 18–20, set revealState: pending and place a brief note like "The light caught an outline. You can approach and verify" plus choices "Check beyond the light" and "Return to investigation." Results 18–20 may briefly note that clues leading to contact await. Do not generate immediate full discoveries, subfolders, background generations, or letters of introduction at this stage. Do not auto-switch camera or scenes even on great success.
6. Only the successful judgment source's "Check beyond the light" or a prepared "Act on the dice result" pressed post-success opens the full discovery. "Return to investigation" clears any unprocessed damage but keeps success pending for later selection. On click, re-read the same result and disclosure conditions to generate a short punch line about a second ship emerging from the fog, world/harbor-chart/beyond-the-fog/README.md, two objects, a "Follow the shore path" Chalk, and harbor return path. Only for results 18–20 create a letter player/introduction-letter.md noting contacts based on current evidence. Do not give this extra reward for 11–17. Record revealState: revealed after confirming existence. Re-click directs to the same entry; fix only deficiencies on mid-failure. Follow the "When generating a new place" procedure above; complete the text first. Generation for 1–2 starts here. Do not auto-enter when complete; let the player choose the entrance.

## Beyond the Fog
The world does not end here. Only when "Follow the Shore Path" is chosen, generate a new path and town entrance beneath world/harbor-chart/beyond-the-fog/ with a stable English directory ID and English title. Include README, two objects (one may be a local resident), Chalk, return path, and one background image. Actual letters of introduction affect concrete cooperation. Do not create the entire next town at once. Do not preemptively create this success entrance after immediate failures or unclicked successes.

## Confirmed Operations and Separation from the Writer (Current)
choice_actions declare implemented UI operations corresponding to English IDs in choice.options. Only use read(paths), take(paths), stage(paths), enter(target), character(character), reply(text), and writer(prompt optional). Do not activate the writer for reading, carrying, returning to existing scenes, arranging materials, or brief dice result displays. stage checks materials only; it does not submit or execute. Use writer only for generation, free RP, and executing undecided promises or strategies. Open dialogs for questions using character action; do not send lines arbitrarily.
Attach IDs and choice_actions to each choice in newly generated Chalk. Do not make reading or return journeys vague writer choices. Declare future material paths as existing reads only. Do not write undefined actions, scripts, or imaginary APIs. UI declarations are determined operations; the writer does not duplicate executions.

## Dice-Assisted Decoding (Current, Parallel with Manual Solving)
Each investigation site and map's 04-investigation-dice.md represents a route where the character links observations on behalf of the player. The real player does not need to explain the correct answer. Map judgments can be directly selected; each site's judgment is not a mandatory sequence. The truth is fixed; the dice roll changes the method, cost, and leeway of discovery. dice_outcomes reflect the four-level short result and next choice_actions in the existing action layer in the same file. The writer does not double-reflect, re-judge, or add charges.
This route does not mandate "two independent pieces of evidence" or "two inference and planning documents". Those old rules apply to manual submission routes only. Even low dice results provide footholds and next actions. Writers generate new scenes or endings only if requested explicitly from map results. Do not treat undiscovered characters as already spoken; distinguish between readable inferences and conversation records. Do not treat generation waits as dice failures.

## Clear Guidance
Text for players should be brief and use everyday language. Scenes convey "what happened" and "what you can do now." Clues present "facts understood → possible conclusions → next places to check" in order. Separate fact and speculation without attaching lengthy warnings to every sentence. Replace difficult words. Do not hide objectives or operations behind atmosphere metaphors. New dice have only 1d10, 2d10, and 1d100. This investigation card uses 2d10; success thresholds are 11 or higher and four stages: 2–4/5–10/11–17/18–20. Do not increase explicit costs; show next actions even on failure.
