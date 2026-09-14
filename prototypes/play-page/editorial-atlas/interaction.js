(() => {
  const app = document.querySelector('.atlas-app');
  const desk = document.querySelector('.action-desk');
  const form = document.querySelector('#action-form');
  const input = document.querySelector('#action-input');
  const submit = document.querySelector('.action-submit');
  const cancel = document.querySelector('#action-cancel');
  const retry = document.querySelector('#action-retry');
  const failureDemo = document.querySelector('#action-fail-demo');
  const stateLabel = document.querySelector('[data-state-label]');
  const stateCopy = document.querySelector('[data-state-copy]');
  const feedback = document.querySelector('[data-feedback]');
  const feedbackMark = document.querySelector('[data-feedback-mark]');
  const effectsToggle = document.querySelector('#effects-toggle');
  const wakeButton = document.querySelector('#action-wake');
  const dialogue = document.querySelector('#dialogue-sheet');
  const dialogueClose = document.querySelector('#dialogue-close');
  const dialogueFocus = document.querySelector('#dialogue-focus-action');
  const toast = document.querySelector('#toast');
  const viewport = document.querySelector('#world-viewport');
  const canvas = document.querySelector('#world-canvas');
  const zoomIn = document.querySelector('#zoom-in');
  const zoomOut = document.querySelector('#zoom-out');
  const zoomLevel = document.querySelector('#zoom-level');
  const cameraReset = document.querySelector('#camera-reset');
  let activeTrigger = null;
  let processingTimer = null;
  let landedTimer = null;
  let toastTimer = null;
  const initialCamera = { x: -40, y: -80, scale: .72 };
  const camera = { ...initialCamera };
  let drag = null;

  const copy = {
    idle: { label: 'READY · 可继续书写', copy: '用一句话表达行动；地图会先标记处理，再明确告诉你结果。', feedback: '输入后按 Enter，或点击“写入地图”。', mark: '·' },
    accepted: { label: 'ACCEPTED · 已接收', copy: '行动已被行动台接收；正在交给编辑部处理。', feedback: '已接收，正在准备下一步标记。', mark: '→' },
    processing: { label: 'PROCESSING · 处理中', copy: '编辑部正在把这句话放进地图；此刻还不是世界事实。', feedback: '处理中 · 可停止，不会把演出误当成落定。', mark: '…' },
    landed: { label: 'LANDED · 已落定', copy: '这次 fixture 已给出可回访的结果；蓝墨路线出现一个新注记。', feedback: '已落定 · 结果可在编辑批注中回访。', mark: '✓' },
    failed: { label: 'FAILED · 未完成', copy: '这次演示没有落定世界事实；可以检查输入后重试。', feedback: '未完成 · 没有新的世界事实写入。', mark: '!' },
    cancelled: { label: 'CANCELLED · 已取消', copy: '你停止了这次处理；未生成世界事实。', feedback: '已取消 · 可以重新写下一行。', mark: '×' }
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function clampCamera() {
    const bounds = viewport.getBoundingClientRect();
    const scaledWidth = 1400 * camera.scale;
    const scaledHeight = 900 * camera.scale;
    camera.x = clamp(camera.x, bounds.width - scaledWidth - 80, 80);
    camera.y = clamp(camera.y, bounds.height - scaledHeight - 80, 80);
  }

  function renderCamera() {
    clampCamera();
    canvas.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
    zoomLevel.textContent = `${Math.round(camera.scale * 100)}%`;
  }

  function zoomAt(nextScale, localX = viewport.clientWidth / 2, localY = viewport.clientHeight / 2) {
    const next = clamp(nextScale, .5, 1.2);
    const factor = next / camera.scale;
    camera.x = localX - (localX - camera.x) * factor;
    camera.y = localY - (localY - camera.y) * factor;
    camera.scale = next;
    renderCamera();
  }

  function resetCamera() {
    Object.assign(camera, initialCamera);
    renderCamera();
    showToast('视野已回到当前章节；拖拽可查看视野外的盐场与沉船标记。');
    viewport.focus();
  }

  function setState(next) {
    app.dataset.state = next;
    desk.dataset.state = next;
    const line = copy[next];
    stateLabel.textContent = line.label;
    stateCopy.textContent = line.copy;
    feedback.textContent = line.feedback;
    feedbackMark.textContent = line.mark;
    desk.classList.toggle('is-busy', next === 'processing');
    submit.disabled = next === 'processing' || next === 'accepted';
    input.disabled = next === 'processing' || next === 'accepted';
    cancel.hidden = next !== 'processing';
    retry.hidden = !['landed', 'failed', 'cancelled'].includes(next);
    failureDemo.hidden = next === 'processing' || next === 'accepted';
  }

  function clearTimers() {
    window.clearTimeout(processingTimer);
    window.clearTimeout(landedTimer);
  }

  function wakeActionDesk() {
    desk.classList.add('is-awake');
    desk.scrollIntoView({ behavior: app.classList.contains('effects-off') ? 'auto' : 'smooth', block: 'center' });
    window.setTimeout(() => input.focus(), 120);
  }

  function submitAction(event) {
    event.preventDefault();
    if (!input.value.trim() || desk.dataset.state === 'processing' || desk.dataset.state === 'accepted') {
      if (!input.value.trim()) {
        feedback.textContent = '先写下一句行动，地图才有可供回访的线索。';
        input.focus();
      }
      return;
    }
    clearTimers();
    desk.classList.add('is-awake');
    setState('accepted');
    processingTimer = window.setTimeout(() => setState('processing'), 620);
    landedTimer = window.setTimeout(() => {
      setState('landed');
      input.value = '';
      document.querySelector('.landmark--porch').classList.add('is-selected');
      document.querySelector('.receipt--fact').open = true;
      showToast('fixture 回执：北侧门廊新增一条待阅读注记。');
    }, 2500);
  }

  function cancelAction() {
    clearTimers();
    setState('cancelled');
    showToast('这次处理已取消；没有新的世界事实。');
  }

  function resetAction() {
    clearTimers();
    setState('idle');
    input.disabled = false;
    input.focus();
  }

  function showFailure() {
    clearTimers();
    setState('failed');
    showToast('演示失败回执：结果未落定，行动仍可重试。');
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.hidden = false;
    toast.textContent = message;
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 4200);
  }

  function openDialogue(trigger) {
    activeTrigger = trigger;
    dialogue.hidden = false;
    dialogueClose.focus();
  }

  function closeDialogue() {
    dialogue.hidden = true;
    if (activeTrigger) activeTrigger.focus();
  }

  form.addEventListener('submit', submitAction);
  wakeButton.addEventListener('click', wakeActionDesk);
  cancel.addEventListener('click', cancelAction);
  retry.addEventListener('click', resetAction);
  failureDemo.addEventListener('click', showFailure);
  effectsToggle.addEventListener('click', () => {
    const enabled = !app.classList.toggle('effects-off');
    effectsToggle.setAttribute('aria-pressed', String(enabled));
    effectsToggle.innerHTML = enabled ? '墨迹效果 <span aria-hidden="true">●</span>' : '静态印刷 <span aria-hidden="true">○</span>';
    showToast(enabled ? '墨迹演出已开启。' : '静态印刷模式：文字、状态与操作保持可用。');
  });

  zoomIn.addEventListener('click', () => zoomAt(camera.scale + .1));
  zoomOut.addEventListener('click', () => zoomAt(camera.scale - .1));
  cameraReset.addEventListener('click', resetCamera);
  viewport.addEventListener('wheel', (event) => {
    event.preventDefault();
    const bounds = viewport.getBoundingClientRect();
    zoomAt(camera.scale + (event.deltaY < 0 ? .08 : -.08), event.clientX - bounds.left, event.clientY - bounds.top);
  }, { passive: false });
  viewport.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button, a, input')) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    camera.x += event.clientX - drag.x;
    camera.y += event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    renderCamera();
  });
  viewport.addEventListener('pointerup', (event) => {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    viewport.releasePointerCapture(event.pointerId);
  });
  viewport.addEventListener('pointercancel', () => { drag = null; });

  document.querySelectorAll('[data-dialogue]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      if (trigger.dataset.dialogue === 'sable') {
        showToast('塞布尔目前不在此场景；此入口只展开已有记录。');
        return;
      }
      openDialogue(trigger);
    });
  });
  dialogueClose.addEventListener('click', closeDialogue);
  dialogue.addEventListener('click', (event) => {
    if (event.target === dialogue) closeDialogue();
  });
  dialogueFocus.addEventListener('click', () => {
    closeDialogue();
    wakeActionDesk();
  });

  document.querySelectorAll('[data-reading]').forEach((landmark) => {
    landmark.addEventListener('click', () => {
      document.querySelectorAll('[data-reading]').forEach((item) => item.classList.remove('is-selected'));
      landmark.classList.add('is-selected');
      const descriptions = {
        lighthouse: '旧灯塔：玛罗的守夜页，尚有一段未读对话。',
        salt: '盐场观测点：视野外仍有一盏灯；这是可阅读线索，不是已确认事实。',
        tide: '潮池 04：水位下降的时间与蓝边校样互相呼应。',
        archive: '档案室：蓝边校样是当前可回访的阅读线索。',
        porch: '北侧门廊：入口状态仍是未确认，不把猜测当事实。',
        wreck: '沉船标记：视野外的关系线延伸至此，尚未读取。'
      };
      showToast(descriptions[landmark.dataset.reading]);
    });
  });

  document.querySelector('#show-activity').addEventListener('click', () => {
    const raw = document.querySelector('#raw-activity');
    raw.hidden = !raw.hidden;
    document.querySelector('#show-activity').textContent = raw.hidden ? '展开原始活动流 →' : '收起原始活动流 ↑';
  });
  document.querySelector('#close-page').addEventListener('click', () => showToast('预览页没有连接真实世界；关闭动作在 fixture 中保留为提示。'));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !dialogue.hidden) {
      event.preventDefault();
      closeDialogue();
      return;
    }
    if (document.activeElement === viewport) {
      const pan = 60;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        camera.x += event.key === 'ArrowLeft' ? pan : event.key === 'ArrowRight' ? -pan : 0;
        camera.y += event.key === 'ArrowUp' ? pan : event.key === 'ArrowDown' ? -pan : 0;
        renderCamera();
        return;
      }
      if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomAt(camera.scale + .1); return; }
      if (event.key === '-' || event.key === '_') { event.preventDefault(); zoomAt(camera.scale - .1); return; }
      if (event.key === 'r' || event.key === 'R') { event.preventDefault(); resetCamera(); return; }
    }
    if ((event.key === 'a' || event.key === 'A' || event.key === '/') && document.activeElement !== input && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      wakeActionDesk();
    }
  });

  renderCamera();

  setState('idle');
})();
