(() => {
  const app = document.querySelector('.material-app');
  const stage = document.querySelector('#stage');
  const dialogue = document.querySelector('[data-dialogue]');
  const dialogueBackdrop = document.querySelector('[data-dialogue-backdrop]');
  const nook = document.querySelector('[data-nook]');
  const journal = document.querySelector('#journal');
  const receipt = document.querySelector('[data-receipt]');
  const writerForm = document.querySelector('[data-writer-form]');
  const writerInput = document.querySelector('#writer-input');
  const writerStatus = document.querySelector('[data-writer-status]');
  const statusTitle = document.querySelector('[data-status-title]');
  const statusCopy = document.querySelector('[data-status-copy]');
  const stopButton = document.querySelector('[data-stop]');
  const retryButton = document.querySelector('[data-retry]');
  let activeTimer = 0;
  let lastFocus = null;
  const worldWindow = document.querySelector('[data-world-window]');
  const worldSpace = document.querySelector('[data-world-space]');
  const cameraReadout = document.querySelector('[data-camera-readout]');
  const secondCluster = document.querySelector('.second-cluster');
  const camera = { x: 0, y: 0, scale: 1 };
  let drag = null;
  function renderCamera(label = camera.x < -20 ? 'next cluster' : 'alcove') {
    worldSpace.style.left = `${camera.x}px`;
    worldSpace.style.top = `${camera.y}px`;
    worldSpace.style.zoom = camera.scale;
    worldSpace.classList.toggle('camera-next', label === 'next cluster');
    if (cameraReadout) cameraReadout.value = `camera ${label === 'next cluster' ? '02 / archive' : '01 / alcove'}`;
  }
  function homeCamera() {
    camera.x = 0;
    camera.y = 0;
    camera.scale = 1;
    renderCamera('alcove');
  }
  function nextCamera() {
    camera.x = -Math.max(280, worldWindow.clientWidth * .96);
    camera.y = 0;
    renderCamera('next cluster');
    if (window.matchMedia('(max-width: 42rem)').matches) {
      window.setTimeout(() => secondCluster?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);
    }
  }
  document.querySelectorAll('[data-camera]').forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.camera;
    if (action === 'home') homeCamera();
    if (action === 'next') nextCamera();
    if (action === 'zoom-in') {
      camera.scale = Math.min(1.25, +(camera.scale + .1).toFixed(2));
      renderCamera();
    }
    if (action === 'zoom-out') {
      camera.scale = Math.max(.8, +(camera.scale - .1).toFixed(2));
      renderCamera();
    }
  }));
  worldWindow?.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button, input, textarea, .material-card, .character-card, .window-controls')) return;
    drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, cameraX: camera.x, cameraY: camera.y };
    worldWindow.setPointerCapture(event.pointerId);
    worldWindow.classList.add('is-panning');
  });
  worldWindow?.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    camera.x = drag.cameraX + event.clientX - drag.x;
    camera.y = drag.cameraY + event.clientY - drag.y;
    renderCamera(camera.x < -20 ? 'next cluster' : 'alcove');
  });
  const stopPan = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null;
    worldWindow.classList.remove('is-panning');
  };
  worldWindow?.addEventListener('pointerup', stopPan);
  worldWindow?.addEventListener('pointercancel', stopPan);

  const statusText = {
    ready: ['ready', 'Writer is listening. Your next action will pause the room briefly.'],
    accepted: ['accepted', 'Your mark is queued. The room has not changed yet.'],
    processing: ['processing', 'Writer is checking the action against this room.'],
    landed: ['landed', 'A world fact is recorded on the canvas.'],
    revealed: ['revealed', 'The response is visible; the fact remains on the canvas.'],
    completed: ['completed', 'This action is complete. You can revisit the lantern mark.'],
    failed: ['failed', 'The mark could not land: the room has no safe place for that action. Try a smaller request.'],
    cancelled: ['cancelled', 'The request stopped before changing the room. Your next mark is still available.']
  };

  function setStatus(state) {
    const [label, copy] = statusText[state];
    writerStatus.dataset.state = state;
    statusTitle.textContent = label;
    statusCopy.textContent = copy;
    stopButton.hidden = state !== 'processing';
    retryButton.hidden = state !== 'failed' && state !== 'cancelled';
  }

  function openDialogue() {
    lastFocus = document.activeElement;
    dialogue.hidden = false;
    dialogueBackdrop.hidden = false;
    document.querySelector('[data-dialogue] input')?.focus();
  }
  function closeDialogue() {
    dialogue.hidden = true;
    dialogueBackdrop.hidden = true;
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }
  function openNook() {
    closeDialogue();
    nook.hidden = false;
    nook.querySelector('textarea')?.focus();
  }
  function closeNook() {
    nook.hidden = true;
    document.querySelector('[data-open-dialogue]')?.focus();
  }

  document.querySelector('[data-open-dialogue]')?.addEventListener('click', openDialogue);
  document.querySelector('[data-close-dialogue]')?.addEventListener('click', closeDialogue);
  dialogueBackdrop?.addEventListener('click', closeDialogue);
  document.querySelector('[data-open-nook]')?.addEventListener('click', openNook);
  document.querySelector('[data-close-nook]')?.addEventListener('click', closeNook);

  document.querySelector('[data-dialogue-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = event.currentTarget.querySelector('input');
    const text = input.value.trim();
    if (!text) return;
    const speech = document.querySelector('[data-speech-text]');
    speech.textContent = `“${text}” Iris turns the thought over once. “That belongs to the room now, even if it has not changed the room.”`;
    input.value = '';
    input.placeholder = 'Iris is listening… say another thing';
  });

  document.querySelector('[data-toggle-journal]')?.addEventListener('click', () => {
    const shouldOpen = journal.hidden;
    journal.hidden = !shouldOpen;
    document.querySelectorAll('[data-toggle-journal]').forEach((button) => button.setAttribute('aria-expanded', String(shouldOpen)));
  });
  document.querySelector('[data-toggle-log]')?.addEventListener('click', (event) => {
    const log = document.querySelector('#activity-log');
    const shouldOpen = log.hidden;
    log.hidden = !shouldOpen;
    event.currentTarget.setAttribute('aria-expanded', String(shouldOpen));
    event.currentTarget.textContent = shouldOpen ? 'hide' : 'details';
  });
  document.querySelector('[data-toggle-effects]')?.addEventListener('click', (event) => {
    const enabled = event.currentTarget.getAttribute('aria-pressed') === 'true';
    event.currentTarget.setAttribute('aria-pressed', String(!enabled));
    event.currentTarget.textContent = enabled ? 'Effects off' : 'Effects on';
    app.dataset.effects = enabled ? 'off' : 'on';
  });

  document.querySelectorAll('[data-item-action]').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('[data-item-result]').forEach((result) => {
      result.textContent = 'Held. No world change requested.';
    });
  }));
  document.querySelector('[data-away-character]')?.addEventListener('click', () => {
    const toast = document.querySelector('[data-away-toast]');
    toast.hidden = false;
    window.clearTimeout(toast._hideTimer);
    toast._hideTimer = window.setTimeout(() => { toast.hidden = true; }, 4200);
  });
  document.querySelector('[data-receipt-close]')?.addEventListener('click', () => { receipt.hidden = true; });

  function landWriterAction() {
    setStatus('landed');
    receipt.hidden = false;
    window.setTimeout(() => setStatus('revealed'), 850);
    window.setTimeout(() => setStatus('completed'), 1800);
  }
  function failWriterAction() {
    window.clearTimeout(activeTimer);
    setStatus('accepted');
    activeTimer = window.setTimeout(() => {
      setStatus('processing');
      activeTimer = window.setTimeout(() => setStatus('failed'), 950);
    }, 250);
  }
  writerForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!writerInput.value.trim() || writerStatus.dataset.state === 'processing') return;
    setStatus('accepted');
    activeTimer = window.setTimeout(() => {
      setStatus('processing');
      activeTimer = window.setTimeout(landWriterAction, 1150);
    }, 350);
  });
  stopButton?.addEventListener('click', () => {
    window.clearTimeout(activeTimer);
    setStatus('cancelled');
  });
  retryButton?.addEventListener('click', () => {
    writerInput.focus();
    setStatus('ready');
  });
  document.querySelector('[data-route="failure"]')?.addEventListener('click', failWriterAction);
  document.querySelector('[data-save-note]')?.addEventListener('click', () => {
    const note = document.querySelector('#nook-note');
    const saved = document.querySelector('[data-note-saved]');
    saved.textContent = note.value.trim() ? 'Note pinned to this nook. Iris has not answered.' : 'Write a note first; an empty pin leaves no trace.';
    if (note.value.trim()) note.value = '';
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!nook.hidden) closeNook();
    else if (!dialogue.hidden) closeDialogue();
    else if (!journal.hidden) {
      journal.hidden = true;
      document.querySelectorAll('[data-toggle-journal]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
    }
  });

  renderCamera('alcove');
  setStatus('ready');
})();