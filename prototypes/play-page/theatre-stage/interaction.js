(() => {
  const shell = document.querySelector('.theatre-shell');
  const focus = document.querySelector('.reading-focus');
  const writerForm = document.querySelector('#writer-form');
  const writerInput = document.querySelector('#writer-input');
  const writerDetail = document.querySelector('#writer-state-detail');
  const receipt = document.querySelector('.fact-receipt');
  const toast = document.querySelector('#toast-line');
  const restoreButton = document.querySelector('.restore-chrome');
  const stateKeys = [...document.querySelectorAll('.state-key')];
  let lastFocus = null;
  let toastTimer = 0;
  let cueTimers = [];
  const viewport = document.querySelector('#world-viewport');
  const plane = document.querySelector('#world-plane');
  const zoomLevel = document.querySelector('#zoom-level');
  const cameraReadout = document.querySelector('#camera-readout');
  const isNarrow = () => window.matchMedia('(max-width: 700px)').matches;
  const camera = { x: isNarrow() ? -180 : -95, y: isNarrow() ? -78 : -74, scale: isNarrow() ? .58 : .85 };
  let drag = null;

  const clampCamera = () => {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const minX = width - (1400 * camera.scale) - 80;
    const minY = height - (760 * camera.scale) - 80;
    camera.x = Math.min(80, Math.max(minX, camera.x));
    camera.y = Math.min(80, Math.max(minY, camera.y));
  };

  const renderCamera = () => {
    clampCamera();
    plane.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
    const percentage = Math.round(camera.scale * 100);
    zoomLevel.textContent = `${percentage}%`;
    zoomLevel.value = `${percentage}%`;
    const act = camera.x < -250 ? '02 / 03' : '01 / 03';
    cameraReadout.textContent = `window ${act} · camera held`;
  };

  const resetCamera = () => {
    camera.x = isNarrow() ? -180 : -95;
    camera.y = isNarrow() ? -78 : -74;
    camera.scale = isNarrow() ? .58 : .85;
    renderCamera();
  };

  const changeZoom = (delta) => {
    const previous = camera.scale;
    camera.scale = Math.min(1.15, Math.max(.52, camera.scale + delta));
    const ratio = camera.scale / previous;
    camera.x = (viewport.clientWidth / 2) - ((viewport.clientWidth / 2) - camera.x) * ratio;
    camera.y = (viewport.clientHeight / 2) - ((viewport.clientHeight / 2) - camera.y) * ratio;
    renderCamera();
  };

  viewport.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) return;
    drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, cameraX: camera.x, cameraY: camera.y };
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    camera.x = drag.cameraX + event.clientX - drag.startX;
    camera.y = drag.cameraY + event.clientY - drag.startY;
    renderCamera();
  });
  viewport.addEventListener('pointerup', () => { drag = null; });
  viewport.addEventListener('pointercancel', () => { drag = null; });
  viewport.addEventListener('wheel', (event) => {
    event.preventDefault();
    changeZoom(event.deltaY > 0 ? -.05 : .05);
  }, { passive: false });

  window.addEventListener('resize', () => {
    if (!drag) renderCamera();
  });
  const showToast = (message) => {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toastTimer = window.setTimeout(() => { toast.textContent = ''; }, 4200);
  };

  const updateWriterState = (stage, detail) => {
    stateKeys.forEach((key) => {
      const isCurrent = key.textContent === stage;
      key.dataset.current = isCurrent ? 'true' : 'false';
      key.setAttribute('aria-current', isCurrent ? 'step' : 'false');
    });
    writerDetail.textContent = detail;
    writerForm.dataset.stage = stage;
  };

  const openFocus = (trigger) => {
    lastFocus = trigger;
    focus.hidden = false;
    document.body.classList.add('has-focus');
    const close = focus.querySelector('[data-action="close-focus"]:not(.focus-backdrop)');
    window.setTimeout(() => close?.focus(), 0);
  };

  const closeFocus = () => {
    focus.hidden = true;
    document.body.classList.remove('has-focus');
    lastFocus?.focus();
  };

  const setImmersive = (enabled) => {
    shell.classList.toggle('is-immersive', enabled);
    restoreButton.hidden = !enabled;
    const button = document.querySelector('[data-action="immersive"]');
    button?.setAttribute('aria-pressed', String(enabled));
    if (!enabled) document.querySelector('[data-action="immersive"]')?.focus();
    else showToast('Immersive mode: controls are behind the curtain. Press Esc to restore.');
  };

  const sendCue = (value) => {
    const intention = value.trim() || 'look closer at the letter';
    cueTimers.forEach((timer) => window.clearTimeout(timer));
    cueTimers = [];
    updateWriterState('accepted', `Cue accepted: “${intention}”`);
    showToast('Accepted · your intention is queued for the writer.');
    cueTimers.push(window.setTimeout(() => {
      updateWriterState('processing', 'Processing · the writer is checking the scene…');
      showToast('Processing · no world fact has landed yet.');
    }, 850));
    cueTimers.push(window.setTimeout(() => {
      updateWriterState('landed', 'Landed · a world receipt is ready to read.');
      receipt.hidden = false;
      showToast('Landed · the conservatory now holds a readable new fact.');
      document.querySelector('[data-entity="letter"]')?.classList.add('is-landed');
    }, 2200));
  };

  document.addEventListener('click', (event) => {
    const cameraAction = event.target.closest('[data-camera]')?.dataset.camera;
    if (cameraAction) {
      if (cameraAction === 'zoom-in') changeZoom(.08);
      if (cameraAction === 'zoom-out') changeZoom(-.08);
      if (cameraAction === 'reset') resetCamera();
      return;
    }

    const entity = event.target.closest('[data-entity]');
    if (entity) {
      const type = entity.dataset.entity;
      if (type === 'letter') openFocus(entity);
      if (type === 'gate') showToast('Focused · the service door is a threshold, not an open passage.');
      if (type === 'chalk') showToast('Reading cue · “the glass remembers a shape.”');
      if (type === 'ledger') showToast('Second act · the ferry ledger is beyond this window, still unopened.');
      if (type === 'bell') showToast('Second act · a bell rope waits at the ferry landing.');
      return;
    }

    const character = event.target.closest('[data-character]');
    if (character) {
      if (character.dataset.character === 'mira') {
        writerInput.value = 'ask Mira about the service door';
        writerInput.focus();
        showToast('Mira is present · your next cue can be addressed to her.');
      } else {
        showToast('Jonah is elsewhere · no conversation started.');
      }
      return;
    }

    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'close-focus') closeFocus();
    if (action === 'immersive') setImmersive(!shell.classList.contains('is-immersive'));
    if (action === 'restore') setImmersive(false);
    if (action === 'effects') {
      const enabled = shell.dataset.effects !== 'off';
      shell.dataset.effects = enabled ? 'off' : 'on';
      event.target.closest('[data-action="effects"]')?.setAttribute('aria-pressed', String(!enabled));
      showToast(enabled ? 'Effects off · scene, status, and action remain available.' : 'Effects on · low light returns to the stage.');
    }
    if (action === 'journal') showToast('Journal · 3 settled entries are available to revisit.');
    if (action === 'story') showToast('Story so far · rain stopped; Mira entered; the letter remains unread.');
    if (action === 'activity') showToast('Activity log · raw cues stay folded here, separate from world receipts.');
    if (action === 'belongings') showToast('Belongings · brass key, field notebook, red thread, matchbook.');
    if (action === 'return') showToast('Return path · the parent scene is one level back.');
    if (action === 'ask-mira') {
      closeFocus();
      writerInput.value = 'ask Mira about the service door';
      writerInput.focus();
      showToast('Cue prepared · press Send cue to address Mira.');
    }
    if (action === 'dismiss-receipt') receipt.hidden = true;
    if (action === 'fail') {
      cueTimers.forEach((timer) => window.clearTimeout(timer));
      cueTimers = [];
      updateWriterState('failed', 'Failed · the writer could not resolve that cue. Try another intention.');
      showToast('Failed · nothing changed in the world; you can revise and send again.');
    }
  });

  writerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    sendCue(writerInput.value);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!focus.hidden) closeFocus();
      else if (shell.classList.contains('is-immersive')) setImmersive(false);
    }
    if (event.key.toLowerCase() === 'i' && document.activeElement !== writerInput) setImmersive(!shell.classList.contains('is-immersive'));
    if (event.key.toLowerCase() === 'j' && document.activeElement !== writerInput) showToast('Journal · 3 settled entries are available to revisit.');
    if (document.activeElement === viewport && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const step = event.shiftKey ? 90 : 45;
      if (event.key === 'ArrowLeft') camera.x += step;
      if (event.key === 'ArrowRight') camera.x -= step;
      if (event.key === 'ArrowUp') camera.y += step;
      if (event.key === 'ArrowDown') camera.y -= step;
      renderCamera();
    }
  });
  renderCamera();

  updateWriterState('accepted', 'Ready for your intention');
})();
