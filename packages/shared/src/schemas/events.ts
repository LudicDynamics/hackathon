import { z } from 'zod';

export const WorldEventType = z.enum([
  'roll_resolved',
  'use_item_on',
  'item_moved',
  'world_frozen',
  'world_thawed',
  'god_action',
  'scene_transition',
  'agent_speech',
  'agent_settled'
]);

export const WorldEventSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  type: WorldEventType,
  payload: z.record(z.string(), z.any()),
  createdAt: z.string(),
});

export type WorldEvent = z.infer<typeof WorldEventSchema>;

export interface MoveResult {
  ok: boolean;
  from: string;
  to: string;
  rewrote: string[];
  dangling: Array<{ file: string; target: string }>;
  event?: WorldEvent;
}
