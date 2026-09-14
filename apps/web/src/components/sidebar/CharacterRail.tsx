import React, { useCallback, useState } from 'react';
import { useLocale } from '../../lib/i18n.js';
import { railEntry } from '../../lib/character-rail.mjs';
import type { CharacterPresenceView } from '../../lib/presence.js';
import type { AssetMediaKind } from '../../lib/airp-gateway.js';
import { withBase } from '../../lib/base-path.js';
import './character-rail.css';

/**
 * Right-hand character rail (docs/presence/03).
 *
 * Shape: the root reuses the EXISTING `.prototype-residents` container
 * (`scene-shell.css:110` — absolute top-right column) so positioning has a
 * single source of truth; `character-rail` is only a styling hook. The rail
 * lives above the backpack, no left/right tabs (contract §4.2.1).
 *
 * It is props-driven and self-contained: it never reads `useWorld`, never
 * fetches, and never derives membership itself — the ONE projection
 * (`usePresence().views`) is handed in (contract §4.1).
 */
export interface CharacterRailProps {
  /** The single projection result (contract §4.1); never re-derived here. */
  views: CharacterPresenceView[];
  /**
   * Ids whose follow toggle request is IN FLIGHT (UF-1). This is UI state, NOT
   * the follow truth: nothing reads it as `following` (contract §2.4). It only
   * disables the row's follow button and marks it `aria-busy`.
   */
  pendingFollowing: ReadonlySet<string>;
  /** A nook is already open -> "Visit their ikigai" is disabled (§6.4). */
  nookOpen: boolean;
  /** Avatar click. Only called when `state === 'in-scene'` (UF-2). */
  onOpenCharacter(id: string): void;
  /** "Go to them". Always called; the absent/no-op + notify live in `04` (P-20). */
  onTravelTo(id: string): void;
  /** Follow toggle; `next` is the computed terminal state (contract §2.4). */
  onToggleFollowing(id: string, next: boolean): void;
  /** "Visit their ikigai"; independent of presence state (UF-4). */
  onOpenNook(id: string): void;
  /** Player-visible feedback (contract §6 MUST NOT #6). */
  notify(message: string): void;
  /**
   * Avatar URL resolver, injected by App (P-18): the real one is module-private.
   * Falls back to the raw path so this component stays standalone/testable.
   */
  assetUrl?(path: string, kind: AssetMediaKind): string | undefined;
}

export function CharacterRail({
  views,
  pendingFollowing,
  nookOpen,
  onOpenCharacter,
  onTravelTo,
  onToggleFollowing,
  onOpenNook,
  notify,
  assetUrl,
}: CharacterRailProps): React.ReactElement {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set<string>());

  const resolve = useCallback(
    (path?: string): string | undefined => (path ? (assetUrl ? assetUrl(path, 'image') : path) : undefined),
    [assetUrl],
  );

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    // `prototype-residents` = existing top-right column positioning; `prototype-chrome`
    // = shell chrome visibility; `character-rail` = this component's style hook.
    <div className="prototype-residents prototype-chrome character-rail" role="group" aria-label={t('Characters')}>
      {/* Rendered in `views` array order — never re-sorted (UF-7c): a state flip
          must not move the row the player is about to click (contract §4.2). */}
      {views.map(view => {
        const entry = railEntry(view);
        const displayName = view.name || view.id;
        const avatarUrl = resolve(view.avatar);
        const pending = pendingFollowing.has(view.id);
        const isExpanded = expanded.has(view.id);
        const actionsId = `character-actions-${view.id}`;
        const statusLabel = view.following
          ? `${t(entry.statusKey)} · ${t('Following you')}`
          : t(entry.statusKey);

        return (
          <div
            key={view.id}
            className={`character-rail__item character-rail__item--${entry.tone}${isExpanded ? ' character-rail__item--expanded' : ''}`}
          >
            <button
              type="button"
              className={`prototype-companion-orb character-rail__orb character-rail__orb--${entry.tone}${view.following ? ' character-rail__orb--following' : ''}`}
              // The gesture means ONE thing everywhere: talk. Non-in-scene cannot
              // talk, so the click is refused with a visible reason (UF-2, P-20).
              onClick={() => {
                if (entry.canTalk) onOpenCharacter(view.id);
                else if (entry.talkHintKey) notify(t(entry.talkHintKey));
              }}
              aria-label={entry.canTalk ? t('Talk to {name}', { name: displayName }) : displayName}
              style={avatarUrl ? { backgroundImage: `url("${withBase(avatarUrl)}")` } : undefined}
            >
              {!avatarUrl && <span aria-hidden="true">{view.id.charAt(0).toUpperCase()}</span>}
              {view.following && <span className="character-rail__follow-dot" aria-hidden="true" />}
            </button>

            <small className="character-rail__label">{displayName}</small>
            <span className="character-rail__status">{statusLabel}</span>

            {/* Independent, focusable expander -> the three keys (§3.6). On touch
                it is always visible; on desktop hover is only the fast path. */}
            <button
              type="button"
              className="character-rail__expander"
              aria-expanded={isExpanded}
              aria-controls={actionsId}
              aria-label={t('Actions for {name}', { name: displayName })}
              onClick={() => toggleExpanded(view.id)}
            >
              <span aria-hidden="true">{isExpanded ? '▾' : '▸'}</span>
            </button>

            {/* Always in the DOM; shown by CSS on hover / :focus-within / expander. */}
            <div id={actionsId} className="character-rail__actions" role="group" aria-label={t('Actions for {name}', { name: displayName })}>
              <button
                type="button"
                className="character-rail__action"
                // Always called; absent -> `navigateTo` shows the hint and does not
                // travel (P-20: the single notifier is navigateTo).
                onClick={() => onTravelTo(view.id)}
                aria-label={`${t('Go to them')} · ${displayName}`}
              >
                {t('Go to them')}
              </button>
              <button
                type="button"
                className={`character-rail__action${pending ? ' character-rail__action--pending' : ''}`}
                // `next` comes from the projection, never from local state (§2.4).
                onClick={() => { if (!pending) onToggleFollowing(view.id, !view.following); }}
                disabled={pending}
                aria-busy={pending}
                aria-label={`${t(entry.followActionKey)} · ${displayName}`}
              >
                {t(entry.followActionKey)}
              </button>
              <button
                type="button"
                className="character-rail__action"
                onClick={() => onOpenNook(view.id)}
                disabled={nookOpen}
                aria-disabled={nookOpen}
                aria-label={`${t('Visit their ikigai')} · ${displayName}`}
              >
                {t('Visit their ikigai')}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
