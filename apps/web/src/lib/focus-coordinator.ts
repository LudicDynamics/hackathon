export type FocusOwner =
  | 'workspace'
  | 'writer'
  | 'journal'
  | 'world-shelf'
  | 'belongings'
  | 'profile'
  | 'character-dialogue'
  | 'nook';

export type FocusToken = string;

export interface FocusEntry {
  readonly owner: FocusOwner;
  readonly token: FocusToken;
}

export interface FocusCoordinator {
  /** Acquire one focus owner. Re-acquiring an active owner is idempotent. */
  acquire(owner: FocusOwner): FocusToken;
  /** Release a token. Releasing an unknown/already released token is a no-op. */
  release(token: FocusToken): boolean;
  /** Return the current topmost owner, if any. */
  peek(): FocusOwner | null;
  /** Return a stable copy of the nested focus stack, bottom to top. */
  snapshot(): readonly FocusEntry[];
  /** Close only the topmost owner for an Escape press. */
  handleEscape(): FocusEntry | null;
  subscribe(listener: () => void): () => void;
}

/**
 * Create the single focus owner for a surface. This module has no DOM or
 * transport side effects; an App adapter can perform actual focus after the
 * owner transition has been accepted.
 */
export function createFocusCoordinator(): FocusCoordinator {
  let nextToken = 0;
  let stack: FocusEntry[] = [];
  const listeners = new Set<() => void>();

  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  const coordinator: FocusCoordinator = {
    acquire(owner) {
      const existing = stack.find((entry) => entry.owner === owner);
      if (existing) return existing.token;

      const entry: FocusEntry = {
        owner,
        token: `focus-${++nextToken}`,
      };
      stack = [...stack, entry];
      notify();
      return entry.token;
    },

    release(token) {
      const index = stack.findIndex((entry) => entry.token === token);
      if (index < 0) return false;
      stack = [...stack.slice(0, index), ...stack.slice(index + 1)];
      notify();
      return true;
    },

    peek() {
      return stack.length > 0 ? stack[stack.length - 1].owner : null;
    },

    snapshot() {
      return stack.slice();
    },

    handleEscape() {
      const topmost = stack[stack.length - 1];
      if (!topmost) return null;
      coordinator.release(topmost.token);
      return topmost;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return coordinator;
}
