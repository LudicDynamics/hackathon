import React, { useEffect, useRef } from 'react';
import type { LayerLink } from '../../state/useWorld.js';

/**
 * Relationship-line layer (v2 prototype §1.3). A module-level registry maps
 * link id → { endpoint elements, path element } so the drag hot path can call
 * updateAllLinks() with zero React round-tripping. The SVG lives INSIDE the
 * world transform layer (world coordinates, scales with the camera).
 *
 * Endpoint elements are looked up by `data-path` from the DOM on each registry
 * rebuild (driven by the `links` prop), which keeps mount/unmount bookkeeping
 * entirely local to this layer — CanvasObject only needs to expose data-path.
 */

export const LINK_SVG_CLASS = 'links-svg';

interface RegisteredLink {
  a: HTMLElement;
  b: HTMLElement;
  pathEl: SVGPathElement;
  link: LayerLink;
}

const registry: Map<string, RegisteredLink> = new Map();

function elForPath(path: string): HTMLElement | null {
  if (!path) return null;
  try {
    return document.querySelector(`.object[data-path="${CSS.escape(path)}"]`);
  } catch {
    return null;
  }
}

function readBox(el: HTMLElement): { x: number; y: number; w: number; h: number } {
  const rawLeft = el.style.left ? parseFloat(el.style.left) : NaN;
  const rawTop = el.style.top ? parseFloat(el.style.top) : NaN;
  return {
    x: Number.isFinite(rawLeft) ? rawLeft : el.offsetLeft || 0,
    y: Number.isFinite(rawTop) ? rawTop : el.offsetTop || 0,
    w: el.offsetWidth || parseFloat(el.style.width) || 280,
    h: el.offsetHeight || parseFloat(el.style.height) || 180,
  };
}

/** Recompute every registered link's bezier path from live DOM layout (v2 L263-271). */
export function updateAllLinks(): void {
  for (const r of registry.values()) {
    if (!r.a.isConnected || !r.b.isConnected) continue;
    const A = readBox(r.a);
    const B = readBox(r.b);
    const dCx = B.x + B.w / 2 - (A.x + A.w / 2);
    const dCy = B.y + B.h / 2 - (A.y + A.h / 2);

    let sx: number;
    let sy: number;
    let ex: number;
    let ey: number;
    if (Math.abs(dCx) < 80) {
      // Near-vertical alignment: attach top/bottom edges.
      sx = A.x + A.w / 2;
      ex = B.x + B.w / 2;
      sy = dCy >= 0 ? A.y + A.h : A.y;
      ey = dCy >= 0 ? B.y : B.y + B.h;
    } else {
      // Horizontal attachment: right/left edges pointing at the other card.
      sx = dCx >= 0 ? A.x + A.w : A.x;
      ex = dCx >= 0 ? B.x : B.x + B.w;
      sy = A.y + A.h / 2;
      ey = B.y + B.h / 2;
    }
    const dx = ex - sx;
    const dy = ey - sy;
    r.pathEl.setAttribute(
      'd',
      `M ${sx} ${sy} C ${sx + dx * 0.45} ${sy + dy * 0.1}, ${ex - dx * 0.45} ${ey - dy * 0.1}, ${ex} ${ey}`
    );
  }
}

/** Toggle .thread-active on every link touching `path` (v2 L275-276). */
export function highlightLinks(path: string, on: boolean): void {
  for (const r of registry.values()) {
    if (r.link.from === path || r.link.to === path) {
      r.pathEl.classList.toggle('thread-active', on);
    }
  }
}

/**
 * The most recently arrived dashed link becomes .thread-latest; every older
 * dashed link fades out as .thread-archived (v2 L256). Registry insertion
 * order follows the `links` array, so "last" = last row in the payload.
 */
export function refreshLinkArchives(): void {
  const dashed = [...registry.values()].filter((r) => r.link.style === 'dashed');
  dashed.forEach((r, idx) => {
    r.pathEl.classList.remove('thread-archived', 'thread-latest');
    if (idx === dashed.length - 1) {
      r.pathEl.classList.add('thread-latest');
    } else {
      r.pathEl.classList.add('thread-archived');
    }
  });
}

function buildPaths(svg: SVGSVGElement, links: LayerLink[]): void {
  for (const r of registry.values()) r.pathEl.remove();
  registry.clear();

  for (const link of links) {
    const a = elForPath(link.from);
    const b = elForPath(link.to);
    if (!a || !b) continue; // dangling link: DB row kept, nothing rendered
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('fill', 'none');
    // Inline style, not a presentation attribute: CSS custom properties only
    // resolve in real CSS, not in attribute values.
    pathEl.style.stroke = link.style === 'solid' ? 'var(--ink)' : 'var(--rust)';
    pathEl.setAttribute('stroke-width', '1.6');
    pathEl.setAttribute('stroke-linecap', 'round');
    pathEl.classList.add('thread-line');
    if (link.style === 'dashed') pathEl.classList.add('thread-dashed');
    svg.appendChild(pathEl);
    registry.set(link.id, { a, b, pathEl, link });
  }

  refreshLinkArchives();
  updateAllLinks();
}

export const LinkLayer: React.FC<{ links: LayerLink[] }> = ({ links }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    buildPaths(svg, links);
    return () => {
      for (const r of registry.values()) r.pathEl.remove();
      registry.clear();
    };
  }, [links]);

  return (
    <svg
      ref={svgRef}
      className={LINK_SVG_CLASS}
      width={0}
      height={0}
      style={{ overflow: 'visible', position: 'absolute', left: 0, top: 0 }}
    />
  );
};
