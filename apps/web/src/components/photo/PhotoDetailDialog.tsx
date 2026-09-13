import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MarkdownText } from '../../lib/md.js';
import type { AppearanceView } from '../../lib/appearance-view.js';
import type { PhotoItem } from './PhotoMedia.js';
import { PhotoMedia } from './PhotoMedia.js';

export interface PhotoDetailDialogProps {
  item: PhotoItem;
  appearance?: AppearanceView | null;
  onClose: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  dialogId?: string;
}

const FOCUSABLE = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function PhotoDetailDialog({
  item,
  appearance,
  onClose,
  returnFocusRef,
  dialogId,
}: PhotoDetailDialogProps): React.ReactElement | null {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const generatedId = useId().replace(/:/g, '');
  const id = dialogId || `photo-detail-${generatedId}`;
  const titleId = `${id}-title`;
  const frontmatter = item.frontmatter;
  const title = typeof frontmatter?.title === 'string' && frontmatter.title.trim()
    ? frontmatter.title
    : item.filename.replace(/\.md$/, '');
  const caption = typeof frontmatter?.caption === 'string' ? frontmatter.caption : '';
  const image = typeof frontmatter?.image === 'string' ? frontmatter.image : undefined;
  const hasBody = item.body.trim().length > 0;
  const closeHandler = useRef(onClose);
  closeHandler.current = onClose;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeHandler.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(element => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || active === panel)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', onKeyDown, true);
      const target = returnFocusRef?.current;
      if (target && document.contains(target)) target.focus();
      else if (previous && document.contains(previous)) previous.focus();
    };
  }, [returnFocusRef]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="photo-detail"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        id={id}
        className="photo-detail__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        {...appearance?.attrs}
        style={appearance?.style}
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="photo-detail__header">
          <button ref={closeRef} type="button" className="photo-detail__close" aria-label="Close photo" onClick={onClose}>
            Close
          </button>
          <h2 id={titleId}>{title}</h2>
        </header>
        <div className="photo-detail__scroll">
          <PhotoMedia image={image} alt={title} variant="detail" />
          {caption && <p className="photo-detail__caption">{caption}</p>}
          {hasBody ? (
            <article className="photo-detail__body" aria-label="Photo description">
              <MarkdownText text={item.body} />
            </article>
          ) : (
            <p className="photo-detail__empty" role="status">This photo has no written description.</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
