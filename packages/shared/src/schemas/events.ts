import { z } from 'zod';

/**
 * The closed fifteen (doc-21 §4 / 00 §5.2). Adding one requires BOTH a detail
 * shape below AND a render template — the enum is deliberately closed so a
 * typo'd type fails at compile time instead of silently recording an event no
 * consumer knows how to render.
 */
export const WORLD_EVENT_TYPES = [
  'entity_created',
  'entity_edited',
  'entity_deleted',
  'entity_moved',
  'character_moved',
  'following_changed',
  'character_talked',
  'choice_selected',
  'roll_resolved',
  'use_item_on',
  'layer_entered',
  'layer_initialized',
  'layer_init_failed',
  'world_snapshot',
  'world_rolled_back',
] as const;

export const WorldEventTypeSchema = z.enum(WORLD_EVENT_TYPES);
export type WorldEventType = (typeof WORLD_EVENT_TYPES)[number];

export const ActorTypeSchema = z.enum(['player', 'god', 'writer', 'character', 'engine', 'functional']);
export const ActorSchema = z.object({ type: ActorTypeSchema, id: z.string().optional() });
export type ActorValue = z.infer<typeof ActorSchema>;

/**
 * Frozen per-type `detail` shapes (00 §5.2 == doc-21 §4). Field names are the
 * contract: renderers and consumers read these keys, never re-derive them from
 * the world directory (doc-21 §3.3 — `detail` must be self-sufficient).
 *
 * Used for runtime validation on append (dev only, see `appendEvent`) and as
 * the single authority downstream docs cite when naming fields.
 */
export const EventDetailSchemas = {
  entity_created: z.object({
    path: z.string(),
    name: z.string(),
    kind: z.enum(['chalk', 'component', 'note', 'letter', 'other']),
    summary: z.string().optional(),
  }),
  entity_edited: z.object({ path: z.string(), name: z.string(), kind: z.string() }),
  entity_deleted: z.object({ path: z.string(), name: z.string() }),
  entity_moved: z.object({
    from: z.string(),
    to: z.string(),
    name: z.string(),
    near: z.string().optional(),
    rewrote: z.number().int().min(0),
    dangling: z.number().int().min(0),
  }),
  character_moved: z.object({
    character: z.string(),
    name: z.string(),
    from: z.string().optional(),
    to: z.string(),
    near: z.string().optional(),
  }),
  following_changed: z.object({ character: z.string(), name: z.string(), following: z.boolean() }),
  character_talked: z.object({
    character: z.string(),
    name: z.string(),
    turns: z.number().int().min(1),
  }),
  // `index` is 1-BASED — the same number look_at prints and the caller passes.
  // Never converted.
  choice_selected: z.object({
    path: z.string(),
    name: z.string(),
    choice: z.string(),
    index: z.number().int().min(1),
  }),
  roll_resolved: z.object({
    path: z.string(),
    name: z.string(),
    dice: z.string(),
    desc: z.string(),
    expect: z.string(),
    result: z.number(),
    passed: z.boolean(),
  }),
  use_item_on: z.object({
    item: z.string(),
    itemName: z.string(),
    target: z.string(),
    targetName: z.string(),
  }),
  layer_entered: z.object({ layer: z.string(), name: z.string(), first: z.boolean() }),
  layer_initialized: z.object({
    layer: z.string(),
    name: z.string(),
    by: z.enum(['writer', 'player', 'engine']),
    files: z.array(z.string()),
  }),
  layer_init_failed: z.object({
    layer: z.string(),
    reason: z.string(),
    fallback: z.enum(['template', 'none']),
  }),
  world_snapshot: z.object({ snapshot: z.string(), reason: z.string() }),
  world_rolled_back: z.object({ snapshot: z.string(), to: z.string() }),
} as const satisfies Record<WorldEventType, z.ZodTypeAny>;

/** A stored event, camelCase (the JS side never sees snake_case). */
export const WorldEventSchema = z.object({
  seq: z.number().int().positive(),
  id: z.string(), // evt-<seq>
  projectId: z.string(),
  type: WorldEventTypeSchema,
  actor: ActorSchema,
  layer: z.string().nullable(),
  subject: z.string().nullable(),
  turn: z.string().nullable(),
  detail: z.record(z.string(), z.any()),
  createdAt: z.string(),
});
export type WorldEvent = z.infer<typeof WorldEventSchema>;
export type WorldEventDetail<T extends WorldEventType> = z.infer<(typeof EventDetailSchemas)[T]>;

/** What callers hand to `store.appendEvent`. */
export interface AppendEventArgs<T extends WorldEventType = WorldEventType> {
  type: T;
  actor: ActorValue;
  /** Self-sufficient (doc-21 §3.3): MUST carry `path` + the name AT THAT MOMENT. Never the body. */
  detail: WorldEventDetail<T> & Record<string, any>;
  subject?: string;
  layer?: string;
  turn?: string;
}

/**
 * One reference that could not be rewritten. Lives HERE (not in actions/refs.ts)
 * because `WorldStore.move` returns it and `store/` must not import from
 * `actions/` (that would be a cycle). `actions/refs.ts` re-exports it.
 */
export interface DanglingRef {
  file: string;
  /** The path or bare mention that used to point at the moved entity. */
  target: string;
  reason: 'ambiguous' | 'unreadable';
}

/** doc-20 §5 — the shape `WorldStore.move` returns. */
export interface MoveResult {
  ok: true; // failure throws; there is no ok:false path
  from: string;
  to: string;
  name: string;
  rewrote: string[];
  dangling: DanglingRef[];
  event: WorldEvent;
}
