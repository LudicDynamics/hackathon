import React from 'react';
import type { AppearanceView } from '../../lib/appearance-view.js';
import { PhotoMedia, type PhotoItem } from '../photo/PhotoMedia.js';

export interface PhotoCardProps {
  item: PhotoItem;
  appearance?: AppearanceView | null;
  puzzleClasses?: string;
  onDragOver?: React.DragEventHandler<HTMLElement>;
  onDragLeave?: React.DragEventHandler<HTMLElement>;
  onDrop?: React.DragEventHandler<HTMLElement>;
  onTakeItem?: (path: string) => void;
}

export function PhotoCard({
  item,
  puzzleClasses = '',
  onDragOver,
  onDragLeave,
  onDrop,
  appearance,
  onTakeItem,
}: PhotoCardProps): React.ReactElement {
  const frontmatter = item.frontmatter;
  const title = typeof frontmatter?.title === 'string' && frontmatter.title.trim()
    ? frontmatter.title
    : item.filename.replace(/\.md$/, '');
  const preview = typeof frontmatter?.preview === 'string' ? frontmatter.preview : '';
  const image = typeof frontmatter?.image === 'string' ? frontmatter.image : undefined;
  const portable = frontmatter?.portable === true && !!onTakeItem;

  return (
    <figure
      className={`photo-card ${puzzleClasses}`.trim()}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      aria-label={title}
      {...appearance?.attrs}
      style={appearance?.style}
    >
      <PhotoMedia image={image} alt={title} variant="card" />
      <figcaption className="photo-card__caption">
        <strong className="photo-card__title">{title}</strong>
        <span className="photo-card__preview">{preview || 'Open to read the photo note.'}</span>
        {portable && (
          <button
            type="button"
            data-no-drag
            className="photo-card__take"
            onClick={event => {
              event.stopPropagation();
              onTakeItem?.(item.path);
            }}
          >
            {typeof frontmatter?.take_label === 'string' ? frontmatter.take_label : 'Take'}
          </button>
        )}
      </figcaption>
    </figure>
  );
}
