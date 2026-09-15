import { z } from 'zod';

export const WorldExtensionSchema = z.object({
  id: z.string(),
  version: z.string(),
  optional: z.boolean().default(false),
});

export const LayerConfigSchema = z.object({
  // Derived layers may have no README `name`; fall back to the id downstream.
  name: z.string().optional(),
  parent: z.string().nullable(),
  material: z.string().optional(),
  stub: z.boolean().optional(),
});

export const CharacterConfigSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  home: z.string(),
  role: z.enum(['companion', 'npc']).or(z.string()).optional(),
  avatar: z.string().optional(),
  avatarVideo: z.string().optional(),
  description: z.string().optional(),
});

export const WorldManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string().default('1.0.0'),
  schema: z.number().default(1),
  description: z.string(),
  author: z.string(),
  cover: z.string().optional(),
  player: z.object({
    id: z.string(),
    name: z.string(),
    avatar: z.string().optional(),
  }).optional(),
  tags: z.array(z.string()).default([]),
  genre: z.string(),
  material: z.string().default('parchment'),
  /** First playable layer. `map` remains the filesystem root fallback. */
  entry: z.string().min(1).default('map'),
  extensions: z.array(WorldExtensionSchema).default([]),
  // `layers` is DERIVED from the directory tree (see store/layers.ts), but the
  // manifest type still carries it for consumers. Not required in world.json:
  // declaring it created a second source that drifted.
  layers: z.record(z.string(), LayerConfigSchema).default({}),
  characters: z.array(CharacterConfigSchema).default([]),
  // World theme song key. Resolved to a URL by the server before it reaches the
  // client (docs/audio/00 §4.3); the raw key never leaves the server.
  audio: z.object({ theme: z.string().optional() }).optional(),
  /**
   * Experimental sandbox marker (`templates/fpal`). Not a shipped edition: the
   * edition gates skip it and the world shelf lists it separately, so it can be
   * opened from the Launcher without joining the 21-edition corpus.
   */
  exp: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough();

export type WorldExtension = z.infer<typeof WorldExtensionSchema>;
export type LayerConfig = z.infer<typeof LayerConfigSchema>;
export type CharacterConfig = z.infer<typeof CharacterConfigSchema>;
export type WorldManifest = z.infer<typeof WorldManifestSchema>;

export function validateWorldManifest(data: unknown): WorldManifest {
  return WorldManifestSchema.parse(data);
}
