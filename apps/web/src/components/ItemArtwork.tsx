import { useState } from 'react';
import { BadgeCheck, BookOpen, FileText, FlaskConical, Gem, KeyRound, Mail, Map, Package, Smartphone } from 'lucide-react';
import { airpGateway } from '../lib/airp-gateway.js';

/** Authored artwork wins; semantic line art remains legible without an asset. */
export function ItemArtwork({ item }: { item: { filename: string; frontmatter: Record<string, any> | null } }) {
  const fm = item.frontmatter ?? {};
  const reference = fm.image || fm.cover;
  const src = typeof reference === 'string' && reference ? airpGateway.assetUrl(reference, undefined, 'image') : null;
  const [failed, setFailed] = useState<string | null>(null);
  const kind = `${fm.visual?.kind ?? fm.visual ?? ''} ${fm.type ?? ''} ${item.filename}`.toLowerCase();
  const Icon = /letter|envelope|mail/.test(kind) ? Mail
    : /key/.test(kind) ? KeyRound
    : /badge|license|permit|pass|identity/.test(kind) ? BadgeCheck
    : /map|chart/.test(kind) ? Map
    : /book|diary|journal/.test(kind) ? BookOpen
    : /phone|radio/.test(kind) ? Smartphone
    : /potion|bottle|vial/.test(kind) ? FlaskConical
    : /gem|crystal|coin/.test(kind) ? Gem
    : /note|paper|slip|sheet|document|receipt|ticket|script/.test(kind) ? FileText : Package;
  return <span className="item-artwork" aria-hidden="true">
    {src && failed !== src
      ? <img src={src} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setFailed(src)} />
      : typeof fm.icon === 'string' && fm.icon.trim() && fm.icon.length <= 8
        ? <span className="item-artwork__symbol">{fm.icon}</span>
        : <Icon size={29} strokeWidth={1.45} />}
  </span>;
}
