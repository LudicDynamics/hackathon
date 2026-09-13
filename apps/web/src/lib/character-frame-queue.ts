import { isValidCharacterId } from '@airp/shared/characters';

/** Frames after the App identity router has accepted a legal character id. */
export type CharacterFrame =
  | { type: 'character_delta'; characterId: string; delta: string; timestamp?: string }
  | { type: 'character_message'; characterId: string; text: string; timestamp?: string }
  | { type: 'character_idle'; characterId: string; timestamp?: string }
  | { type: 'error'; source: 'character'; characterId: string; message: string; timestamp?: string }
  | { type: 'turn_aborted'; source: 'character'; characterId: string; message?: string; timestamp?: string };

export type CharacterFrameQueueClearReason = 'close' | 'switch' | 'world-change' | 'disconnect';

type Listener = () => void;
interface Entry {
  frame: CharacterFrame;
  deliverySeq: number;
}

export interface CharacterFrameQueue {
  enqueue(frame: CharacterFrame, deliverySeq: number): void;
  nextDeliverySeq(): number;
  drainUntil(characterId: string): CharacterFrame[];
  clear(reason: CharacterFrameQueueClearReason): void;
  subscribe(listener: Listener): () => void;
}

function isFrame(value: unknown): value is CharacterFrame {
  if (!value || typeof value !== 'object') return false;
  const frame = value as Record<string, unknown>;
  if (typeof frame.type !== 'string' || typeof frame.characterId !== 'string') return false;
  if (!isValidCharacterId(frame.characterId)) return false;
  if (frame.type === 'character_delta') return typeof frame.delta === 'string';
  if (frame.type === 'character_message') return typeof frame.text === 'string';
  if (frame.type === 'character_idle') return true;
  if (frame.type === 'error') return frame.source === 'character' && typeof frame.message === 'string';
  if (frame.type === 'turn_aborted') return frame.source === 'character';
  return false;
}

/**
 * The one process-local FIFO for character presentation frames. The queue owns
 * delivery order, not identity: App must reject missing/wrong ids first.
 */
class CharacterFrameQueueImpl implements CharacterFrameQueue {
  private entries: Entry[] = [];
  private sequence = 0;
  private readonly seenSequences = new Set<number>();
  private readonly seenFrames = new WeakSet<object>();
  private readonly listeners = new Set<Listener>();

  enqueue(frame: CharacterFrame, deliverySeq: number): void {
    if (!isFrame(frame) || !Number.isSafeInteger(deliverySeq) || deliverySeq < 1) return;
    // A repeated delivery sequence or object identity is the duplicate
    // boundary. Equal text is not: it can be two legitimate assistant messages.
    if (this.seenSequences.has(deliverySeq) || this.seenFrames.has(frame)) return;
    this.seenSequences.add(deliverySeq);
    this.seenFrames.add(frame);
    this.entries.push({ frame, deliverySeq });
    this.entries.sort((a, b) => a.deliverySeq - b.deliverySeq);
    this.notify();
  }

  nextDeliverySeq(): number {
    this.sequence += 1;
    return this.sequence;
  }

  drainUntil(characterId: string): CharacterFrame[] {
    if (!isValidCharacterId(characterId)) return [];
    const drained: CharacterFrame[] = [];
    const keep: Entry[] = [];
    for (const entry of this.entries) {
      if (entry.frame.characterId === characterId) drained.push(entry.frame);
      else keep.push(entry);
    }
    if (drained.length > 0) {
      this.entries = keep;
      this.notify();
    }
    return drained;
  }

  clear(_reason: CharacterFrameQueueClearReason): void {
    if (this.entries.length === 0) return;
    this.entries = [];
    this.notify();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

let owner: CharacterFrameQueue | null = null;

/** Return the singleton owner shared by App and every CharacterModal mount. */
export function getCharacterFrameQueue(): CharacterFrameQueue {
  owner ??= new CharacterFrameQueueImpl();
  return owner;
}

/** Reset only for focused tests; production callers use clear(reason). */
export function resetCharacterFrameQueueForTest(): void {
  owner = new CharacterFrameQueueImpl();
}

/** Strict boundary guard for the App identity router and focused tests. */
export function isCharacterFrame(value: unknown): value is CharacterFrame {
  return isFrame(value);
}
