import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { renderFrontmatterWidgets } from '../../lib/fm.js';
import { useLocale } from '../../lib/i18n.js';

export interface DeclaredResponse {
  kind: string;
  text?: string;
  prompt?: string;
  target?: string;
  character?: string;
  world?: string;
  source?: string;
  choice?: string;
  revision?: string;
  slots?: Array<{ id: string; title: string; required: boolean; paths: string[]; maxItems?: number }>;
  items: Array<{ path: string; declaredPath?: string; revision?: string; title: string; body: string; frontmatter?: Record<string, any> }>;
  missing: string[];
}

/** Read/stage is local presentation. Preparing a draft does not call AI. */
export function DeclaredActionDialog({ value, onClose, onSubmit, onChoose }: {
  value: DeclaredResponse; onClose: () => void; onSubmit: (selections: Array<{ slot: string; path: string; revision?: string }>) => Promise<void>;
  onChoose: (path: string, choice: string) => void;
}) {
  const { locale } = useLocale();
  const ja = locale === 'ja'; const zh = locale === 'zh-CN';
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const slots = value.slots ?? [];
  const [activeSlot, setActiveSlot] = useState(slots[0]?.id ?? '');
  const place = (path: string, target?: string) => {
    if (busy) return;
    const item = value.items.find(i => i.path === path);
    const compatible = (s: typeof slots[number]) => !!item && s.paths.includes(item.declaredPath ?? item.path);
    const slot = target ? slots.find(s => s.id === target) : slots.find(s => s.id === activeSlot && compatible(s)) ?? slots.find(compatible);
    if (!item || !slot || !slot.paths.includes(item.declaredPath ?? item.path)) {
      setError(ja ? 'この場所には置けません。別の枠を選んでください。' : zh ? '这份材料不适合当前槽位，请选择其他槽位。' : 'This material does not fit here. Choose another slot.'); return;
    }
    setError('');
    const currentItems = selected[slot.id] ?? [];
    if (currentItems.includes(path)) return;
    if (currentItems.length >= (slot.maxItems ?? slot.paths.length)) {
      setError(ja ? '枠がいっぱいです。材料を戻してから追加してください。' : zh ? '槽位已满，请先移除一份材料。' : 'This slot is full. Remove a material before adding another.'); return;
    }
    setActiveSlot(slot.id);
    setSelected(current => ({ ...Object.fromEntries(Object.entries(current).map(([id, paths]) => [id, paths.filter(p => p !== path)])), [slot.id]: [...(current[slot.id] ?? []), path] }));
  };
  const ready = slots.length > 0 && Object.values(selected).some(p => p.length > 0) && slots.every(s => !s.required || selected[s.id]?.length);
  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true); setError('');
    try { await onSubmit(slots.flatMap(s => (selected[s.id] ?? []).map(path => ({ slot: s.id, path, revision: value.items.find(i => i.path === path)?.revision })))); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previous?.focus();
  }, []);
  return createPortal(<div className="declared-action-backdrop" data-no-drag onPointerDown={e => e.stopPropagation()} onWheel={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}
    onKeyDown={e => {
      e.stopPropagation(); if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const nodes = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)');
        if (!nodes?.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }}>
    <div ref={dialog} className="declared-action-dialog" role="dialog" aria-modal="true" aria-label={ja ? '目の前のこと' : zh ? '眼前的发现' : 'A closer look'}>
      <button type="button" onClick={onClose}>{ja ? 'この場に戻る ↩' : zh ? '回到场景 ↩' : 'Return ↩'}</button>
      {value.kind === 'stage' && <p>{ja ? '材料を選ぶだけでは、まだ提出も実行もされません。' : zh ? '选择材料不会提交或执行。' : 'Selecting materials does not submit or execute them.'}</p>}
      {value.kind === 'stage' && <fieldset className="material-slots" disabled={busy}>
        {slots.map(slot => {
          const candidates = value.items.filter(i => slot.paths.includes(i.declaredPath ?? i.path));
          const items = candidates.filter(i => selected[slot.id]?.includes(i.path));
          return <section className={`material-slot ${activeSlot === slot.id ? 'is-active' : ''}`} key={slot.id}
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={e => { e.preventDefault(); e.stopPropagation(); setActiveSlot(slot.id); place(e.dataTransfer.getData('text/plain'), slot.id); }}>
            <button type="button" className="material-slot__target" aria-pressed={activeSlot === slot.id} onClick={() => setActiveSlot(slot.id)}>
              <small>{slot.title} {slot.required && '*'}</small>
              <strong>{items.length ? `${items.length} / ${slot.maxItems ?? slot.paths.length}` : (ja ? 'ここに材料を置く' : zh ? '将材料放在这里' : 'Place material here')}</strong>
            </button>
            {items.map(item => <div key={item.path} className="material-slot__item"><strong>{item.title}</strong><button type="button" aria-label={`${ja ? '戻す' : zh ? '移除' : 'Remove'} ${item.title}`} onClick={() => setSelected(s => ({ ...s, [slot.id]: (s[slot.id] ?? []).filter(p => p !== item.path) }))}>{ja ? '戻す' : zh ? '移除' : 'Remove'}</button><details><summary>{ja ? '読む' : zh ? '查看原文' : 'Read'}</summary><p style={{ whiteSpace: 'pre-wrap' }}>{item.body}</p></details></div>)}
            {!candidates.length && <small>{ja ? '材料がまだありません。' : zh ? '此槽位的材料尚未准备。' : 'No material available for this slot yet.'}</small>}
          </section>;
        })}
      </fieldset>}
      {value.kind === 'stage' && <>
        <p>{ja ? '枠を選び、材料をクリック。または枠へドラッグ。' : zh ? '先选槽位，再点击材料；也可将材料拖入槽位。' : 'Select a slot, then click a material—or drag it into a slot.'}</p>
        <div className="material-pool">
          {value.items.map(item => <button key={item.path} type="button" draggable={!busy} disabled={busy}
            aria-pressed={Object.values(selected).some(paths => paths.includes(item.path))} onClick={() => place(item.path)}
            onDragStart={e => { e.stopPropagation(); e.dataTransfer.setData('text/plain', item.path); e.dataTransfer.effectAllowed = 'move'; }}>
            <span aria-hidden="true">▤</span><strong>{item.title}</strong><small>{item.body.slice(0, 80)}</small>
          </button>)}
        </div>
      </>}
      {value.text && <p style={{ whiteSpace: 'pre-wrap' }}>{value.text}</p>}
      {value.kind !== 'stage' && value.items.map(item => <article key={item.path}>
        <h3>{item.title}</h3>
        <div style={{ whiteSpace: 'pre-wrap' }}>{item.body}</div>
        {item.frontmatter && renderFrontmatterWidgets({ ...item.frontmatter, ...(!item.frontmatter.choice_actions ? { choice: undefined } : {}) }, { filePath: item.path, reveal: true, onChoice: choice => onChoose(item.path, choice), onDiceRolled: onClose })}
      </article>)}
      {value.missing.length > 0 && <p>{ja ? 'まだ用意されていない材料：' : zh ? '尚未准备的材料：' : 'Not prepared yet: '}{value.missing.join(', ')}</p>}
      {value.kind === 'stage' && <>
        <p>{ja ? '内容や推理の正しさはまだ判定しません。確認依頼を作家欄に入れ、送信すると一度だけ相談します。計画は実行しません。' : zh ? '此处不判断推论。准备审核草稿后，在作家栏点击发送才请求审核；不会执行计划。' : 'This does not judge your reasoning. Prepare a review draft, then Send in the writer field to request one review. It does not execute the plan.'}</p>
        <button type="button" disabled={!ready || busy} onClick={() => void submit()}>{busy ? (ja ? '材料を確認中…' : zh ? '核对材料中…' : 'Checking materials…') : (ja ? '確認依頼の下書きを作る' : zh ? '准备审核草稿' : 'Prepare review draft')}</button>
      </>}
      {error && <p role="alert">{error}</p>}
    </div>
  </div>, document.body);
}
