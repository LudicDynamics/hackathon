export * from './schemas/world.js';
export * from './schemas/agent-settings.js';
export * from './schemas/world-settings.js';
export * from './schemas/frontmatter.js';
export * from './schemas/components.js';
export * from './schemas/events.js';
export * from './schemas/canvas.js';
export * from './store/world-store.js';
export * from './store/local-store.js';
export * from './schemas/forms.js';
export * from './store/layers.js';
export * from './db/schema.js';

// Init (I1) rules. Same no-glob discipline as below: a missing line is a silent
// unreachable module. These are consumed by the server routes and the `airp-init`
// extension command.
export * from './rules/characters.js';    // isValidCharacterId / nookIdOf / characterIdOfPath (docs/nook/00 §5.2)
export * from './rules/emptiness.js';     // isLayerEmpty / isNookEmpty / hasInitProduct (docs/init/00 §3.1)
export * from './rules/init-fallback.js'; // w2SceneTemplate (docs/init/00 §3.3)
export * from './rules/voices.js';       // resolveVoice / VOICES / voiceEntry (docs/tts/07)
export * from './rules/emotions.js';     // EMOTIONS / Emotion / isEmotion / emotionPortraitsOf (docs/assets/00 §3.1)

// Action layer public surface (01 §8). Extensions import the whole barrel from
// `shared/dist/index.js`, so anything they call MUST be exported here.
export * from './actions/types.js';
export * from './actions/errors.js';
export * from './actions/actor.js';
export * from './actions/service.js';
export * from './actions/refs.js';
export * from './actions/canvas.js';
export * from './actions/image-provider.js';
export * from './actions/generate-image.js';
export * from './rules/dice.js';
export * from './rules/interactive.js';
export * from './actions/roll-dice.js';
export * from './components/index.js';
export * from './actions/component.js';
export * from './actions/show.js';
export * from './actions/choose.js';
export * from './actions/move.js';
export * from './actions/delete.js';
export * from './actions/presence.js';
export * from './actions/move-to.js';
export * from './actions/look-at.js';
export * from './actions/following.js';
export * from './actions/use-item.js';

export * from './actions/chalk.js';
export * from './actions/create.js';
export * from './actions/layer.js';
export * from './actions/talk.js';

// B2/B3 injection surface. TS `export *` has no glob, so every new module MUST
// be added here by hand — a missing line is a SILENT unreachable module
// (docs/hooks/00 §15). This block is the single authoritative union.
export * from './render/spatial.js';      // dirPhrase (02 presencePhrase dep; extension + web share it)
export * from './render/layer-page.js';   // summaryOf / kindWordOf / renderLayerBlock
export * from './render/state.js';        // Section / renderState / STATE_* (01)
export * from './render/sections.js';     // WRITER_SECTIONS / CHARACTER_SECTIONS / sectionsFor / SECTION_CAPS (02)
export * from './render/events.js';       // renderEventWindow / EventWindowLine (03)
export * from './render/next-step.js';    // computeNextStep / NextStepFacts (04)
export * from './render/viewpoint.js';    // ViewRect / quantiseViewRect / encodeViewRect / decodeViewRect / viewpointKey / VIEWPOINT_* (05)
export * from './render/sanitise.js';     // sanitiseForBlock (00 §14)
export * from './render/brief.js';        // buildSceneInitBrief / buildNookInitBrief (docs/init/00 §4)
export * from './inject/turn-cache.js';   // readTurnBlock / writeTurnBlock (01)
export * from './inject/collect.js';      // collectSections / makeSectionDeps / buildNextStepFacts (01)
export * from './store/cursor.js';        // settleTurnCursor (03; shared by writer extension and character server side)
export * from './actions/backpack.js';    // listBackpack (02; server route imports it by package name)
