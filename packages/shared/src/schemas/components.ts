import { z } from 'zod';

export const NoteComponentSchema = z.object({
  type: z.literal('note'),
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
  icon: z.string().optional(),
}).passthrough();

export const LetterComponentSchema = z.object({
  type: z.literal('component'),
  component: z.literal('letter'),
  title: z.string(),
  preview: z.string().optional(),
  body: z.string(),
  sign: z.string().optional(),
  seal: z.string().optional(),
}).passthrough();

export const GateComponentSchema = z.object({
  type: z.literal('gate'),
  target: z.string(),
  title: z.string(),
  desc: z.string().optional(),
  stub: z.boolean().optional(),
}).passthrough();

export const BuddyComponentSchema = z.object({
  type: z.literal('buddy'),
  characterId: z.string(),
  name: z.string(),
  avatar: z.string().optional(),
  status: z.string().optional(),
  lastSpoken: z.string().optional(),
}).passthrough();

export type NoteComponent = z.infer<typeof NoteComponentSchema>;
export type LetterComponent = z.infer<typeof LetterComponentSchema>;
export type GateComponent = z.infer<typeof GateComponentSchema>;
export type BuddyComponent = z.infer<typeof BuddyComponentSchema>;
