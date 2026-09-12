/**
 * The five event originators. `god` is separate from `player` because doc-21
 * §3.2 renders god edits differently ("the world changed by itself") and the
 * history panel filters them.
 */
export type ActorType = 'player' | 'god' | 'writer' | 'character' | 'engine';
export interface Actor {
  type: ActorType;
  /** Only `character` carries an id (`characters/<id>/`). */
  id?: string;
}

/** The ONLY env var that carries agent identity (00 §3). */
export const AGENT_ROLE_ENV = 'AIRP_AGENT_ROLE';
export const CHARACTER_ROLE_PREFIX = 'character:';

/**
 * Pure. Maps a raw `AIRP_AGENT_ROLE` value onto an Actor.
 * Never throws — an unknown role must not take down an agent process.
 * The caller logs `warning` ONCE (see extensions/toolkit/actor.ts); this
 * function stays pure so the whole degradation table is unit-testable.
 */
export function resolveAgentActor(raw: string | undefined): {
  actor: Actor;
  /** Human-readable warning the caller logs ONCE; null when nothing is off. */
  warning: string | null;
} {
  if (raw === undefined || raw === '') {
    return { actor: { type: 'writer' }, warning: 'AIRP_AGENT_ROLE is not set; falling back to writer' };
  }
  if (raw === 'writer' || raw === 'scene-init' || raw === 'nook-init') {
    // Init subagents inherit the parent's env and legitimately see 'writer'.
    return { actor: { type: 'writer' }, warning: null };
  }
  if (raw.startsWith(CHARACTER_ROLE_PREFIX)) {
    const id = raw.slice(CHARACTER_ROLE_PREFIX.length);
    if (id === '') {
      return {
        actor: { type: 'writer' },
        warning: `AIRP_AGENT_ROLE='character:' has an empty id; falling back to writer`,
      };
    }
    return { actor: { type: 'character', id }, warning: null };
  }
  return { actor: { type: 'writer' }, warning: `Unknown AIRP_AGENT_ROLE='${raw}'; falling back to writer` };
}

/**
 * Stable reader id for read_cursors (doc-21 §5.1/§5.2): 'writer' | 'character:<id>'.
 * Null for actors that never read the event stream (player/god/engine have no
 * cursor; their events are recorded but never merged into an injection).
 */
export function readerOfActor(actor: Actor): string | null {
  if (actor.type === 'writer') return 'writer';
  if (actor.type === 'character') {
    return actor.id ? `${CHARACTER_ROLE_PREFIX}${actor.id}` : null;
  }
  return null;
}

/** 'player' | 'god' | 'writer' | 'watson' — log / history-panel label. */
export function actorLabel(actor: Actor): string {
  if (actor.type === 'character') return actor.id ?? 'character';
  return actor.type;
}

/** 'player' | 'character:watson' — the compact form for detail fields that need it. */
export function actorRef(actor: Actor): string {
  if (actor.type === 'character') {
    return actor.id ? `${CHARACTER_ROLE_PREFIX}${actor.id}` : CHARACTER_ROLE_PREFIX;
  }
  return actor.type;
}
