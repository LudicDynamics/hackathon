(() => {
  const app = document.querySelector('#app');
  const detailSheet = document.querySelector('#detailSheet');
  const drawer = document.querySelector('#archiveDrawer');
  const drawerButton = document.querySelector('#drawerButton');
  const deskSurface = document.querySelector('#deskSurface');
  const worldCanvas = document.querySelector('#worldCanvas');
  const worldCoordinates = document.querySelector('#worldCoordinates');
  const worldZoom = document.querySelector('#worldZoom');
  const detailTitle = document.querySelector('#detailTitle');
  const detailCode = document.querySelector('#detailCode');
  const detailType = document.querySelector('#detailType');
  const detailSubtitle = document.querySelector('#detailSubtitle');
  const detailBody = document.querySelector('#detailBody');
  const detailEvidence = document.querySelector('#detailEvidence');
  const detailFact = document.querySelector('#detailFact');
  const detailGuess = document.querySelector('#detailGuess');
  const selectItemButton = document.querySelector('#selectItemButton');
  const drawerTitle = document.querySelector('#drawerTitle');
  const drawerCode = document.querySelector('#drawerCode');
  const drawerContent = document.querySelector('#drawerContent');
  const actionDrop = document.querySelector('#actionDrop');
  const dropLabel = document.querySelector('#dropLabel');
  const intentInput = document.querySelector('#intentInput');
  const confirmAction = document.querySelector('#confirmAction');
  const actionHelper = document.querySelector('#actionHelper');
  const statusStrip = document.querySelector('#statusStrip');
  const statusSymbol = document.querySelector('.status-symbol');
  const statusTitle = document.querySelector('#statusTitle');
  const statusMessage = document.querySelector('#statusMessage');
  const detailItems = {
    letter: {
      code: 'E-014 / READ', type: '证据 · 可查阅', title: '蓝色封条信件', subtitle: '纸张 / 昨日 18:12 / 东侧窗边', body: '折痕从左上角开始，像是被匆忙地重新封过。墨迹在“窗户”两个字旁停顿了一次。', evidence: '你亲眼看见：蓝色封条完整，信纸只写了半页。笔迹与林澄在访客簿上的签名相似。', fact: '已落盘：信件于 21:12 被放入“东窗证物”档案，来源已标记为现场拾取。', guess: '也许信件是在她离开后才被封上的。此句不会写入世界事实。', selectable: false
    },
    key: {
      code: 'O-003 / OBJECT', type: '物品 · 可行动', title: '黄铜小钥匙', subtitle: '携带中 / 旧温室 / 可放入行动台', body: '钥匙柄上有一圈被反复摩擦的暗痕。它轻，齿口却有新鲜的白色粉末。', evidence: '你可以检查到：齿痕与西侧储物柜的锁眼宽度吻合；钥匙当前仍在你手里。', fact: '已落盘：黄铜小钥匙属于你的携带物，来源记录为“温室入口地面”。', guess: '它可能打开一扇已经被木板遮住的门。这个方向尚未验证。', selectable: true
    },
    map: {
      code: 'M-021 / NOTE', type: '记录 · 尚未证实', title: '折叠的北墙地图', subtitle: '手绘 / 位置不明 / 档案副本', body: '地图的三道折痕不在同一方向，像是被不同的人展开过。北墙上的红圈没有标注日期。', evidence: '你看见一扇被圈出的门；目前没有在现场找到同样的门框。', fact: '已落盘：地图作为纸面记录存入档案，但地图上的门并未被写入世界事实。', guess: '圈出的门或许只有在雨后才出现。保留为猜测，不替它加一条不存在的路。', selectable: false
    }
  };
  const drawerViews = {
    objects: {
      code: '01', title: '物件索引', html: `<ul class="drawer-list"><li><span class="drawer-symbol">✶</span><div><h3>蓝色封条信件</h3><p>E-014 · 已核验一处笔迹</p></div><button class="list-action" data-detail="letter">取阅 →</button></li><li><span class="drawer-symbol">◈</span><div><h3>黄铜小钥匙</h3><p>O-003 · 携带中 / 可行动</p></div><button class="list-action" data-detail="key">查看 →</button></li><li><span class="drawer-symbol">⌁</span><div><h3>折叠的北墙地图</h3><p>M-021 · 记录 / 一条未证实线索</p></div><button class="list-action" data-detail="map">展开 →</button></li></ul><p class="file-note">档案柜只收纳已经被看见的东西。没有被确认的门，暂时留在纸面上。</p>`
    },
    people: {
      code: '02', title: '人物索引', html: `<ul class="drawer-list"><li><span class="drawer-avatar">林</span><div><h3>林澄</h3><p>在温室 · 等待回应 · 关系：目击者</p></div><button class="list-action" data-private-space>进入私域 →</button></li><li><span class="drawer-avatar" style="background:#7c6d62">你</span><div><h3>档案持有人</h3><p>站在东侧窗边 · 手上有黄铜钥匙</p></div></li></ul><p class="file-note">人物入口是空间的另一扇门。进入私域不会改写证物桌的位置。</p>`
    },
    story: {
      code: '03', title: '故事索引', html: `<div class="fact-record"><span class="tier-label">当前章节 · THE STORY SO FAR</span><p>雨后的温室还没有关灯。林澄说她没有去过北墙，而一封没有写完的信正指向那里。</p></div><div class="fact-record"><span class="tier-label">已落盘事实 · 21:12</span><p>信件已被放入东窗证物档案。地图上的门仍是纸上标记。</p></div><p class="file-note">故事是可回看的纸页，不是第二个舞台。下一条事实必须由一个被确认的行动带来。</p>`
    },
    activity: {
      code: '04', title: '活动与回执', html: `<div class="activity-entry"><time>21:36 · LANDED FACT</time><strong>信件被归档</strong><p>世界事实已落盘：东窗证物柜新增 E-014。桌上的纸张是演出，档案记录才是回访入口。</p></div><div class="activity-entry activity-entry--processing"><time>21:21 · COMPLETED</time><strong>林澄的回应已结束</strong><p>她说：“钥匙不是我的。” 这是角色回应，不等同于新事实。</p></div><div class="activity-entry activity-entry--rejected"><time>21:08 · REJECTED</time><strong>尝试打开北墙</strong><p>没有可进入的门。行动被拒绝，没有改变世界。</p></div><p class="file-note">活动记录回答“系统刚才做了什么”；事实回执回答“世界现在多了什么”。两者不混写。</p>`
    },
    saves: {
      code: '05', title: '存档抽屉', html: `<div class="save-card"><strong>东窗 · 雨后</strong><p>自动存档 · 21:36 · 2 件事实</p><button class="text-button" type="button" data-save-note>这是当前可回访的档案</button></div><div class="save-card"><strong>温室入口</strong><p>手动存档 · 昨日 18:40 · 1 件事实</p><button class="text-button" type="button" data-save-note>仅预览，不覆盖当前桌面</button></div><p class="file-note">存档保存的是已落盘事实，不保存“看起来像发生过”的演出。</p>`
    }
  };
  let selectedItem = null;
  let activeSheetTrigger = null;
  let activeDrawerTrigger = null;
  let busy = false;

  function openDetail(key, trigger) {
    const item = detailItems[key];
    if (!item) return;
    activeSheetTrigger = trigger || document.activeElement;
    detailCode.textContent = item.code;
    detailType.textContent = item.type;
    detailTitle.textContent = item.title;
    detailSubtitle.textContent = item.subtitle;
    detailBody.textContent = item.body;
    detailEvidence.textContent = item.evidence;
    detailFact.textContent = item.fact;
    detailGuess.textContent = item.guess;
    selectItemButton.hidden = !item.selectable;
    selectItemButton.dataset.item = item.selectable ? key : '';
    detailSheet.classList.add('is-open');
    detailSheet.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-surface');
    window.setTimeout(() => (detailSheet.querySelector('.sheet-panel')?.focus()), 30);
  }
  function closeDetail() {
    detailSheet.classList.remove('is-open');
    detailSheet.setAttribute('aria-hidden', 'true');
    activeSheetTrigger?.focus?.();
  }
  function openDrawer(kind, trigger) {
    const view = drawerViews[kind] || drawerViews.people;
    activeDrawerTrigger = trigger || document.activeElement;
    drawerCode.textContent = view.code;
    drawerTitle.textContent = view.title;
    drawerContent.innerHTML = view.html;
    drawer.classList.add('is-open');
    drawerButton.setAttribute('aria-expanded', 'true');
    document.querySelectorAll('.index-tab').forEach(tab => tab.classList.toggle('is-active', tab.dataset.drawer === kind));
    window.setTimeout(() => drawer.querySelector('.drawer-panel')?.focus(), 30);
  }
  function closeDrawer() {
    drawer.classList.remove('is-open');
    drawerButton.setAttribute('aria-expanded', 'false');
    activeDrawerTrigger?.focus?.();
  }
  function setStatus(stage, title, message, stay = 3700) {
    statusSymbol.className = `status-symbol status-symbol--${stage}`;
    statusSymbol.textContent = stage === 'processing' ? '…' : stage === 'landed' ? '✓' : stage === 'rejected' ? '!' : '□';
    statusTitle.textContent = title;
    statusMessage.textContent = message;
    statusStrip.classList.add('is-visible');
    if (stay) window.clearTimeout(setStatus.timer), setStatus.timer = window.setTimeout(() => statusStrip.classList.remove('is-visible'), stay);
  }
  function setSelectedItem(key) {
    const item = detailItems[key];
    if (!item?.selectable) return;
    selectedItem = key;
    actionDrop.classList.add('is-ready');
    actionDrop.innerHTML = `<span class="drop-item">${item.title}</span>`;
    dropLabel.textContent = '';
    actionHelper.textContent = '物品已放上桌。写下一个明确、可被拒绝或落定的意图。';
    confirmAction.disabled = !intentInput.value.trim() || busy;
    closeDetail();
    setStatus('idle', '行动待确认', '黄铜小钥匙已进入行动台；世界还没有改变。');
    intentInput.focus();
  }
  function clearSelection() {
    selectedItem = null;
    actionDrop.classList.remove('is-ready');
    actionDrop.innerHTML = '<span class="drop-plus" aria-hidden="true">+</span><span id="dropLabel">将物品放在这里</span>';
    actionHelper.textContent = '选中或拖入一个物品，写下你要做的事。';
    confirmAction.disabled = true;
  }
  function runAction() {
    if (!selectedItem || !intentInput.value.trim() || busy) return;
    busy = true;
    confirmAction.disabled = true;
    intentInput.disabled = true;
    setStatus('idle', '已接收，等待世界处理', '行动意图已被接受；尚未写入事实。', 0);
    window.setTimeout(() => {
      setStatus('processing', '处理中 · 正在核对锁孔', '这是一次处理中状态，不代表储物柜已经打开。', 0);
      actionDrop.classList.add('is-processing');
    }, 520);
    window.setTimeout(() => {
      busy = false;
      intentInput.disabled = false;
      actionDrop.classList.remove('is-processing');
      setStatus('landed', '已落定 · 行动写入档案', '黄铜钥匙与西侧储物柜的锁孔吻合。世界新增一条可回访事实。');
      actionHelper.textContent = '行动已落定。你可以继续取阅桌面，或保留这条事实。';
      intentInput.value = '';
      clearSelection();
      setTimeout(() => openDrawer('activity', document.querySelector('[data-drawer="activity"]')), 550);
    }, 1850);
  }

  document.querySelectorAll('.evidence-card').forEach(card => {
    card.addEventListener('click', () => openDetail(card.dataset.detail, card));
    card.addEventListener('dragstart', event => {
      if (card.dataset.detail !== 'key') return;
      event.dataTransfer.setData('text/plain', 'key');
      event.dataTransfer.effectAllowed = 'copy';
      card.classList.add('is-dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('is-dragging'));
  });
  selectItemButton.addEventListener('click', () => setSelectedItem(selectItemButton.dataset.item));
  actionDrop.addEventListener('dragover', event => { event.preventDefault(); actionDrop.classList.add('is-over'); });
  actionDrop.addEventListener('dragleave', () => actionDrop.classList.remove('is-over'));
  actionDrop.addEventListener('drop', event => {
    event.preventDefault(); actionDrop.classList.remove('is-over');
    if (event.dataTransfer.getData('text/plain') === 'key') setSelectedItem('key');
  });
  actionDrop.addEventListener('click', () => { if (!selectedItem) openDetail('key', actionDrop); });
  actionDrop.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); actionDrop.click(); } });
  intentInput.addEventListener('input', () => { confirmAction.disabled = !selectedItem || !intentInput.value.trim() || busy; });
  confirmAction.addEventListener('click', runAction);

  document.querySelectorAll('[data-drawer]').forEach(button => button.addEventListener('click', () => openDrawer(button.dataset.drawer, button)));
  drawerButton.addEventListener('click', () => {
    if (drawer.classList.contains('is-open')) closeDrawer(); else openDrawer('people', drawerButton);
  });
  document.querySelector('#privateSpaceButton').addEventListener('click', () => {
    openDrawer('people', document.querySelector('#privateSpaceButton'));
    window.setTimeout(() => {
      const privateButton = drawer.querySelector('[data-private-space]');
      privateButton?.classList.add('is-highlighted');
      setStatus('idle', '私域入口已打开', '林澄的私域是同一空间的另一条入口；先查看她的身份，再决定是否进入。');
    }, 50);
  });
  document.addEventListener('click', event => {
    const close = event.target.closest('[data-close-sheet]');
    if (close) closeDetail();
    const closeDrawerButton = event.target.closest('[data-close-drawer]');
    if (closeDrawerButton) closeDrawer();
    const detailButton = event.target.closest('[data-detail]');
    if (detailButton && !detailButton.classList.contains('evidence-card')) {
      closeDrawer();
      openDetail(detailButton.dataset.detail, detailButton);
    }
    if (event.target.closest('[data-private-space]')) {
      setStatus('idle', '私域入口已准备', '这是林澄的私域入口；它不会伪装成已发生的对话。');
    }
    if (event.target.closest('[data-save-note]')) setStatus('idle', '存档可回访', '已选择档案预览；当前证物桌没有被覆盖。');
  });
  document.querySelector('#statusClose').addEventListener('click', () => statusStrip.classList.remove('is-visible'));
  document.querySelector('#effectsToggle').addEventListener('click', event => {
    const button = event.currentTarget;
    const off = app.classList.toggle('effects-off');
    button.classList.toggle('is-off', off);
    button.setAttribute('aria-pressed', String(!off));
    setStatus('idle', off ? '效果已关闭' : '效果已开启', '纸面、状态文字与行动路径保持可用。');
  });
  const camera = { x: 0, y: 0, zoom: 1 };
  let panStart = null;
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
  function renderCamera() {
    const surfaceWidth = deskSurface.clientWidth;
    const surfaceHeight = deskSurface.clientHeight;
    const worldWidth = worldCanvas.offsetWidth * camera.zoom;
    const worldHeight = worldCanvas.offsetHeight * camera.zoom;
    camera.x = clamp(camera.x, Math.min(0, surfaceWidth - worldWidth), 0);
    camera.y = clamp(camera.y, Math.min(0, surfaceHeight - worldHeight), 0);
    worldCanvas.style.transform = `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`;
    worldZoom.textContent = `${Math.round(camera.zoom * 100)}%`;
    worldCoordinates.textContent = `桌面坐标 ${String(Math.max(0, Math.round(-camera.x / 10))).padStart(3, '0')} / ${String(Math.max(0, Math.round(-camera.y / 10))).padStart(3, '0')}`;
  }
  deskSurface.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('.evidence-card')) return;
    panStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, cameraX: camera.x, cameraY: camera.y };
    deskSurface.classList.add('is-panning');
    deskSurface.setPointerCapture(event.pointerId);
  });
  deskSurface.addEventListener('pointermove', event => {
    if (!panStart || event.pointerId !== panStart.pointerId) return;
    camera.x = panStart.cameraX + event.clientX - panStart.x;
    camera.y = panStart.cameraY + event.clientY - panStart.y;
    renderCamera();
  });
  function finishPan(event) {
    if (!panStart || event.pointerId !== panStart.pointerId) return;
    panStart = null;
    deskSurface.classList.remove('is-panning');
    if (deskSurface.hasPointerCapture(event.pointerId)) deskSurface.releasePointerCapture(event.pointerId);
  }
  deskSurface.addEventListener('pointerup', finishPan);
  deskSurface.addEventListener('pointercancel', finishPan);
  deskSurface.addEventListener('wheel', event => {
    event.preventDefault();
    const rect = deskSurface.getBoundingClientRect();
    const beforeZoom = camera.zoom;
    const nextZoom = clamp(beforeZoom * (event.deltaY < 0 ? 1.08 : .93), .72, 1.45);
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    camera.x = localX - (localX - camera.x) * nextZoom / beforeZoom;
    camera.y = localY - (localY - camera.y) * nextZoom / beforeZoom;
    camera.zoom = nextZoom;
    renderCamera();
  }, { passive: false });
  window.addEventListener('resize', renderCamera);
  renderCamera();
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (detailSheet.classList.contains('is-open')) closeDetail();
    else if (drawer.classList.contains('is-open')) closeDrawer();
  });
})();
