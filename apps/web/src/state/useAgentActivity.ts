/**
 * useAgentActivity.ts — read one surface of the activity store (docs/agent-awareness/03 §3.4).
 *
 * `items` is already filtered to the surface (and optionally one agent) and
 * capped by the visible limit; `aria` is the whole-rail summary for the sr-only
 * line. Both change with locale, because the chip copy is localised.
 */

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useLocale } from '../lib/i18n.js';
import {
  summariseActivities,
  visibleActivities,
  type ActivitySurface,
  type AgentActivity,
} from '../lib/agent-activity.js';
import { agentActivityStore } from '../lib/agent-activity-store.js';

export interface AgentActivityView {
  items: readonly AgentActivity[];
  aria: string;
}

export function useAgentActivity(surface: ActivitySurface, agentId?: string): AgentActivityView {
  const snapshot = useSyncExternalStore(
    agentActivityStore.subscribe,
    agentActivityStore.getSnapshot,
    agentActivityStore.getSnapshot,
  );
  const { t } = useLocale();

  const items = useMemo(() => {
    const visible = visibleActivities(snapshot, surface);
    return agentId === undefined ? visible : visible.filter((a) => a.agentId === agentId);
  }, [snapshot, surface, agentId]);

  // Background tabs get their timers throttled, so the 90s stale sweep would
  // arrive late; coming back to the tab advances the clock immediately.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') agentActivityStore.tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const aria = useMemo(() => summariseActivities(items, t), [items, t]);

  return { items, aria };
}
