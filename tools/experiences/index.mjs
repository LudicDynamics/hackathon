import wuwu from './wuwu.mjs';
import holmes from './holmes.mjs';
import timeline from './timeline.mjs';
import snow from './first-snow.mjs';
import academy from './academy.mjs';
import door from './unwritten.mjs';
import { mappedPath, segment, textRefs, jsonRefs } from '../migrate-japanese-paths.mjs';
import { characterNookFiles } from './character-nooks.mjs';
// Localized authoring labels compile through a fixed migration table, not a
// transliteration guess. The same mapping upgrades existing saves.
export const experiences = [wuwu, holmes, timeline, snow, academy, door].map(pack => ({
  ...pack,
  files: {
    ...Object.fromEntries(Object.entries(pack.files).map(([file, text]) => [mappedPath(file), textRefs(text)])),
    ...Object.fromEntries(pack.characters.flatMap(c => Object.entries(characterNookFiles(pack.base, { ...c, id: segment(c.id) }))
      .map(([file, text]) => [`characters/${segment(c.id)}/${file}`, text]))),
  },
  scenes: pack.scenes.map(mappedPath),
  characters: pack.characters.map(c => ({ ...c, id: segment(c.id), home: mappedPath(c.home), body: textRefs(c.body) })),
  checks: jsonRefs(pack.checks),
}));
