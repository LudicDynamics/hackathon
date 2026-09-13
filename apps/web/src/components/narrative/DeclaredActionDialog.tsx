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
  slots?: Array<{ id: string; title: string; required: boolean; paths: string[] }>;
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
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const slots = value.slots ?? [];
  const ready = slots.length > 0 && Object.values(selected).some(Boolean) && slots.every(s => !s.required || selected[s.id]);
  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true); setError('');
    try { await onSubmit(slots.filter(s => selected[s.id]).map(s => ({ slot: s.id, path: selected[s.id], revision: value.items.find(i => i.path === selected[s.id])?.revision }))); }
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
          const item = candidates.find(i => i.path === selected[slot.id]);
          return <section className="material-slot" key={slot.id}>
            <label>{slot.title} {slot.required && <span aria-label="required">*</span>}
              <select value={selected[slot.id] ?? ''} onChange={e => setSelected(s => ({ ...s, [slot.id]: e.target.value }))}>
                <option value="">{ja ? '材料を選ぶ（空にする）' : zh ? '选择材料（留空可移除）' : 'Choose material (empty to remove)'}</option>
                {candidates.map(i => <option key={i.path} value={i.path} disabled={Object.entries(selected).some(([id, p]) => id !== slot.id && p === i.path)}>{i.title}</option>)}
              </select>
            </label>
            {!candidates.length && <small>{ja ? '材料がまだありません。' : zh ? '此槽位的材料尚未准备。' : 'No material available for this slot yet.'}</small>}
            {item && <details><summary>{ja ? '選択した材料を読む' : zh ? '查看所选材料' : 'Read selected material'}</summary><p style={{ whiteSpace: 'pre-wrap' }}>{item.body}</p></details>}
          </section>;
        })}
      </fieldset>}
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
