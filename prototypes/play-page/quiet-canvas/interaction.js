(() => {
  const root = document.querySelector('.quiet-canvas');
  const writerPanel = document.querySelector('[data-writer-panel]') || document.querySelector('#writer-panel');
  const writerCollapsed = document.querySelector('[data-writer-collapsed]');
  const writerInput = document.querySelector('#writer-input');
  const writerForm = document.querySelector('[data-writer-form]');
  const writerStatus = document.querySelector('[data-writer-status]');
  const stageLabel = document.querySelector('[data-stage-label]');
  const guidance = document.querySelector('[data-writer-guidance]');
  const stopButton = document.querySelector('[data-stop-action]');
  const receiptCopy = document.querySelector('[data-receipt-copy]');
  const toast = document.querySelector('[data-toast]');
  let activeTimer = null;
  let lastFocus = null;
  const worldViewport = document.querySelector('[data-world-viewport]');
  const worldPlane = document.querySelector('[data-world-plane]');
  const cameraReadout = document.querySelector('[data-camera-readout]');
  const camera = { x: 0, y: 0, scale: 1 };
  let dragState = null;

  function renderCamera() {
    worldPlane.style.setProperty('--camera-x', `${camera.x}px`);
    worldPlane.style.setProperty('--camera-y', `${camera.y}px`);
    worldPlane.style.setProperty('--camera-scale', camera.scale.toFixed(2));
    const remote = camera.x > 180;
    cameraReadout.innerHTML = `<span>WINDOW ${remote ? '02' : '01'}</span> · ${remote ? 'windbreak' : 'center'} · ${Math.round(camera.scale * 100)}%`;
  }

  function zoomCamera(delta) {
    camera.scale = Math.min(1.6, Math.max(.72, Number((camera.scale + delta).toFixed(2))));
    renderCamera();
  }

  worldViewport.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button, input, textarea, summary, a')) return;
    dragState = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    worldViewport.classList.add('is-dragging');
    worldViewport.setPointerCapture(event.pointerId);
  });
  worldViewport.addEventListener('pointermove', (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    camera.x += event.clientX - dragState.x;
    camera.y += event.clientY - dragState.y;
    dragState.x = event.clientX;
    dragState.y = event.clientY;
    renderCamera();
  });
  function endPan(event) {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    dragState = null;
    worldViewport.classList.remove('is-dragging');
  }
  worldViewport.addEventListener('pointerup', endPan);
  worldViewport.addEventListener('pointercancel', endPan);
  worldViewport.addEventListener('wheel', (event) => {
    event.preventDefault();
    zoomCamera(event.deltaY < 0 ? .08 : -.08);
  }, { passive: false });
  worldViewport.addEventListener('keydown', (event) => {
    const moves = { ArrowLeft: [-70, 0], ArrowRight: [70, 0], ArrowUp: [0, -70], ArrowDown: [0, 70] };
    if (moves[event.key]) {
      event.preventDefault();
      camera.x += moves[event.key][0];
      camera.y += moves[event.key][1];
      renderCamera();
    }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomCamera(.08); }
    if (event.key === '-' || event.key === '_') { event.preventDefault(); zoomCamera(-.08); }
  });
  document.querySelector('[data-camera-zoom-out]').addEventListener('click', () => zoomCamera(-.08));
  document.querySelector('[data-camera-zoom-in]').addEventListener('click', () => zoomCamera(.08));
  document.querySelector('[data-camera-reset]').addEventListener('click', () => {
    camera.x = 0;
    camera.y = 0;
    camera.scale = 1;
    renderCamera();
  });
  renderCamera();

  const dialogs = {
    dialogue: document.querySelector('[data-dialogue]'),
    nook: document.querySelector('[data-nook]'),
    worlds: document.querySelector('[data-world-drawer]'),
    bag: document.querySelector('[data-bag]'),
    log: document.querySelector('[data-log]'),
  };

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => { toast.hidden = true; }, 5000);
  }

  function openDialog(name, source) {
    const dialog = dialogs[name];
    if (!dialog) return;
    lastFocus = source || document.activeElement;
    if (!dialog.open) dialog.showModal();
    const focusTarget = dialog.querySelector('input, textarea, button');
    if (focusTarget) window.setTimeout(() => focusTarget.focus(), 20);
  }

  function closeDialog(name) {
    const dialog = dialogs[name];
    if (!dialog) return;
    if (dialog.open) dialog.close();
    if (lastFocus && typeof lastFocus.focus === 'function') window.setTimeout(() => lastFocus.focus(), 20);
  }

  function openContext(source) {
    const context = document.querySelector('#context-chrome');
    context.hidden = false;
    document.querySelectorAll('[aria-controls="context-chrome"]').forEach((button) => button.setAttribute('aria-expanded', 'true'));
    lastFocus = source || document.activeElement;
    const first = context.querySelector('button');
    if (first) first.focus();
  }

  function closeContext() {
    const context = document.querySelector('#context-chrome');
    context.hidden = true;
    document.querySelectorAll('[aria-controls="context-chrome"]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
  }

  function openWriter(source) {
    closeContext();
    writerCollapsed.hidden = true;
    writerPanel.hidden = false;
    document.querySelectorAll('[data-open-writer]').forEach((button) => button.setAttribute('aria-expanded', 'true'));
    lastFocus = source || document.activeElement;
    window.setTimeout(() => writerInput.focus(), 20);
  }

  function closeWriter() {
    if (writerStatus.dataset.state === 'processing') return;
    writerPanel.hidden = true;
    writerCollapsed.hidden = false;
    document.querySelectorAll('[data-open-writer]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
    if (lastFocus && typeof lastFocus.focus === 'function') window.setTimeout(() => lastFocus.focus(), 20);
  }

  function setWriterStage(stage, message) {
    stageLabel.textContent = stage;
    writerStatus.hidden = false;
    writerStatus.dataset.state = stage;
    writerStatus.innerHTML = `<strong>${stage}</strong> · ${message}`;
  }

  function runWriterAction(text) {
    const clean = text.trim();
    if (!clean || writerStatus.dataset.state === 'processing') return;
    setWriterStage('accepted', 'Your intent is held here; checking the room before anything changes.');
    guidance.textContent = 'The fixture is checking one possible action. Stop is safe before it lands.';
    writerInput.disabled = true;
    writerForm.querySelector('button').disabled = true;
    stopButton.hidden = false;
    window.setTimeout(() => {
      if (writerStatus.dataset.state !== 'accepted') return;
      setWriterStage('processing', 'The writer is considering the door, the key, and Mara’s presence.');
    }, 180);
    activeTimer = window.setTimeout(() => {
      activeTimer = null;
      const failed = /fail|forget|nothing/i.test(clean);
      if (failed) {
        setWriterStage('failed', 'No fact landed. Try naming a smaller action, or return to the canvas.');
        guidance.textContent = 'Failure is kept visible. Your room and carried key are unchanged.';
        showToast('Fixture attempt failed · nothing changed');
      } else {
        setWriterStage('landed', 'Fixture fact landed: Mara hears your reason at the tide door.');
        guidance.textContent = 'A result is now readable. Revisit the door or ask Mara what it remembers.';
        receiptCopy.textContent = `Fixture fact landed: “${clean}” was heard at the tide door.`;
        showToast('Fixture fact landed · available to revisit in Activity');
      }
      writerInput.disabled = false;
      writerForm.querySelector('button').disabled = false;
      stopButton.hidden = true;
    }, 1350);
  }

  document.querySelectorAll('[aria-controls="context-chrome"], .focus-hint').forEach((button) => {
    button.addEventListener('click', () => openContext(button));
  });
  document.querySelector('[data-close-context]').addEventListener('click', closeContext);
  document.querySelectorAll('[data-open-writer]').forEach((button) => button.addEventListener('click', () => openWriter(button)));
  document.querySelector('[data-close-writer]').addEventListener('click', closeWriter);
  writerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    runWriterAction(writerInput.value);
  });
  stopButton.addEventListener('click', () => {
    if (writerStatus.dataset.state !== 'processing' && writerStatus.dataset.state !== 'accepted') return;
    window.clearTimeout(activeTimer);
    activeTimer = null;
    setWriterStage('cancelled', 'This attempt was stopped before a fact could land. You can try again.');
    guidance.textContent = 'Cancelled attempts do not change the room. Your draft is still here.';
    writerInput.disabled = false;
    writerForm.querySelector('button').disabled = false;
    stopButton.hidden = true;
  });

  document.querySelector('[data-inspect-door]').addEventListener('click', () => {
    showToast('The tide door is quiet · name a reason in Writer before asking it to change');
  });
  document.querySelector('[data-remote-object]').addEventListener('click', () => {
    showToast('Windbreak ledger inspected · this is a second space in the camera fixture');
  });
  document.querySelector('.entity--mara .presence-marker').addEventListener('click', (event) => openDialog('dialogue', event.currentTarget));
  document.querySelectorAll('[data-open-dialogue]').forEach((button) => button.addEventListener('click', () => openDialog('dialogue', button)));
  document.querySelectorAll('[data-close-dialogue]').forEach((button) => button.addEventListener('click', () => closeDialog('dialogue')));
  document.querySelector('[data-dialogue-form]').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = event.currentTarget.querySelector('input');
    if (!input.value.trim()) return;
    showToast('Dialogue draft held · this prototype does not write to the world');
    input.value = '';
  });
  document.querySelector('[data-open-nook]').addEventListener('click', () => {
    closeDialog('dialogue');
    openDialog('nook');
  });
  document.querySelector('[data-close-nook]').addEventListener('click', () => closeDialog('nook'));
  document.querySelector('[data-note-saved]').addEventListener('click', () => {
    document.querySelector('[data-nook-saved]').hidden = false;
    showToast('Note held locally · not sent to Mara');
  });

  document.querySelector('.worlds-trigger').addEventListener('click', (event) => openDialog('worlds', event.currentTarget));
  document.querySelector('[data-close-drawer]').addEventListener('click', () => closeDialog('worlds'));
  document.querySelectorAll('[data-open-bag]').forEach((button) => button.addEventListener('click', () => openDialog('bag', button)));
  document.querySelector('[data-close-bag]').addEventListener('click', () => closeDialog('bag'));
  document.querySelectorAll('[data-open-log]').forEach((button) => button.addEventListener('click', () => openDialog('log', button)));
  document.querySelector('[data-close-log]').addEventListener('click', () => closeDialog('log'));
  document.querySelectorAll('[data-action="key"]').forEach((button) => button.addEventListener('click', () => {
    showToast('Key action accepted in fixture · open Writer to name the reason');
    receiptCopy.textContent = 'Fixture action held: the brass key is ready at the tide door.';
  }));

  document.addEventListener('keydown', (event) => {
    if (event.key === '?' && !/input|textarea/i.test(document.activeElement.tagName)) {
      event.preventDefault();
      openContext(document.activeElement);
    }
    if (event.key === '/' && !/input|textarea/i.test(document.activeElement.tagName)) {
      event.preventDefault();
      openWriter(document.activeElement);
    }
    if (event.key === 'Escape' && !Object.values(dialogs).some((dialog) => dialog.open)) {
      if (!writerPanel.hidden && writerStatus.dataset.state !== 'processing') closeWriter();
      else if (!document.querySelector('#context-chrome').hidden) closeContext();
    }
  });

  // Expose a tiny fixture toggle for reviewers without adding persistent product state.
  root.addEventListener('dblclick', (event) => {
    if (event.target.closest('button, input, textarea, summary, dialog')) return;
    const next = root.dataset.effects === 'on' ? 'off' : 'on';
    root.dataset.effects = next;
    showToast(`Atmosphere ${next === 'on' ? 'on' : 'off'} · text and actions remain available`);
  });
})();
