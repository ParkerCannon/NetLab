/* NetLab UI — rendering, tools, inspector, guided labs, and the journey log. */
window.NL = window.NL || {};
(function () {
  'use strict';
  const NL = window.NL;
  const M = NL.model;
  const ip = NL.ip;
  const SAVE_KEY = 'netlab.save.v1';
  const LAYOUT_KEY = 'netlab.layout.v1';
  const SAVED_LABS_KEY = 'netlab.labs.v1';
  const MAX_SAVED_LABS = 12;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const CARD_W = 124;
  const CARD_H = 88;
  const LAYOUT_DEFAULTS = {
    paletteW: 92, panelW: 302, dockH: 196,
    paletteHidden: false, panelHidden: false, dockCollapsed: false,
    dockView: 'log',
    speed: 0.5, stepMode: false
  };

  const $ = id => document.getElementById(id);
  const els = {
    lessonSelect: $('lessonSelect'), btnLoad: $('btnLoad'), btnSubnet: $('btnSubnet'),
    btnMac: $('btnMac'), btnIPv6: $('btnIPv6'), btnWireless: $('btnWireless'),
    btnEthernet: $('btnEthernet'), btnOSI: $('btnOSI'), btnRoutingViz: $('btnRoutingViz'),
    btnHelp: $('btnHelp'), btnPanel: $('btnPanel'), btnLayout: $('btnLayout'),
    hintbar: $('hintbar'), hintText: $('hintText'),
    layout: document.querySelector('.layout'),
    palette: $('palette'), workspace: $('workspace'), canvas: $('canvas'),
    links: $('links'), devices: $('devices'), emptyState: $('emptyState'),
    simStatus: $('simStatus'), simStatusText: $('simStatusText'),
    sidepanel: $('sidepanel'), panelClose: $('panelClose'),
    paneLab: $('pane-lab'), paneDevice: $('pane-device'),
    dock: $('dock'), dockToggle: $('dockToggle'), simBadge: $('simBadge'),
    dockTabLog: $('dockTabLog'), dockTabConsole: $('dockTabConsole'),
    logView: $('logView'), consoleView: $('consoleView'),
    consoleDevice: $('consoleDevice'), btnConsoleHelp: $('btnConsoleHelp'),
    btnConsoleClear: $('btnConsoleClear'), consoleOut: $('consoleOut'),
    consoleForm: $('consoleForm'), consolePrompt: $('consolePrompt'), consoleInput: $('consoleInput'),
    speedSelect: $('speedSelect'), btnStop: $('btnStop'), btnClearLog: $('btnClearLog'),
    btnPause: $('btnPause'), btnStep: $('btnStep'), pauseIcon: $('pauseIcon'),
    resizePalette: $('resizePalette'), resizePanel: $('resizePanel'), resizeDock: $('resizeDock'),
    log: $('log'), frameEmpty: $('frameEmpty'),
    frameType: $('frameType'), frameGrid: $('frameGrid'),
    fSrcMac: $('fSrcMac'), fDstMac: $('fDstMac'), fSrcIp: $('fSrcIp'),
    fDstIp: $('fDstIp'), fTtl: $('fTtl'), fProto: $('fProto'),
    toastWrap: $('toastWrap'), modalRoot: $('modalRoot')
  };

  const ui = {
    tool: 'select',
    selectedId: null,
    cableSource: null,
    pingSource: null,
    currentLab: null,
    suppressClick: false,
    lastSize: null,
    settings: Object.assign({}, LAYOUT_DEFAULTS),
    resizing: false
  };

  const consoleState = { cli: null, deviceId: null, started: false };

  const TAG = { arp: 'ARP', switch: 'SWITCH', ip: 'IP', ok: 'OK', warn: 'FAIL', dhcp: 'DHCP' };
  const COLOR = { cyan: '#38d9ff', green: '#3ddc97', amber: '#ffc857', red: '#ff6b6b', purple: '#a78bfa' };

  // =================== tiny utilities ===================
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function now() {
    const d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
  }
  function primary(p) { return p ? p.ip + '/' + p.prefix : ''; }

  function toast(message, kind) {
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.innerHTML = '<span class="dot"></span><span>' + esc(message) + '</span>';
    els.toastWrap.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .25s, transform .25s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(4px)';
      setTimeout(() => el.remove(), 260);
    }, 3300);
  }

  // =================== persistence ===================
  function save() {
    try {
      const payload = {
        snap: M.snapshot(),
        flags: {
          pings: NL.flags.pings,
          routed: NL.flags.routed,
          macLearned: NL.flags.macLearned,
          dhcp: NL.flags.dhcp,
          last: NL.flags.last,
          lastDhcp: NL.flags.lastDhcp,
          dns: NL.flags.dns,
          traces: NL.flags.traces,
          demos: NL.flags.demos,
          udp: NL.flags.udp,
          routing: NL.flags.routing,
          aclDenied: NL.flags.aclDenied,
          aclDenyAdded: NL.flags.aclDenyAdded,
          aclPermitAdded: NL.flags.aclPermitAdded
        }
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch (e) { /* localStorage can be unavailable; the app still works */ }
  }

  function readSavedLabs() {
    try {
      const data = JSON.parse(localStorage.getItem(SAVED_LABS_KEY) || '[]');
      if (!Array.isArray(data)) return [];
      return data.filter(entry =>
        entry && typeof entry.id === 'string' && typeof entry.name === 'string' &&
        entry.snap && Array.isArray(entry.snap.devices) && Array.isArray(entry.snap.links)
      ).slice(0, MAX_SAVED_LABS);
    } catch (e) { return []; }
  }

  function writeSavedLabs(labs) {
    try {
      localStorage.setItem(SAVED_LABS_KEY, JSON.stringify(labs));
      return true;
    } catch (e) { return false; }
  }

  function saveCurrentLab(name) {
    if (!ui.currentLab || ui.currentLab.id !== 'sandbox') return;
    const cleanName = String(name || '').trim().slice(0, 48);
    if (!cleanName) { toast('Give your lab a name before saving.', 'err'); return; }
    const snap = JSON.parse(JSON.stringify(M.snapshot()));
    snap.lessonId = 'sandbox';
    const entry = {
      id: 'lab-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      name: cleanName,
      savedAt: Date.now(),
      snap: snap
    };
    const labs = readSavedLabs();
    labs.unshift(entry);
    if (labs.length > MAX_SAVED_LABS) labs.length = MAX_SAVED_LABS;
    if (!writeSavedLabs(labs)) { toast('This browser could not save that lab (storage may be full).', 'err'); return; }
    renderGuide();
    toast('Saved “' + cleanName + '”.', 'ok');
  }

  function deleteSavedLab(id) {
    const labs = readSavedLabs();
    const next = labs.filter(entry => entry.id !== id);
    if (next.length === labs.length) return;
    if (!writeSavedLabs(next)) { toast('This browser could not update saved labs.', 'err'); return; }
    renderGuide();
    toast('Saved lab deleted.');
  }

  function loadSavedLab(id) {
    const entry = readSavedLabs().find(item => item.id === id);
    if (!entry) { toast('That saved lab is no longer available.', 'err'); return; }
    const snap = JSON.parse(JSON.stringify(entry.snap));
    NL.sim.cancel();
    if (!M.restore(snap)) { toast('That saved lab could not be loaded.', 'err'); return; }
    M.state.lessonId = 'sandbox';

    NL.resetFlags();
    ui.currentLab = NL.missions.get('sandbox');
    ui.selectedId = null;
    ui.cableSource = null;
    ui.pingSource = null;
    els.lessonSelect.value = 'sandbox';
    clearLog();
    clearFrame();
    renderStatus('idle', '');
    setTool('select');
    repairOverlaps();
    refresh();
    captureSize();
    addLog({
      kind: 'ok',
      text: 'Loaded saved lab “' + entry.name + '”.',
      detail: 'Devices, addresses and cables came back from this browser.'
    });
    toast('Loaded “' + entry.name + '”.', 'ok');
  }

  function restoreSession() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return false; }
    if (!data || !data.snap || !M.restore(data.snap)) return false;
    const lab = NL.missions.get(M.state.lessonId);
    if (!lab) return false;
    ui.currentLab = lab;
    if (data.flags) {
      NL.flags.pings = data.flags.pings || {};
      NL.flags.routed = !!data.flags.routed;
      NL.flags.macLearned = !!data.flags.macLearned;
      NL.flags.dhcp = !!data.flags.dhcp;
      NL.flags.last = data.flags.last || null;
      NL.flags.lastDhcp = data.flags.lastDhcp || null;
      NL.flags.dns = data.flags.dns || {};
      NL.flags.traces = data.flags.traces || {};
      NL.flags.demos = data.flags.demos || {};
      NL.flags.udp = data.flags.udp || {};
      NL.flags.routing = data.flags.routing || {};
      NL.flags.aclDenied = !!data.flags.aclDenied;
      NL.flags.aclDenyAdded = !!data.flags.aclDenyAdded;
      NL.flags.aclPermitAdded = !!data.flags.aclPermitAdded;
    }
    els.lessonSelect.value = lab.id;
    ui.selectedId = null;
    repairOverlaps();
    renderAll();
    captureSize();
    addLog({ kind: 'ok', text: 'Restored your saved network.', detail: 'Devices, addresses and learned tables came back from this browser.' });
    return true;
  }

  // =================== layout & simulator settings ===================
  function loadSettings() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null'); } catch (e) { /* ignore */ }
    const s = Object.assign({}, LAYOUT_DEFAULTS, data || {});
    s.paletteW = clamp(Number(s.paletteW) || LAYOUT_DEFAULTS.paletteW, 72, 220);
    s.panelW = clamp(Number(s.panelW) || LAYOUT_DEFAULTS.panelW, 260, 620);
    s.dockH = clamp(Number(s.dockH) || LAYOUT_DEFAULTS.dockH, 110, 460);
    s.speed = clamp(Number(s.speed) || LAYOUT_DEFAULTS.speed, 0.25, 2);
    s.paletteHidden = !!s.paletteHidden;
    s.panelHidden = !!s.panelHidden;
    s.dockCollapsed = !!s.dockCollapsed;
    s.dockView = s.dockView === 'console' ? 'console' : 'log';
    s.stepMode = !!s.stepMode;
    ui.settings = s;
  }

  function saveSettings() {
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(ui.settings)); } catch (e) { /* ignore */ }
  }

  function maxDockHeight() {
    return Math.max(130, Math.min(420, Math.round(window.innerHeight * 0.58)));
  }

  function applyLayout(options) {
    const s = ui.settings;
    const root = document.documentElement;
    const overlay = window.innerWidth <= 1040;
    s.paletteW = clamp(s.paletteW, 72, 220);
    s.panelW = clamp(s.panelW, 260, overlay ? 520 : 620);
    s.dockH = clamp(s.dockH, 110, maxDockHeight());

    root.style.setProperty('--palette-w', s.paletteW + 'px');
    root.style.setProperty('--panel-w', s.panelW + 'px');
    root.style.setProperty('--dock-h', s.dockH + 'px');

    els.layout.classList.toggle('no-palette', !!s.paletteHidden);
    els.layout.classList.toggle('no-panel', !!s.panelHidden);
    els.dock.classList.toggle('collapsed', s.dockCollapsed);
    els.dockToggle.textContent = s.dockCollapsed ? '▸' : '▾';
    els.resizeDock.classList.toggle('disabled', !!s.dockCollapsed);
    renderDockView();
    els.speedSelect.value = String(s.speed);
    syncSimControls();
    if (options && options.reflow) scheduleWorkspaceResize(30);
  }

  function setPanelVisible(visible) {
    ui.settings.panelHidden = !visible;
    applyLayout({ reflow: true });
    saveSettings();
    syncSettingsUI();
  }

  function setPaletteVisible(visible) {
    ui.settings.paletteHidden = !visible;
    applyLayout({ reflow: true });
    saveSettings();
    syncSettingsUI();
  }

  function setDockCollapsed(collapsed) {
    ui.settings.dockCollapsed = !!collapsed;
    applyLayout({ reflow: true });
    saveSettings();
    syncSettingsUI();
  }

  function renderDockView() {
    const view = ui.settings.dockView === 'console' ? 'console' : 'log';
    if (els.logView) els.logView.hidden = view !== 'log';
    if (els.consoleView) els.consoleView.hidden = view !== 'console';
    if (els.dockTabLog) {
      els.dockTabLog.classList.toggle('active', view === 'log');
      els.dockTabLog.setAttribute('aria-selected', view === 'log' ? 'true' : 'false');
    }
    if (els.dockTabConsole) {
      els.dockTabConsole.classList.toggle('active', view === 'console');
      els.dockTabConsole.setAttribute('aria-selected', view === 'console' ? 'true' : 'false');
    }
  }

  function setDockView(view) {
    ui.settings.dockView = view === 'console' ? 'console' : 'log';
    ui.settings.dockCollapsed = false;
    applyLayout({ reflow: true });
    saveSettings();
    syncSettingsUI();
    if (ui.settings.dockView === 'console' && els.consoleInput) {
      setTimeout(() => { if (!els.consoleView.hidden) els.consoleInput.focus(); }, 0);
    }
  }

  function fmtSpeed(value) {
    return String(value).replace(/\.0$/, '') + '×';
  }

  function setSpeed(value) {
    const v = clamp(Number(value) || LAYOUT_DEFAULTS.speed, 0.25, 2);
    ui.settings.speed = v;
    if (NL.sim) NL.sim.speed = v;
    els.speedSelect.value = String(v);
    const slider = $('layoutSpeed');
    if (slider) slider.value = String(v);
    const label = $('layoutSpeedLabel');
    if (label) label.textContent = fmtSpeed(v);
    saveSettings();
  }

  function setStepMode(on) {
    ui.settings.stepMode = !!on;
    if (NL.sim) NL.sim.step = !!on;
    const box = $('layoutStep');
    if (box) box.checked = !!on;
    syncSimControls();
    saveSettings();
  }

  function syncSimControls() {
    if (!els.btnPause) return;
    const running = !!(NL.sim && NL.sim.running);
    const paused = running && !!NL.sim.paused;
    els.btnPause.disabled = !running;
    els.btnStep.disabled = !running;
    els.btnPause.title = paused ? 'Continue (Space)' : 'Pause (Space)';
    els.btnPause.setAttribute('aria-label', paused ? 'Continue simulation' : 'Pause simulation');
    if (els.pauseIcon) els.pauseIcon.setAttribute('href', paused ? '#i-play' : '#i-pause');
    els.btnStep.classList.toggle('active', !!ui.settings.stepMode);
    els.btnStep.title = ui.settings.stepMode
      ? 'Advance one hop (S) — auto-pause is on'
      : 'Advance one hop (S)';
  }

  function togglePause() {
    if (!NL.sim.running) return;
    if (NL.sim.paused) NL.sim.resume();
    else NL.sim.pause();
    syncSimControls();
  }

  function stepSim() {
    if (!NL.sim.running) { toast('Run a ping first, then you can step through it.'); return; }
    NL.sim.stepOnce();
    syncSimControls();
  }

  function syncSettingsUI() {
    const checks = {
      layoutShowPalette: !ui.settings.paletteHidden,
      layoutShowPanel: !ui.settings.panelHidden,
      layoutShowDock: !ui.settings.dockCollapsed,
      layoutStep: !!ui.settings.stepMode
    };
    for (const id in checks) {
      const el = $(id);
      if (el) el.checked = checks[id];
    }
    const ranges = {
      layoutSpeed: ui.settings.speed,
      layoutPaletteW: ui.settings.paletteW,
      layoutPanelW: ui.settings.panelW,
      layoutDockH: ui.settings.dockH
    };
    for (const id in ranges) {
      const el = $(id);
      if (el) el.value = String(ranges[id]);
    }
    const dockLog = $('layoutDockLog');
    const dockConsole = $('layoutDockConsole');
    if (dockLog) dockLog.checked = ui.settings.dockView !== 'console';
    if (dockConsole) dockConsole.checked = ui.settings.dockView === 'console';
    const label = $('layoutSpeedLabel');
    if (label) label.textContent = fmtSpeed(ui.settings.speed);
    els.speedSelect.value = String(ui.settings.speed);
  }

  function updateLayoutValue(key, value) {
    ui.settings[key] = Number(value);
    applyLayout();
    scheduleWorkspaceResize(140);
    saveSettings();
    syncSettingsUI();
  }

  function bindResizer(el, opts) {
    if (!el) return;
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0 || el.hidden) return;
      e.preventDefault();
      const start = opts.axis === 'x' ? e.clientX : e.clientY;
      const base = opts.value();
      let moved = false;
      ui.resizing = true;
      el.classList.add('dragging');
      document.body.classList.add('resizing');
      if (el === els.resizeDock) els.dock.classList.add('dragging');

      function move(ev) {
        const pos = opts.axis === 'x' ? ev.clientX : ev.clientY;
        const delta = (pos - start) * (opts.invert ? -1 : 1);
        if (!moved && Math.abs(delta) < 2) return;
        moved = true;
        opts.set(base + delta);
      }
      function up() {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        document.removeEventListener('pointercancel', up);
        ui.resizing = false;
        el.classList.remove('dragging');
        document.body.classList.remove('resizing');
        els.dock.classList.remove('dragging');
        if (moved) {
          saveSettings();
          scheduleWorkspaceResize(20);
          syncSettingsUI();
        }
      }
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      document.addEventListener('pointercancel', up);
    });

    el.addEventListener('dblclick', () => {
      ui.settings[opts.key] = opts.defaultValue;
      applyLayout();
      scheduleWorkspaceResize(20);
      saveSettings();
      syncSettingsUI();
      toast('Panel size reset.');
    });
  }

  function setupResizers() {
    bindResizer(els.resizePalette, {
      axis: 'x', key: 'paletteW', defaultValue: LAYOUT_DEFAULTS.paletteW,
      value: () => ui.settings.paletteW,
      set: value => { ui.settings.paletteW = value; applyLayout(); }
    });
    bindResizer(els.resizePanel, {
      axis: 'x', invert: true, key: 'panelW', defaultValue: LAYOUT_DEFAULTS.panelW,
      value: () => ui.settings.panelW,
      set: value => { ui.settings.panelW = value; applyLayout(); }
    });
    bindResizer(els.resizeDock, {
      axis: 'y', invert: true, key: 'dockH', defaultValue: LAYOUT_DEFAULTS.dockH,
      value: () => ui.settings.dockH,
      set: value => { ui.settings.dockH = value; applyLayout(); }
    });
  }

  function applyPreset(name) {
    const s = ui.settings;
    if (name === 'balanced') {
      s.paletteHidden = false; s.panelHidden = false; s.dockCollapsed = false;
      s.paletteW = LAYOUT_DEFAULTS.paletteW; s.panelW = LAYOUT_DEFAULTS.panelW; s.dockH = LAYOUT_DEFAULTS.dockH;
    } else if (name === 'canvas') {
      s.paletteHidden = false; s.panelHidden = true; s.dockCollapsed = false;
    } else if (name === 'guide') {
      s.paletteHidden = true; s.panelHidden = false; s.dockCollapsed = true;
      s.panelW = Math.max(360, s.panelW);
    } else if (name === 'zen') {
      s.paletteHidden = true; s.panelHidden = true; s.dockCollapsed = true;
    }
    applyLayout({ reflow: true });
    saveSettings();
    syncSettingsUI();
    toast('Layout: ' + name + '.', 'ok');
  }

  // =================== layout helpers ===================
  function pos(fx, fy) {
    const w = els.workspace.clientWidth || 900;
    const h = els.workspace.clientHeight || 460;
    const x0 = 10, y0 = 10;
    const maxX = Math.max(x0, w - CARD_W - 16);
    const maxY = Math.max(y0, h - CARD_H - 16);
    return {
      x: Math.round(x0 + clamp(fx, 0, 1) * (maxX - x0)),
      y: Math.round(y0 + clamp(fy, 0, 1) * (maxY - y0))
    };
  }

  function center(dev) {
    return { x: dev.x + CARD_W / 2, y: dev.y + CARD_H / 2 };
  }

  function edgePoint(dev, toward) {
    const c = center(dev);
    const dx = toward.x - c.x;
    const dy = toward.y - c.y;
    if (!dx && !dy) return c;
    const scale = 1 / Math.max(Math.abs(dx) / (CARD_W / 2), Math.abs(dy) / (CARD_H / 2));
    return { x: c.x + dx * scale, y: c.y + dy * scale };
  }

  function captureSize() {
    ui.lastSize = { w: els.workspace.clientWidth, h: els.workspace.clientHeight };
  }

  let workspaceResizeTimer = 0;
  function scheduleWorkspaceResize(delay) {
    clearTimeout(workspaceResizeTimer);
    workspaceResizeTimer = setTimeout(resizeWorkspace, delay == null ? 120 : delay);
  }

  function resizeWorkspace() {
    if (ui.resizing) { scheduleWorkspaceResize(120); return; }
    const w = els.workspace.clientWidth;
    const h = els.workspace.clientHeight;
    const prev = ui.lastSize;
    if (prev && prev.w > 0 && prev.h > 0 && (prev.w !== w || prev.h !== h)) {
      const sx = w / prev.w;
      const sy = h / prev.h;
      for (const d of M.state.devices) {
        d.x = clamp(Math.round(d.x * sx), 0, Math.max(0, w - CARD_W));
        d.y = clamp(Math.round(d.y * sy), 0, Math.max(0, h - CARD_H));
      }
      repairOverlaps();
    }
    ui.lastSize = { w, h };
    renderScene();
    save();
  }

  function clampPositions() {
    const w = els.workspace.clientWidth || 900;
    const h = els.workspace.clientHeight || 460;
    for (const d of M.state.devices) {
      d.x = clamp(d.x, 0, Math.max(0, w - CARD_W));
      d.y = clamp(d.y, 0, Math.max(0, h - CARD_H));
    }
  }

  function boxesOverlap(a, b, gap) {
    const m = gap || 0;
    return a.x < b.x + CARD_W + m && b.x < a.x + CARD_W + m &&
      a.y < b.y + CARD_H + m && b.y < a.y + CARD_H + m;
  }

  function hasOverlaps() {
    const list = M.state.devices;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (boxesOverlap(list[i], list[j], 0)) return true;
      }
    }
    return false;
  }

  // Nudge only cards that actually collide; keep custom positions otherwise.
  function repairOverlaps() {
    clampPositions();
    const list = M.state.devices;
    if (!hasOverlaps()) return false;
    const w = els.workspace.clientWidth || 900;
    const h = els.workspace.clientHeight || 460;
    const maxX = Math.max(0, w - CARD_W);
    const maxY = Math.max(0, h - CARD_H);
    const placed = [];

    for (const d of list) {
      const originX = d.x;
      const originY = d.y;
      let guard = 0;
      while (placed.some(p => boxesOverlap(d, p, 0)) && guard++ < 30) {
        const hit = placed.find(p => boxesOverlap(d, p, 0));
        const candidates = [
          { x: hit.x - CARD_W - 8, y: d.y },
          { x: hit.x + CARD_W + 8, y: d.y },
          { x: d.x, y: hit.y - CARD_H - 8 },
          { x: d.x, y: hit.y + CARD_H - 8 }
        ];
        const dist = c => (c.x - originX) * (c.x - originX) + (c.y - originY) * (c.y - originY);
        candidates.sort((a, b) => dist(a) - dist(b));
        let next = null;
        for (const c of candidates) {
          const x = clamp(Math.round(c.x), 0, maxX);
          const y = clamp(Math.round(c.y), 0, maxY);
          if (!placed.some(p => boxesOverlap({ x, y }, p, 0))) { next = { x, y }; break; }
        }
        if (!next) {
          let best = null;
          let bestDist = Infinity;
          for (let y = 0; y <= maxY; y += 12) {
            for (let x = 0; x <= maxX; x += 12) {
              if (placed.some(p => boxesOverlap({ x, y }, p, 0))) continue;
              const dd = (x - originX) * (x - originX) + (y - originY) * (y - originY);
              if (dd < bestDist) { bestDist = dd; best = { x, y }; }
            }
          }
          next = best;
        }
        if (!next) break;
        d.x = next.x;
        d.y = next.y;
      }
      placed.push(d);
    }
    return true;
  }

  // Fresh labs follow the builder's x/y hints: y chooses the topology row,
  // x chooses order within that row. Rows are then spread and vertically centered.
  function arrangeDevices() {
    const list = M.state.devices;
    if (!list.length) return;
    const w = els.workspace.clientWidth || 900;
    const h = els.workspace.clientHeight || 460;
    const pad = 14;
    const gapX = 12;
    const rowTolerance = Math.max(28, CARD_H * 0.6);

    const byY = list.slice().sort((a, b) => a.y - b.y || a.x - b.x);
    const clusters = [];
    let cluster = null;
    for (const d of byY) {
      if (!cluster || Math.abs(d.y - cluster.y) > rowTolerance) {
        cluster = { y: d.y, devices: [] };
        clusters.push(cluster);
      }
      cluster.devices.push(d);
    }

    const maxPerRow = Math.max(1, Math.floor((w - pad * 2 + gapX) / (CARD_W + gapX)));
    const rows = [];
    clusters.forEach(c => {
      const ordered = c.devices.slice().sort((a, b) => a.x - b.x);
      for (let i = 0; i < ordered.length; i += maxPerRow) rows.push(ordered.slice(i, i + maxPerRow));
    });

    const rowGap = rows.length > 1
      ? clamp(Math.floor((h - pad * 2 - rows.length * CARD_H) / (rows.length - 1)), 10, 28)
      : 0;
    const totalH = rows.length * CARD_H + (rows.length - 1) * rowGap;
    const startY = Math.max(pad, Math.round((h - totalH) / 2));
    const span = Math.max(0, w - pad * 2 - CARD_W);

    rows.forEach((row, r) => {
      row.forEach((d, i) => {
        const x = row.length === 1 ? pad + span / 2 : pad + (span * i) / (row.length - 1);
        d.x = Math.round(clamp(x, 0, Math.max(0, w - CARD_W)));
        d.y = Math.round(clamp(startY + r * (CARD_H + rowGap), 0, Math.max(0, h - CARD_H)));
      });
    });
  }

  function freeSpot() {
    const w = els.workspace.clientWidth || 900;
    const h = els.workspace.clientHeight || 460;
    const stepX = CARD_W + 40;
    const stepY = CARD_H + 32;
    const cols = Math.max(1, Math.floor((w - 20) / stepX));
    const rows = Math.max(1, Math.floor((h - 20) / stepY));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = 14 + c * stepX;
        const y = 14 + r * stepY;
        const blocked = M.state.devices.some(d => Math.abs(d.x - x) < CARD_W * 0.8 && Math.abs(d.y - y) < CARD_H * 0.8);
        if (!blocked) return { x, y };
      }
    }
    return pos(0.45, 0.4);
  }

  // =================== scene rendering ===================
  function renderAll() {
    renderScene();
    renderGuide();
    renderInspector();
    updateHint();
    updateChrome();
    save();
  }

  function refresh() {
    renderScene();
    renderGuide();
    renderInspector();
    updateHint();
    updateChrome();
    syncConsoleDevices();
    save();
  }

  function updateChrome() {
    els.emptyState.hidden = M.state.devices.length > 0;
    els.btnStop.disabled = !NL.sim.running;
  }

  function deviceIpLabel(dev) {
    if (dev.type === 'switch' || dev.type === 'hub') {
      const used = M.linksOf(dev.id).length;
      return used + ' of ' + dev.ports.length + ' ports used';
    }
    if (dev.type === 'ap') {
      const ips = dev.ports.filter(p => ip.valid(p.ip)).map(p => primary(p));
      const used = M.linksOf(dev.id).length;
      if (ips.length) return ips[0] + (ips.length > 1 ? ' +' + (ips.length - 1) : '');
      return used + ' link' + (used === 1 ? '' : 's');
    }
    const ips = dev.ports.filter(p => ip.valid(p.ip)).map(p => primary(p));
    if (!ips.length) return '';
    if (dev.type === 'router' && ips.length > 1) return ips[0] + ' +' + (ips.length - 1);
    return ips[0];
  }

  function deviceEl(dev) {
    const info = M.TYPES[dev.type];
    const el = document.createElement('div');
    el.className = 'device';
    el.dataset.id = dev.id;
    el.dataset.type = dev.type;
    el.style.left = dev.x + 'px';
    el.style.top = dev.y + 'px';
    if (ui.selectedId === dev.id) el.classList.add('selected');

    const isCableSource = !!(ui.cableSource && ui.cableSource.deviceId === dev.id);
    if (isCableSource || ui.pingSource === dev.id) el.classList.add('link-source');
    else if (ui.cableSource && M.freePorts(dev).length) el.classList.add('linkable');

    const ok = M.configured(dev);
    const label = deviceIpLabel(dev);
    const lease = M.leaseOf(dev);
    const apipa = dev.ports.some(p => p.apipa && ip.valid(p.ip));
    const pips = dev.ports.map(p =>
      '<i style="' + (M.linkForPort(dev.id, p.id) ? 'background:#3ddc97;box-shadow:0 0 5px rgba(61,220,151,.55)' : '') + '"></i>'
    ).join('');
    const badge = lease ? '<span class="dhcp-badge">DHCP</span>' : (apipa ? '<span class="dhcp-badge" style="background:var(--amber-soft);color:#ffe0a1">APIPA</span>' : '');

    const icon = (dev.type === 'ap') ? 'wifi' : (dev.type === 'wifi' ? 'device' : info.icon);
    el.innerHTML =
      '<div class="status-dot' + (ok ? ' ok' : '') + '"></div>' +
      '<div class="dev-top">' +
        '<div class="dev-icon"><svg class="icon"><use href="#i-' + icon + '"/></svg></div>' +
        '<div class="dev-name">' + esc(dev.name) + '</div>' +
      '</div>' +
      '<div class="dev-ip' + (label ? '' : ' empty') + '" title="' + esc(label) + '">' + esc(label || 'no IP yet') + '</div>' +
      '<div class="dev-type">' + esc(info.label) + badge + '</div>' +
      '<div class="dev-pips">' + pips + '</div>';

    el.addEventListener('pointerdown', e => beginDrag(e, dev, el));
    el.addEventListener('click', () => {
      if (ui.suppressClick) { ui.suppressClick = false; return; }
      onDeviceClick(dev);
    });
    el.addEventListener('dblclick', () => {
      if (ui.tool === 'select') selectDevice(dev.id, true);
    });
    return el;
  }

  function renderScene() {
    els.devices.innerHTML = '';
    for (const dev of M.state.devices) els.devices.appendChild(deviceEl(dev));
    renderLinks();
    els.emptyState.hidden = M.state.devices.length > 0;
  }

  function renderLinks() {
    let html = '';
    for (const link of M.state.links) {
      const a = M.getDevice(link.a.deviceId);
      const b = M.getDevice(link.b.deviceId);
      if (!a || !b) continue;
      const pa = edgePoint(a, center(b));
      const pb = edgePoint(b, center(a));
      html += '<g class="link-group" data-link="' + esc(link.id) + '">' +
        '<line class="link" x1="' + pa.x + '" y1="' + pa.y + '" x2="' + pb.x + '" y2="' + pb.y + '"/>' +
        '<line class="link-hit" data-link-id="' + esc(link.id) + '" x1="' + pa.x + '" y1="' + pa.y + '" x2="' + pb.x + '" y2="' + pb.y + '"/>' +
      '</g>';
    }
    els.links.innerHTML = html;
  }

  // =================== drag & device clicks ===================
  function beginDrag(e, dev, el) {
    if (ui.tool !== 'select' || e.button !== 0) return;
    e.preventDefault();
    const rect = els.canvas.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const originX = dev.x;
    const originY = dev.y;
    let moved = false;
    ui.dragging = dev.id;

    el.classList.add('dragging');

    function move(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      dev.x = Math.round(clamp(originX + dx, 0, rect.width - CARD_W));
      dev.y = Math.round(clamp(originY + dy, 0, rect.height - CARD_H));
      el.style.left = dev.x + 'px';
      el.style.top = dev.y + 'px';
      renderLinks();
    }

    function up() {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      el.classList.remove('dragging');
      ui.dragging = null;
      if (moved) {
        ui.suppressClick = true;
        setTimeout(() => { ui.suppressClick = false; }, 0);
        save();
      }
    }

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  function onDeviceClick(dev) {
    if (ui.tool === 'cable') return onCableClick(dev);
    if (ui.tool === 'ping') return onPingClick(dev);
    if (ui.tool === 'delete') return deleteDevice(dev);
    selectDevice(dev.id, true);
  }

  function selectDevice(id, openDeviceTab) {
    ui.selectedId = id;
    if (id && openDeviceTab) {
      openTab('device');
      openPanel();
    }
    renderScene();
    renderInspector();
    updateChrome();
    syncConsoleDevices();
  }

  function onCableClick(dev) {
    if (!ui.cableSource) {
      const port = M.freePorts(dev)[0];
      if (!port) { toast(dev.name + ' has no free ports.', 'err'); return; }
      ui.cableSource = { deviceId: dev.id, portId: port.id };
      renderScene();
      updateHint();
      toast('Cable starts at ' + dev.name + ' ' + port.name + '. Now click the other device.', 'ok');
      return;
    }

    if (ui.cableSource.deviceId === dev.id) {
      ui.cableSource = null;
      renderScene();
      updateHint();
      return;
    }

    const from = M.getDevice(ui.cableSource.deviceId);
    const fromPort = from && from.ports.find(p => p.id === ui.cableSource.portId);
    const toPort = M.freePorts(dev)[0];
    if (!from || !fromPort) { ui.cableSource = null; renderScene(); return; }
    if (!toPort) { toast(dev.name + ' has no free ports.', 'err'); return; }

    const link = M.addLink(from.id, fromPort.id, dev.id, toPort.id);
    ui.cableSource = null;
    if (!link) { toast('Could not connect those devices.', 'err'); return; }
    refresh();
    toast('Cable: ' + from.name + ' ' + fromPort.name + ' ↔ ' + dev.name + ' ' + toPort.name, 'ok');
  }

  function onPingClick(dev) {
    if (!ui.pingSource) {
      const p = M.primaryPort(dev);
      if (!p || !ip.valid(p.ip)) {
        toast(dev.name + ' has no IP yet. Select it and give it an address first.', 'err');
        return;
      }
      ui.pingSource = dev.id;
      renderScene();
      updateHint();
      toast('Ping from ' + dev.name + '. Now click the destination.', 'ok');
      return;
    }
    if (ui.pingSource === dev.id) {
      ui.pingSource = null;
      renderScene();
      updateHint();
      return;
    }
    const src = ui.pingSource;
    ui.pingSource = null;
    renderScene();
    updateHint();
    startPing(src, dev.id);
  }

  function deleteDevice(dev) {
    if (ui.selectedId === dev.id) ui.selectedId = null;
    if (ui.cableSource && ui.cableSource.deviceId === dev.id) ui.cableSource = null;
    if (ui.pingSource === dev.id) ui.pingSource = null;
    M.removeDevice(dev.id);
    refresh();
    toast('Deleted ' + dev.name + '.');
  }

  function removeLinkById(id) {
    const link = M.getLink(id);
    if (!link) return;
    M.removeLink(id);
    refresh();
    toast('Cable removed.');
  }

  // =================== tools ===================
  function setTool(tool) {
    if (tool !== ui.tool) {
      ui.cableSource = null;
      ui.pingSource = null;
    }
    ui.tool = tool;
    document.querySelectorAll('.palette-btn.tool').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
    renderScene();
    updateHint();
  }

  function updateHint() {
    els.hintbar.dataset.mode = ui.tool;
    let text = '';
    if (ui.tool === 'cable') {
      if (ui.cableSource) {
        const d = M.getDevice(ui.cableSource.deviceId);
        const p = d && d.ports.find(x => x.id === ui.cableSource.portId);
        text = 'Cable from <b>' + esc(d ? d.name : '?') + ' ' + esc(p ? p.name : '') + '</b> — click the other device.';
      } else {
        text = '<b>Cable tool.</b> Click the first device, then the second. Ports are picked automatically.';
      }
    } else if (ui.tool === 'ping') {
      if (ui.pingSource) {
        const d = M.getDevice(ui.pingSource);
        text = 'Ping from <b>' + esc(d ? d.name : '?') + '</b> — click the destination device.';
      } else {
        text = '<b>Ping tool.</b> Click the source device, then the destination. Watch the dock below.';
      }
    } else if (ui.tool === 'delete') {
      text = '<b>Delete tool.</b> Click a device or a cable to remove it.';
    } else {
      text = '<b>Select tool.</b> Click a device to configure it, drag to move. Double-click opens settings.';
    }
    els.hintText.innerHTML = text;
  }

  function addDevice(type) {
    const spot = freeSpot();
    const dev = M.addDevice(type, spot);
    ui.selectedId = dev.id;
    refresh();
    openTab('device');
    openPanel();
    toast('Added ' + dev.name + '.', 'ok');
  }

  // =================== ping runner ===================
  function startPing(srcId, dstId) {
    if (NL.sim.running) NL.sim.cancel();
    setDockCollapsed(false);
    NL.sim.ping(srcId, dstId);
    syncSimControls();
  }

  function startPingFromDevice(dev) {
    setTool('ping');
    ui.pingSource = dev.id;
    renderScene();
    updateHint();
    toast('Now click the destination device.', 'ok');
  }

  function startDhcp(deviceId) {
    const dev = M.getDevice(deviceId);
    if (!dev) { toast('That device is not in this lab.', 'err'); return; }
    setDockCollapsed(false);
    NL.sim.dhcp(deviceId);
    syncSimControls();
  }

  // =================== travel animation hook ===================
  function travel(segment, meta, token) {
    return new Promise(resolve => {
      const from = M.getDevice(segment.from);
      const to = M.getDevice(segment.to);
      if (!from || !to) { resolve(); return; }

      const a = center(from);
      const b = center(to);
      const color = COLOR[meta.color] || COLOR.cyan;
      const group = document.createElementNS(SVGNS, 'g');
      group.setAttribute('pointer-events', 'none');

      const halo = document.createElementNS(SVGNS, 'circle');
      halo.setAttribute('r', '9');
      halo.setAttribute('fill', color);
      halo.setAttribute('opacity', '0.16');

      const dot = document.createElementNS(SVGNS, 'circle');
      dot.setAttribute('r', '4');
      dot.setAttribute('fill', color);
      dot.style.filter = 'drop-shadow(0 0 6px ' + color + ')';

      const label = document.createElementNS(SVGNS, 'text');
      label.setAttribute('font-family', 'JetBrains Mono, Consolas, monospace');
      label.setAttribute('font-size', '8.5');
      label.setAttribute('font-weight', '700');
      label.setAttribute('fill', color);
      label.setAttribute('text-anchor', 'middle');
      label.textContent = meta.label || '';

      group.appendChild(halo);
      group.appendChild(dot);
      group.appendChild(label);
      els.links.appendChild(group);

      const baseDuration = Math.max(70, meta.duration || 420);
      let elapsed = 0;
      let lastTick = performance.now();

      function cleanup() { group.remove(); }
      function frame() {
        if (token !== NL.sim.token) { cleanup(); resolve(); return; }
        const tick = performance.now();
        if (!NL.sim.paused) elapsed += tick - lastTick;
        lastTick = tick;
        const duration = Math.max(70, baseDuration / (NL.sim.speed || 1));
        const p = Math.min(1, elapsed / duration);
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const x = a.x + (b.x - a.x) * e;
        const y = a.y + (b.y - a.y) * e;
        halo.setAttribute('cx', x);
        halo.setAttribute('cy', y);
        dot.setAttribute('cx', x);
        dot.setAttribute('cy', y);
        label.setAttribute('x', x);
        label.setAttribute('y', y - 11);
        if (p < 1) setTimeout(frame, 16);
        else { cleanup(); resolve(); }
      }
      setTimeout(frame, 0);
    });
  }

  // =================== hooks: log, frame, status, done ===================
  function addLog(entry) {
    if (!entry) return;
    const empty = els.log.querySelector('.log-empty');
    if (empty) empty.remove();
    const el = document.createElement('div');
    el.className = 'entry';
    el.dataset.kind = entry.kind || 'ip';
    const tag = TAG[entry.kind] || String(entry.kind || 'LOG').toUpperCase();
    el.innerHTML =
      '<div class="t">' + now() + '</div>' +
      '<div class="tag">' + esc(tag) + '</div>' +
      '<div class="body">' + esc(entry.text) +
        (entry.detail ? '<div class="frame-detail">' + esc(entry.detail) + '</div>' : '') +
      '</div>';
    els.log.appendChild(el);
    while (els.log.children.length > 300) els.log.removeChild(els.log.firstChild);
    els.log.scrollTop = els.log.scrollHeight;
  }

  function clearLog() {
    els.log.innerHTML = '<div class="log-empty">Nothing yet. Run a ping and every step will show up here — ARP, switching, routing, TTL.</div>';
  }

  function clearFrame() {
    els.frameEmpty.hidden = false;
    els.frameType.hidden = true;
    els.frameGrid.hidden = true;
  }

  function renderFrame(frame) {
    if (!frame) { clearFrame(); return; }
    els.frameEmpty.hidden = true;
    els.frameType.hidden = false;
    els.frameGrid.hidden = false;
    els.frameType.textContent = frame.type || 'Frame';
    els.fSrcMac.textContent = frame.srcMac || '—';
    els.fDstMac.textContent = frame.dstMac || '—';
    els.fSrcIp.textContent = frame.srcIp || '—';
    els.fDstIp.textContent = frame.dstIp || '—';
    els.fTtl.textContent = frame.ttl == null ? '—' : String(frame.ttl);
    els.fProto.textContent = frame.proto || '—';
  }

  function renderStatus(stateName, text) {
    els.simBadge.dataset.state = stateName;
    els.simBadge.textContent = stateName;
    const running = stateName === 'running';
    const paused = stateName === 'paused';
    els.simStatus.hidden = !(running || paused);
    els.simStatus.dataset.state = stateName;
    if (text) els.simStatusText.textContent = text;
    els.btnStop.disabled = !(running || paused);
    syncSimControls();
  }

  function onPingDone(result) {
    renderGuide();
    renderInspector();
    updateChrome();
    save();
    setTimeout(syncSimControls, 0);
    if (result && result.type === 'dhcp') {
      if (result.ok) {
        const dev = M.getDevice(result.srcId);
        toast((dev ? dev.name : 'Device') + ' leased ' + result.ip + '/' + result.prefix + '.', 'ok');
      } else {
        toast('DHCP failed. The last warning in the log explains why.', 'err');
      }
      return;
    }
    if (result && result.type === 'dns') {
      toast(result.ok ? 'DNS resolved to ' + result.ip + '.' : 'DNS lookup failed — no matching record.', result.ok ? 'ok' : 'err');
      return;
    }
    if (result && result.type === 'trace') {
      toast(result.ok ? 'Traceroute reached the destination.' : 'Traceroute did not reach the destination.', result.ok ? 'ok' : 'err');
      return;
    }
    if (result && (result.type === 'demo' || result.type === 'udp' || result.type === 'routing')) {
      return;
    }
    if (result && result.ok) {
      const hops = result.hops || 1;
      toast('Reply received — ' + hops + ' hop' + (hops === 1 ? '' : 's') + '.', 'ok');
    } else if (result) {
      toast('Ping failed. The last warning in the log explains why.', 'err');
    }
  }

  // =================== lab guide ===================
  function checkTask(task) {
    try { return !!task.check(); } catch (e) { return false; }
  }

  function savedLabsHtml() {
    const labs = readSavedLabs();
    const rows = labs.length ? labs.map(entry => {
      const date = new Date(Number(entry.savedAt) || Date.now()).toLocaleDateString();
      const count = entry.snap.devices.length;
      return '<div class="saved-lab-row">' +
        '<div class="saved-lab-meta"><b>' + esc(entry.name) + '</b>' +
          '<span>' + esc(date) + ' · ' + count + (count === 1 ? ' device' : ' devices') + '</span></div>' +
        '<button class="btn small" type="button" data-saved-load="' + esc(entry.id) + '">Load</button>' +
        '<button class="mini-del" type="button" data-saved-delete="' + esc(entry.id) + '" title="Delete ' + esc(entry.name) + '" aria-label="Delete ' + esc(entry.name) + '">×</button>' +
      '</div>';
    }).join('') : '<div class="table-empty">No saved labs yet. Build something, then give it a name.</div>';

    return '<div class="saved-labs">' +
      '<div class="section-title">My saved labs</div>' +
      '<form class="route-form saved-lab-form" data-saved-lab-form autocomplete="off">' +
        '<input type="text" name="name" maxlength="48" placeholder="Name this lab" aria-label="Saved lab name">' +
        '<button class="btn small primary" type="submit">Save current lab</button>' +
      '</form>' +
      '<div class="saved-lab-list">' + rows + '</div>' +
      '<div class="hint">Stored in this browser. Up to ' + MAX_SAVED_LABS + ' labs.</div>' +
    '</div>';
  }

  function renderGuide() {
    const lab = ui.currentLab;
    if (!lab) return;
    const tasks = lab.tasks || [];
    const done = tasks.map(t => ({ task: t, done: checkTask(t) }));
    const doneCount = done.filter(x => x.done).length;
    const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
    const next = NL.missions.labs[NL.missions.indexOf(lab.id) + 1];

    const taskHtml = done.map(({ task, done: complete }) => {
      const actions = [];
      if (!complete && task.apply) actions.push('<button class="btn small" data-action="apply" data-task="' + esc(task.id) + '">Fill this in for me</button>');
      const runs = Array.isArray(task.run) ? task.run : (task.run ? [task.run] : []);
      runs.forEach((run, i) => {
        let label = 'Run the ping';
        if (run.type === 'dhcp') label = 'Get ' + run.device + ' an address';
        else if (run.type === 'routing') label = 'Run ' + (run.protocol || 'routing').toUpperCase();
        else if (run.type === 'demo') label = 'Run ' + (run.label || run.demo || 'demo');
        else if (run.type === 'udp') label = 'Send UDP';
        else if (run.type === 'trace') label = 'Run the traceroute';
        else if (run.type === 'dns') label = 'Resolve ' + (run.name || run.query || 'a name');
        else if (run.label) label = run.label;
        actions.push('<button class="btn small" data-action="run" data-task="' + esc(task.id) + '" data-run="' + i + '">' + esc(label) + '</button>');
      });
      if (!complete && task.focus) actions.push('<button class="btn small ghost" data-action="focus" data-task="' + esc(task.id) + '">Show ' + esc(task.focus) + '</button>');
      return '<div class="task' + (complete ? ' done' : '') + '">' +
        '<div class="task-bullet">' + (complete ? '<svg class="icon"><use href="#i-check"/></svg>' : '') + '</div>' +
        '<div class="task-body">' +
          '<div class="task-title">' + esc(task.title) + '</div>' +
          '<div class="task-detail">' + esc(task.detail) + '</div>' +
          (actions.length ? '<div class="task-actions">' + actions.join('') + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');

    els.paneLab.innerHTML =
      '<div class="lab-eyebrow">' +
        '<span class="lab-kicker">' + esc(lab.kicker) + '</span>' +
        '<span class="lab-progress">' + doneCount + ' / ' + tasks.length + ' done</span>' +
      '</div>' +
      '<h2 class="lab-title">' + esc(lab.title) + '</h2>' +
      '<p class="lab-intro">' + esc(lab.intro) + '</p>' +
      '<div class="chips">' + (lab.chips || []).map((c, i) =>
        '<span class="chip ' + (['purple', 'amber', 'green'][i % 3]) + '">' + esc(c) + '</span>').join('') + '</div>' +
      '<div class="progressbar"><i style="width:' + pct + '%"></i></div>' +
      taskHtml +
      (tasks.length && doneCount === tasks.length ?
        '<div class="lab-done"><div class="lab-done-title"><svg class="icon"><use href="#i-check"/></svg> Lab complete</div>' +
        '<div class="lab-done-text">Everything checks out. Try changing one thing and predicting what breaks — that is where the learning sticks.</div></div>' : '') +
      (lab.id === 'sandbox' ? savedLabsHtml() : '') +
      '<div class="guide-tip"><b>Tip:</b> ' + esc(lab.tip) + '</div>' +
      '<div class="lab-foot">' +
        '<button class="btn small ghost" data-action="reset">Reset lab</button>' +
        '<button class="btn small ghost" data-action="clear-data">Clear addresses</button>' +
        '<button class="btn small ghost" data-action="tidy">Tidy layout</button>' +
        (next ? '<button class="btn small primary" data-action="next">Next lab →</button>' : '') +
      '</div>';
  }

  function focusTaskDevice(task) {
    const d = task.focus ? M.byName(task.focus) : null;
    if (!d) { toast((task.focus || 'That device') + ' is not in this lab.', 'err'); return; }
    selectDevice(d.id, true);
  }

  function runTask(task, runIndex) {
    if (!task || !task.run) return;
    const runs = Array.isArray(task.run) ? task.run : [task.run];
    const run = runs[runIndex || 0];
    if (!run) return;
    setDockCollapsed(false);
    if (run.type === 'dhcp') {
      const d = M.byName(run.device);
      if (!d) { toast(run.device + ' is missing — reset the lab.', 'err'); return; }
      startDhcp(d.id);
      return;
    }
    if (run.type === 'routing') {
      const proto = run.protocol || 'ospf';
      NL.sim.routing(proto);
      return;
    }
    if (run.type === 'demo') {
      const a = M.byName(run.from || run.src || run.device) || M.state.devices.find(d => d.type === 'pc' || d.type === 'server' || d.type === 'wifi');
      const b = M.byName(run.to || run.dst) || M.state.devices.find(d => d.id !== (a&&a.id) && (d.type === 'server' || d.type === 'pc' || d.type === 'ap'));
      if (!a || !b) { toast('Need two devices for this demo — reset the lab.', 'err'); return; }
      NL.sim.demo(run.demo || 'tls', a.id, b.id);
      return;
    }
    if (run.type === 'udp') {
      const a = M.byName(run.from);
      const b = M.byName(run.to);
      if (!a || !b) { toast('That device is missing — reset the lab.', 'err'); return; }
      NL.sim.udp(a.id, b.id, { dstPort: run.port || 53, app: run.app || 'DNS query' });
      return;
    }
    if (run.type === 'trace') {
      const a = M.byName(run.from);
      const b = M.byName(run.to);
      if (!a || !b) { toast('That device is missing — reset the lab.', 'err'); return; }
      NL.sim.trace(a.id, b.id);
      return;
    }
    if (run.type === 'dns') {
      const a = M.byName(run.device || run.from);
      if (!a) { toast('That device is missing — reset the lab.', 'err'); return; }
      NL.sim.dns(a.id, run.name || run.query || 'web.local');
      return;
    }
    const a = M.byName(run.from);
    const b = M.byName(run.to);
    if (!a || !b) { toast('That device is missing — reset the lab.', 'err'); return; }
    startPing(a.id, b.id);
  }

  // =================== inspector ===================
  function subnetHint(p) {
    if (!ip.valid(p.ip)) return 'No address yet. Try something like .10 or .20 on this subnet.';
    const net = ip.network(p.ip, p.prefix);
    const bcast = ip.broadcast(p.ip, p.prefix);
    const first = ip.fromInt(ip.toInt(net) + 1);
    const last = ip.fromInt(ip.toInt(bcast) - 1);
    const usable = ip.hostCount(p.prefix);
    const hostNote = ip.isNetworkOrBroadcast(p.ip, p.prefix)
      ? '<span class="warn-text"> That address is the network or broadcast address — hosts cannot use it.</span>'
      : '';
    return 'Network ' + net + '/' + p.prefix + ' · range ' + first + '–' + last + ' · ' + usable + ' usable hosts.' + hostNote;
  }

  function linkState(dev, port) {
    const link = M.linkForPort(dev.id, port.id);
    if (!link) return '<span class="port-linkstate">○ free</span>';
    const other = M.getDevice(M.otherEnd(link, dev.id).deviceId);
    return '<span class="port-linkstate connected">● ' + esc(other ? other.name : 'connected') + '</span>';
  }

  function addressingToggle(dev, p) {
    const auto = !!p.dhcp;
    const attrs = ' data-device="' + esc(dev.id) + '" data-port="' + esc(p.id) + '"';
    return '<div class="segmented" role="group" aria-label="Addressing mode">' +
      '<button type="button" class="seg-btn' + (auto ? '' : ' active') + '" data-addressing="manual"' + attrs + '>Manual</button>' +
      '<button type="button" class="seg-btn' + (auto ? ' active' : '') + '" data-addressing="automatic"' + attrs + '>Automatic</button>' +
    '</div>';
  }

  function leaseCard(dev, p) {
    const lease = p.lease;
    const attrs = ' data-device="' + esc(dev.id) + '" data-port="' + esc(p.id) + '"';
    if (!lease) {
      const apipa = p.apipa && ip.valid(p.ip);
      if (apipa) {
        return '<div class="lease-card">' +
          '<div class="lease-top"><span class="lease-title">APIPA (link-local)</span><span class="lease-pill" style="background:var(--amber-soft);color:#ffe0a1">169.254/16</span></div>' +
          '<div class="lease-row"><span>Address</span><b>' + esc(p.ip) + '/' + p.prefix + '</b></div>' +
          '<div class="lease-row"><span>Gateway</span><b>none</b></div>' +
          '<div class="muted-small">APIPA: when DHCP fails, a host can self-assign 169.254.x.x for same-link communication only (no router, no internet).</div>' +
          '<div class="lease-actions">' +
            '<button type="button" class="btn small" data-dhcp-action="get"' + attrs + '>Try DHCP</button>' +
            '<button type="button" class="btn small ghost" data-apipa-clear="' + esc(dev.id) + '" data-port="' + esc(p.id) + '">Clear</button>' +
          '</div>' +
        '</div>';
      }
      return '<div class="lease-card empty">' +
        '<div class="lease-title">Automatic addressing</div>' +
        '<div class="muted-small">This port has no lease yet. Ask DHCP for an address, or use APIPA if no server answers.</div>' +
        '<div class="lease-actions" style="flex-wrap:wrap">' +
          '<button type="button" class="btn small primary" data-dhcp-action="get"' + attrs + '>Get an address</button>' +
          '<button type="button" class="btn small" data-apipa="' + esc(dev.id) + '" data-port="' + esc(p.id) + '">Use APIPA</button>' +
        '</div>' +
      '</div>';
    }
    return '<div class="lease-card">' +
      '<div class="lease-top"><span class="lease-title">DHCP lease</span><span class="lease-pill">Active</span></div>' +
      '<div class="lease-row"><span>Address</span><b>' + esc(lease.ip) + '/' + lease.prefix + '</b></div>' +
      '<div class="lease-row"><span>Gateway</span><b>' + esc(lease.gateway || 'none') + '</b></div>' +
      '<div class="lease-row"><span>From</span><b>' + esc(lease.serverName || 'DHCP server') + (lease.serverIp ? ' · ' + esc(lease.serverIp) : '') + '</b></div>' +
      '<div class="lease-actions">' +
        '<button type="button" class="btn small" data-dhcp-action="renew"' + attrs + '>Renew</button>' +
        '<button type="button" class="btn small ghost" data-dhcp-action="release"' + attrs + '>Release</button>' +
      '</div>' +
    '</div>';
  }

  function dhcpServerSection(dev) {
    const cfg = dev.dhcp || {};
    const info = M.dhcpServerInfo(dev);
    const on = !!cfg.enabled;
    const attrs = ' data-device="' + esc(dev.id) + '" data-dhcp-field="';
    let html = '<div class="section-title">DHCP server <span>Automatic addressing</span></div>' +
      '<label class="check-row"><input type="checkbox"' + attrs + 'enabled"' + (on ? ' checked' : '') +
        '> Hand out addresses on this LAN</label>';

    if (!on) {
      return html + '<div class="muted-small">Off. Turn this on to run a pool of addresses from this device.</div>';
    }

    html += '<div class="dhcp-form">';
    if (dev.ports.length > 1) {
      const current = dev.ports.find(p => p.id === cfg.interfaceId) ||
        dev.ports.find(p => ip.valid(p.ip)) || dev.ports[0];
      html += '<div class="field"><label>Interface</label><select' + attrs + 'interfaceId">';
      for (const p of dev.ports) {
        html += '<option value="' + esc(p.id) + '"' + (current && current.id === p.id ? ' selected' : '') + '>' +
          esc(p.name + (ip.valid(p.ip) ? ' · ' + p.ip : ' · no IP')) + '</option>';
      }
      html += '</select></div>';
    }
    html += '<div class="field-row">' +
        '<div class="field"><label>Pool start</label><input' + attrs + 'poolStart" value="' + esc(cfg.poolStart) + '" placeholder="192.168.1.100" autocomplete="off"></div>' +
        '<div class="field"><label>Pool end</label><input' + attrs + 'poolEnd" value="' + esc(cfg.poolEnd) + '" placeholder="192.168.1.150" autocomplete="off"></div>' +
      '</div>' +
      '<div class="field"><label>Gateway to hand out</label><input' + attrs + 'gateway" value="' + esc(cfg.gateway) + '" placeholder="optional — 192.168.1.1" autocomplete="off"></div>' +
      '<button type="button" class="btn small" data-suggest-pool="' + esc(dev.id) + '">Suggest a pool</button>' +
    '</div>';

    if (info && !info.ok) {
      html += '<div class="hint err">' + esc(info.error) + '</div>';
    } else if (info && info.ok) {
      html += '<div class="hint ok-text">Serving ' + esc(ip.fromInt(info.start)) + '–' + esc(ip.fromInt(info.end)) +
        ' on ' + esc(info.port.name) + (info.gateway ? ' · gateway ' + esc(info.gateway) : ' · no gateway') + '.</div>';
    }

    const leases = M.pruneLeases(dev);
    html += '<div class="section-title">Active leases <span>' + leases.length + '</span></div>';
    if (!leases.length) {
      html += '<div class="table-empty">No leases yet. Set a PC to Automatic and press Get an address.</div>';
    } else {
      html += '<table class="lease-table"><thead><tr><th>Address</th><th>Client</th><th></th></tr></thead><tbody>';
      for (const lease of leases) {
        const client = M.getDevice(lease.clientId);
        html += '<tr><td>' + esc(lease.ip) + '/' + lease.prefix + '<br><span class="dim">' + esc(lease.mac) + '</span></td>' +
          '<td>' + esc(client ? client.name : 'gone') + '</td>' +
          '<td><button type="button" class="mini-btn" data-forget-lease="' + esc(lease.mac) + '" data-device="' + esc(dev.id) + '" title="Forget this lease">Forget</button></td></tr>';
      }
      html += '</tbody></table>';
    }
    return html;
  }

  function portFields(dev, p) {
    if (p.dhcp) return leaseCard(dev, p);
    const ids = ' data-device="' + esc(dev.id) + '" data-port="' + esc(p.id) + '"';
    let html = '<div class="field-row">' +
        '<div class="field" style="flex:2"><label>IP address</label>' +
          '<input' + ids + ' data-field="ip" value="' + esc(p.ip) + '" placeholder="192.168.1.10">' +
        '</div>' +
        '<div class="field" style="flex:1"><label>Prefix</label>' +
          '<input type="number" min="0" max="32"' + ids + ' data-field="prefix" value="' + p.prefix + '">' +
        '</div>' +
      '</div>';
    if (dev.type !== 'router') {
      html += '<div class="field"><label>Default gateway</label>' +
        '<input' + ids + ' data-field="gateway" value="' + esc(p.gateway) + '" placeholder="optional">' +
      '</div>';
    }
    return html;
  }

  function renderInspector() {
    if (!ui.selectedId) { ui.selectedId = null; }
    const dev = ui.selectedId ? M.getDevice(ui.selectedId) : null;
    if (!dev) {
      els.paneDevice.innerHTML =
        '<div class="insp-empty">' +
          '<svg class="icon"><use href="#i-select"/></svg>' +
          '<div>Click a device to see its addresses,<br>ports and tables.</div>' +
        '</div>';
      return;
    }

    const info = M.TYPES[dev.type];
    let html = '<div class="dev-head">' +
      '<div class="dev-head-icon"><svg class="icon"><use href="#i-' + info.icon + '"/></svg></div>' +
      '<div><div class="dev-head-name">' + esc(dev.name) + '</div>' +
      '<div class="dev-head-type">' + esc(info.label) + ' · ' + dev.ports.length + ' port' + (dev.ports.length === 1 ? '' : 's') + '</div></div>' +
    '</div>';

    html += '<div class="field"><label>Name</label>' +
      '<input data-device="' + esc(dev.id) + '" data-field="name" value="' + esc(dev.name) + '" maxlength="24">' +
    '</div>';

    if (dev.type === 'switch' || dev.type === 'hub') {
      html += '<div class="section-title">Ports <span>' + M.linksOf(dev.id).length + ' of ' + dev.ports.length + ' used</span></div>';
      html += '<table class="mac-table"><thead><tr><th>Port</th><th>State</th><th>MAC</th></tr></thead><tbody>';
      for (const p of dev.ports) {
        html += '<tr><td>' + esc(p.name) + '</td><td>' + linkState(dev, p) + '</td><td>' + esc(p.mac) + '</td></tr>';
      }
      html += '</tbody></table>';

      if (dev.type === 'switch') {
        const entries = Object.keys(dev.macTable);
        html += '<div class="section-title">MAC address table <span>' + entries.length + '</span></div>';
        if (!entries.length) {
          html += '<div class="table-empty">No MACs learned yet. Send traffic through this switch.</div>';
        } else {
          html += '<table class="mac-table"><thead><tr><th>MAC address</th><th>Port</th></tr></thead><tbody>';
          for (const mac of entries) {
            const port = dev.ports.find(p => p.id === dev.macTable[mac]);
            html += '<tr><td>' + esc(mac) + '</td><td>' + esc(port ? port.name : '—') + '</td></tr>';
          }
          html += '</tbody></table>';
        }
      }
    } else {
      if (M.dhcpCapable(dev)) html += dhcpServerSection(dev);

      html += '<div class="section-title">Interfaces <span>IP configuration</span></div>';
      for (const p of dev.ports) {
        html += '<div class="port-block">' +
          '<div class="port-block-top"><span class="port-name">' + esc(p.name) + '</span>' + linkState(dev, p) + '</div>';
        if (dev.type !== 'router') html += addressingToggle(dev, p);
        html += portFields(dev, p);
        if (!p.dhcp) {
          html += '<div class="hint">' + subnetHint(p) + '</div>';
          if (dev.type !== 'router' && ip.valid(p.gateway) && !ip.sameSubnet(p.gateway, p.ip, p.prefix)) {
            html += '<div class="hint err">Gateway is outside this interface’s subnet — packets may not leave.</div>';
          }
        }
        html += '</div>';
      }

      if (dev.type === 'router') {
        const routes = M.routesOf(dev);
        html += '<div class="section-title">Routing table <span>' + routes.length + '</span></div>';
        if (!routes.length) {
          html += '<div class="table-empty">No routes yet. Give an interface an IP address first.</div>';
        } else {
          let staticSeen = 0;
          html += '<table class="route-table"><thead><tr><th>Network</th><th>Via</th><th></th></tr></thead><tbody>';
          routes.forEach(r => {
            const isStatic = !r.connected && (r.proto === 'static' || !r.proto);
            const isDynamic = !r.connected && r.proto && r.proto !== 'static';
            const tag = r.connected ? 'connected' : (isDynamic ? r.proto : 'static');
            const tagClass = r.connected ? 'connected' : (isDynamic ? 'dynamic' : 'static');
            let del = '';
            if (isStatic) {
              del = '<button class="mini-del" data-remove-route="' + staticSeen + '" title="Remove route">×</button>';
              staticSeen++;
            } else if (isDynamic) {
              del = '<span class="dim">' + esc(r.proto.toUpperCase()) + '</span>';
            }
            html += '<tr><td>' + esc(r.network) + '/' + r.prefix + '<br><span class="tag-' + tagClass + '" data-proto="' + esc(tag) + '">' + esc(r.connected ? 'connected' : (isDynamic ? r.proto : 'static')) + '</span></td>' +
              '<td>' + (r.connected ? esc(r.iface) : '→ ' + esc(r.gateway) + '<br><span class="dim">' + esc(r.iface) + '</span>') + '</td>' +
              '<td>' + del + '</td></tr>';
          });
          html += '</tbody></table>';
        }
        html += '<form class="route-form" data-route-form>' +
          '<input name="network" placeholder="Network (10.0.2.0)" autocomplete="off">' +
          '<input name="gateway" placeholder="Next hop (10.0.1.2)" autocomplete="off">' +
          '<input name="prefix" type="number" min="0" max="32" value="24" title="Prefix length">' +
          '<button class="btn" type="submit">Add static route</button>' +
        '</form>';

        html += '<div class="section-title">Dynamic routing <span>Protocols</span></div>' +
          '<div class="field-row">' +
            '<div class="field" style="flex:1"><label>Protocol</label><select data-device="' + esc(dev.id) + '" data-routing-field="protocol">' +
              ['none','ospf','eigrp','bgp','isis'].map(p => '<option value="' + p + '"' + ((dev.routing&&dev.routing.protocol)===p?' selected':'') + '>' + (p==='none'?'Static only':p.toUpperCase()) + '</option>').join('') +
            '</select></div>' +
            '<div class="field" style="flex:1"><label>AS / Area</label><input data-device="' + esc(dev.id) + '" data-routing-field="asn" value="' + esc((dev.routing&&dev.routing.asn)||65001) + '" placeholder="65001"></div>' +
          '</div>' +
          '<div class="insp-actions">' +
            '<button class="btn small" data-routing-run="' + esc(dev.id) + '">Run ' + esc(((dev.routing&&dev.routing.protocol)||'ospf').toUpperCase()) + ' convergence</button>' +
            '<button class="btn small ghost" data-routing-clear="' + esc(dev.id) + '">Clear dynamic routes</button>' +
          '</div>' +
          '<div class="hint">OSPF/IS-IS are link-state, EIGRP is an advanced distance-vector (hybrid), and BGP is a path-vector protocol used between autonomous systems. This sim shows simplified neighbor hellos/updates and installs learned routes.</div>';
      }

      const macEntries = Object.entries(dev.macTable || {});

      if (dev.type === 'switch' || dev.type === 'ap') {
        if (dev.type === 'ap') {
          html += '<div class="section-title">Wi-Fi access point <span>802.11</span></div>' +
            '<div class="hint">An AP bridges wireless/wired clients at Layer 2. This sim models it like a switch with Wi-Fi settings for learning. Use the Wi-Fi/WPA2 demo to see association and handshake.</div>';
        }
        html += '<div class="section-title">' + (dev.type === 'ap' ? 'Forwarding table' : 'MAC table') + ' <span>' + macEntries.length + '</span></div>';
        if (!macEntries.length) {
          html += '<div class="table-empty">No MAC addresses learned yet. Run traffic through this ' + (dev.type === 'ap' ? 'AP' : 'switch') + '.</div>';
        } else {
          html += '<table class="mac-table"><thead><tr><th>MAC address</th><th>Port</th></tr></thead><tbody>';
          for (const [mac, portId] of macEntries) {
            const port = dev.ports.find(p => p.id === portId);
            html += '<tr><td>' + esc(mac) + '</td><td>' + esc(port ? port.name : '—') + '</td></tr>';
          }
          html += '</tbody></table>';
        }
        html += '<div class="section-title">Port VLANs <span>802.1Q</span></div>' +
          '<div class="muted-small">Access ports carry one VLAN (untagged). Trunk ports carry multiple VLANs (tagged). Devices in different VLANs are isolated at Layer 2 unless routed.</div>';
        dev.ports.forEach(p => {
          const mode = p.mode || 'access';
          html += '<div class="port-card">' +
            '<div class="port-header"><span class="port-name">' + esc(p.name) + '</span>' + linkState(dev, p) + '</div>' +
            '<div class="field-row">' +
              '<div class="field" style="flex:1"><label>Mode</label><select data-device="' + esc(dev.id) + '" data-port="' + esc(p.id) + '" data-vlan-field="mode">' +
                '<option value="access"' + (mode==='access'?' selected':'') + '>Access</option>' +
                '<option value="trunk"' + (mode==='trunk'?' selected':'') + '>Trunk</option>' +
              '</select></div>' +
              '<div class="field" style="flex:1"><label>' + (mode==='trunk'?'Native VLAN':'VLAN') + '</label><input data-device="' + esc(dev.id) + '" data-port="' + esc(p.id) + '" data-vlan-field="vlan" type="number" min="1" max="4094" value="' + esc(p.vlan || 1) + '"></div>' +
            '</div>' +
            (mode === 'trunk' ? '<div class="field"><label>Allowed VLANs</label><input data-device="' + esc(dev.id) + '" data-port="' + esc(p.id) + '" data-vlan-field="trunkVlans" value="' + esc(p.trunkVlans || '1') + '" placeholder="1,10,20"></div>' : '') +
          '</div>';
        });
      } else if (dev.type === 'hub') {
        html += '<div class="section-title">How hubs work</div>';
        html += '<div class="table-empty">Hubs are the older, simpler cousins of switches. They copy every frame out of every other port — no learning, no filtering, no VLANs.</div>';
      }

      if (dev.type === 'pc' || dev.type === 'server' || dev.type === 'wifi') {
        html += '<div class="section-title">Protocol demos <span>More protocols</span></div>' +
          '<div class="muted-small">Simulated, simplified exchanges to show how each protocol works.</div>' +
          '<div class="insp-actions" style="flex-wrap:wrap">' +
            '<button class="btn small" data-udp-send="1">Send UDP</button>' +
            '<button class="btn small" data-protocol-demo="http">HTTP</button>' +
            '<button class="btn small" data-protocol-demo="https">HTTPS</button>' +
            '<button class="btn small" data-protocol-demo="tls">TLS</button>' +
            '<button class="btn small" data-protocol-demo="ssh">SSH</button>' +
            '<button class="btn small" data-protocol-demo="ftp">FTP</button>' +
            '<button class="btn small" data-protocol-demo="smtp">SMTP</button>' +
            '<button class="btn small" data-protocol-demo="ntp">NTP</button>' +
            '<button class="btn small" data-protocol-demo="snmp">SNMP</button>' +
            '<button class="btn small" data-protocol-demo="syslog">Syslog</button>' +
            '<button class="btn small" data-protocol-demo="ipsec">IPsec</button>' +
            '<button class="btn small" data-protocol-demo="radius">RADIUS</button>' +
            '<button class="btn small" data-protocol-demo="tacacs">TACACS+</button>' +
            '<button class="btn small" data-protocol-demo="dot1x">802.1X</button>' +
            '<button class="btn small" data-protocol-demo="wifi">Wi-Fi/WPA2</button>' +
            '<button class="btn small" data-protocol-demo="wpa3">WPA3</button>' +
            '<button class="btn small" data-protocol-demo="dhcpv6">DHCPv6</button>' +
            '<button class="btn small" data-protocol-demo="slaac">SLAAC</button>' +
          '</div>' +
          '<div class="hint"><b>UDP</b> is connectionless. <b>HTTP/HTTPS</b> serve web content (80/443). <b>SSH</b> (22), <b>FTP</b> (21), <b>SMTP</b> (25) are common TCP services. <b>NTP</b> (123/UDP) syncs time, <b>SNMP</b> (161/UDP) monitors, <b>Syslog</b> (514/UDP) centralizes logs. <b>TLS/IPsec</b> secure traffic. <b>RADIUS/TACACS+/802.1X</b> handle AAA/access. <b>DHCPv6/SLAAC</b> are IPv6 addressing mechanisms.</div>';

        const dnsRecs = (dev.dns && Array.isArray(dev.dns.records)) ? dev.dns.records : [];
        html += '<div class="section-title">DNS <span>Name resolution</span></div>' +
          '<label class="check-row"><input type="checkbox" data-device="' + esc(dev.id) + '" data-dns-field="enabled"' + (dev.dns && dev.dns.enabled ? ' checked' : '') + '> Act as DNS server (simplified)</label>' +
          '<div class="field"><label>DNS query (from this host)</label><div class="field-row"><input id="dnsQueryName" placeholder="web.local" autocomplete="off"><button class="btn small" data-dns-resolve="' + esc(dev.id) + '">Resolve</button></div></div>' +
          '<div class="hint">DNS maps names to IPs (A records). Queries commonly use UDP port 53.</div>' +
          '<div class="section-title">DNS records <span>' + dnsRecs.length + '</span></div>';
        if (!dnsRecs.length) html += '<div class="table-empty">No records. Add A records on a DNS server device.</div>';
        else {
          html += '<table class="route-table"><thead><tr><th>Name</th><th>IP</th><th></th></tr></thead><tbody>';
          dnsRecs.forEach((r,i) => {
            html += '<tr><td>' + esc(r.name||'') + '</td><td>' + esc(r.ip||'') + '</td><td><button class="mini-del" data-remove-dns="' + i + '" title="Remove">×</button></td></tr>';
          });
          html += '</tbody></table>';
        }
        html += '<form class="route-form" data-dns-form>' +
          '<input name="name" placeholder="Name (web.local)" autocomplete="off">' +
          '<input name="ip" placeholder="IP (192.168.1.20)" autocomplete="off">' +
          '<button class="btn" type="submit">Add A record</button>' +
        '</form>';

        const svc = dev.services || {};
        html += '<div class="section-title">Services <span>Common ports</span></div>' +
          '<div class="muted-small">Toggle services this device offers (educational labels for demos/labs).</div>' +
          '<div class="field-row" style="flex-wrap:wrap;gap:8px">' +
            [['http','HTTP 80'],['https','HTTPS 443'],['ssh','SSH 22'],['ftp','FTP 21'],['smtp','SMTP 25'],['dns','DNS 53'],['ntp','NTP 123'],['snmp','SNMP 161'],['syslog','Syslog 514']].map(x =>
              '<label class="check-row" style="margin:0;display:inline-flex;padding:5px 9px"><input type="checkbox" data-device="' + esc(dev.id) + '" data-service-field="' + x[0] + '"' + (svc[x[0]] ? ' checked' : '') + '> ' + x[1] + '</label>'
            ).join('') +
          '</div>';

        html += '<div class="section-title">Diagnostics <span>Path discovery</span></div>' +
          '<div class="insp-actions"><button class="btn small" data-trace-run="' + esc(dev.id) + '">Traceroute from here</button></div>' +
          '<div class="hint">Traceroute (tracert) discovers hops by sending probes with increasing TTL and listening for ICMP Time Exceeded replies.</div>';

      } else if (dev.type === 'ap') {
        html += '<div class="section-title">Protocol demos <span>Wi-Fi & security</span></div>' +
          '<div class="insp-actions" style="flex-wrap:wrap">' +
            '<button class="btn small" data-protocol-demo="wifi">Wi-Fi/WPA2</button>' +
            '<button class="btn small" data-protocol-demo="wpa3">WPA3</button>' +
            '<button class="btn small" data-protocol-demo="dot1x">802.1X</button>' +
            '<button class="btn small" data-protocol-demo="radius">RADIUS</button>' +
          '</div>';
      }

      if (dev.type === 'router') {
        const nat = dev.nat || { enabled: false, mode: 'pat', inside: '', outside: '' };
        const acl = dev.acl || { enabled: false, rules: [] };
        html += '<div class="section-title">NAT / PAT <span>Address translation</span></div>' +
          '<label class="check-row"><input type="checkbox" data-device="' + esc(dev.id) + '" data-nat-field="enabled"' + (nat.enabled ? ' checked' : '') + '> Enable NAT (simplified)</label>' +
          '<div class="field-row"><div class="field" style="flex:1"><label>Mode</label><select data-device="' + esc(dev.id) + '" data-nat-field="mode">' +
            '<option value="pat"' + (nat.mode==='pat'?' selected':'') + '>PAT/NAPT (many-to-one)</option>' +
            '<option value="static"' + (nat.mode==='static'?' selected':'') + '>Static (1:1 demo)</option>' +
          '</select></div></div>' +
          '<div class="field-row"><div class="field" style="flex:1"><label>Inside network</label><input data-device="' + esc(dev.id) + '" data-nat-field="inside" value="' + esc(nat.inside||'') + '" placeholder="192.168.1.0/24"></div>' +
          '<div class="field" style="flex:1"><label>Outside interface IP</label><input data-device="' + esc(dev.id) + '" data-nat-field="outside" value="' + esc(nat.outside||'') + '" placeholder="203.0.113.1"></div></div>' +
          '<div class="hint">NAT translates private/internal addresses to public/external addresses; PAT overloads one public IP using ports. (Conceptual in this simulator.)</div>';

        const rules = Array.isArray(acl.rules) ? acl.rules : [];
        html += '<div class="section-title">ACL / firewall <span>' + rules.length + ' rule(s)</span></div>' +
          '<label class="check-row"><input type="checkbox" data-device="' + esc(dev.id) + '" data-acl-field="enabled"' + (acl.enabled ? ' checked' : '') + '> Enable ACL filtering (simplified)</label>';
        if (!rules.length) html += '<div class="table-empty">No rules. When enabled with no rules, traffic is permitted (implicit permit in this model).</div>';
        else {
          html += '<table class="route-table"><thead><tr><th>Action</th><th>Proto</th><th>Src</th><th>Dst</th><th></th></tr></thead><tbody>';
          rules.forEach((r,i)=> {
            html += '<tr><td>' + esc(r.action||'permit') + '</td><td>' + esc(r.proto||'any') + '</td><td>' + esc(r.src||'any') + '</td><td>' + esc(r.dst||'any') + '</td><td><button class="mini-del" data-remove-acl="' + i + '">×</button></td></tr>';
          });
          html += '</tbody></table>';
        }
        html += '<form class="route-form" data-acl-form>' +
          '<select name="action"><option value="permit">permit</option><option value="deny">deny</option></select>' +
          '<input name="proto" placeholder="proto (icmp/tcp/udp/any)" autocomplete="off">' +
          '<input name="src" placeholder="src IP or any" autocomplete="off">' +
          '<input name="dst" placeholder="dst IP or any" autocomplete="off">' +
          '<button class="btn" type="submit">Add rule</button>' +
        '</form>' +
        '<div class="hint">ACLs filter traffic by criteria (src/dst/protocol). Real firewalls/ACLs evaluate top-down with implicit deny; this teaching model is simplified.</div>';
      }

      const arpEntries = Object.keys(dev.arp);
      html += '<div class="section-title">ARP table <span>' + arpEntries.length + '</span></div>';
      if (!arpEntries.length) {
        html += '<div class="table-empty">No ARP entries yet. Pings fill this table.</div>';
      } else {
        html += '<table class="arp-table"><thead><tr><th>IP address</th><th>MAC address</th></tr></thead><tbody>';
        for (const addr of arpEntries) {
          html += '<tr><td>' + esc(addr) + '</td><td>' + esc(dev.arp[addr]) + '</td></tr>';
        }
        html += '</tbody></table>';
      }
    }

    html += '<div class="insp-actions">' +
      '<button class="btn small" data-device-action="ping">Ping from here</button>' +
      '<button class="btn small ghost danger-btn" data-device-action="delete">Delete</button>' +
    '</div>';

    const scroll = els.paneDevice.scrollTop;
    els.paneDevice.innerHTML = html;
    els.paneDevice.scrollTop = scroll;
  }

  function afterConfigChange() {
    M.clearL2Data();
    NL.resetTrafficFlags();
    const scroll = els.paneDevice.scrollTop;
    renderScene();
    renderGuide();
    renderInspector();
    els.paneDevice.scrollTop = scroll;
    syncConsoleDevices();
    save();
  }

  // =================== inspector events ===================
  function handleDhcpField(input, dev, field) {
    if (!dev.dhcp) dev.dhcp = { enabled: false, interfaceId: '', poolStart: '', poolEnd: '', gateway: '' };
    if (field === 'enabled') {
      dev.dhcp.enabled = !!input.checked;
      afterConfigChange();
      toast(dev.dhcp.enabled ? dev.name + ' is now a DHCP server.' : dev.name + ' stopped handing out addresses.',
        dev.dhcp.enabled ? 'ok' : undefined);
      return;
    }
    if (field === 'interfaceId') {
      dev.dhcp.interfaceId = input.value;
      afterConfigChange();
      return;
    }
    const value = input.value.trim();
    if (value && !ip.valid(value)) {
      input.classList.add('invalid');
      toast('That is not a valid IPv4 address. Use four numbers from 0–255, like 192.168.1.100.', 'err');
      return;
    }
    input.classList.remove('invalid');
    dev.dhcp[field] = value;
    afterConfigChange();
  }

  function handleFieldChange(input) {
    const dev = M.getDevice(input.dataset.device);
    if (!dev) return;
    const field = input.dataset.field;
    const dhcpField = input.dataset.dhcpField;
    const routingField = input.dataset.routingField;
    const vlanField = input.dataset.vlanField;
    const dnsField = input.dataset.dnsField;
    const natField = input.dataset.natField;
    const aclField = input.dataset.aclField;
    const serviceField = input.dataset.serviceField;
    if (dhcpField) { handleDhcpField(input, dev, dhcpField); return; }
    if (dnsField) {
      if (!dev.dns) dev.dns = { enabled: false, records: [] };
      if (dnsField === 'enabled') dev.dns.enabled = !!input.checked;
      renderInspector(); save();
      return;
    }
    if (natField) {
      if (!dev.nat) dev.nat = { enabled: false, mode: 'pat', inside: '', outside: '', statics: [] };
      if (natField === 'enabled') dev.nat.enabled = !!input.checked;
      else dev.nat[natField] = input.value.trim();
      renderInspector(); save();
      return;
    }
    if (aclField) {
      if (!dev.acl) dev.acl = { enabled: false, rules: [] };
      if (aclField === 'enabled') dev.acl.enabled = !!input.checked;
      renderInspector(); save();
      return;
    }
    if (serviceField) {
      if (!dev.services) dev.services = {};
      dev.services[serviceField] = !!input.checked;
      renderInspector(); save();
      return;
    }
    if (routingField) {
      if (!dev.routing) dev.routing = { protocol: 'none', asn: 65001, area: 0, routerId: '', network: '' };
      if (routingField === 'asn') dev.routing.asn = Number(input.value) || 65001;
      else dev.routing[routingField] = input.value;
      renderInspector(); save();
      return;
    }
    if (vlanField) {
      const port = dev.ports.find(p => p.id === input.dataset.port);
      if (!port) return;
      if (vlanField === 'mode') port.mode = input.value;
      else if (vlanField === 'vlan') port.vlan = Math.max(1, Math.min(4094, Number(input.value) || 1));
      else if (vlanField === 'trunkVlans') port.trunkVlans = input.value;
      renderInspector(); save();
      return;
    }
    const port = input.dataset.port ? dev.ports.find(p => p.id === input.dataset.port) : null;

    if (field === 'name') {
      const value = input.value.trim();
      if (!value) { input.classList.add('invalid'); toast('A device needs a name.', 'err'); return; }
      if (M.state.devices.some(d => d.id !== dev.id && d.name === value)) {
        input.classList.add('invalid');
        toast('Another device is already called ' + value + '.', 'err');
        return;
      }
      input.classList.remove('invalid');
      dev.name = value;
      renderScene();
      renderGuide();
      renderInspector();
      save();
      return;
    }

    if (!port) return;

    if (field === 'ip' || field === 'gateway') {
      const value = input.value.trim();
      if (value && !ip.valid(value)) {
        input.classList.add('invalid');
        toast('That is not a valid IPv4 address. Use four numbers from 0–255, like 192.168.1.10.', 'err');
        return;
      }
      input.classList.remove('invalid');
      port[field] = value;
      afterConfigChange();
      return;
    }

    if (field === 'prefix') {
      const value = Number(input.value);
      if (!Number.isInteger(value) || value < 0 || value > 32) {
        input.classList.add('invalid');
        toast('Prefix must be a whole number from 0 to 32. /24 is the usual choice.', 'err');
        return;
      }
      input.classList.remove('invalid');
      port.prefix = value;
      afterConfigChange();
    }
  }

  function setAddressing(dev, port, mode) {
    if (!port) return;
    if (mode === 'automatic') {
      // A DHCP client starts with no address of its own. Clear any hand-typed
      // one so the first ping cannot accidentally use a stale static address.
      if (!port.lease) {
        port.ip = '';
        port.gateway = '';
      }
      port.dhcp = true;
      afterConfigChange();
      toast(dev.name + ' will now ask for an address automatically.', 'ok');
      return;
    }
    // Switching back to manual keeps the address you can see, but stops it being a lease.
    if (port.lease) {
      for (const d of M.state.devices) {
        if (Array.isArray(d.dhcpLeases)) d.dhcpLeases = d.dhcpLeases.filter(l => l.mac !== port.mac);
      }
    }
    port.lease = null;
    port.dhcp = false;
    afterConfigChange();
    toast(dev.name + ' is using a manual address now.', 'ok');
  }

  function handleInspectorClick(e) {
    const modeBtn = e.target.closest('[data-addressing]');
    if (modeBtn) {
      const dev = ui.selectedId ? M.getDevice(ui.selectedId) : null;
      if (!dev) return;
      const port = dev.ports.find(p => p.id === modeBtn.dataset.port);
      setAddressing(dev, port, modeBtn.dataset.addressing);
      return;
    }

    const apipaBtn = e.target.closest('[data-apipa]');
    if (apipaBtn) {
      const dev = M.getDevice(apipaBtn.dataset.apipa);
      const port = dev && dev.ports.find(p => p.id === apipaBtn.dataset.port);
      if (dev && port) {
        port.dhcp = true; // keep automatic context
        port.lease = null;
        M.apipaAssign(port);
        afterConfigChange();
        toast(dev.name + ' self-assigned ' + port.ip + '/16 (APIPA). Same-link only.', 'ok');
      }
      return;
    }
    const apipaClear = e.target.closest('[data-apipa-clear]');
    if (apipaClear) {
      const dev = M.getDevice(apipaClear.dataset.apipaClear);
      const port = dev && dev.ports.find(p => p.id === apipaClear.dataset.port);
      if (dev && port) { port.ip = ''; port.apipa = false; port.dhcp = true; port.lease = null; afterConfigChange(); }
      return;
    }

    const dhcpBtn = e.target.closest('[data-dhcp-action]');
    if (dhcpBtn) {
      const dev = ui.selectedId ? M.getDevice(ui.selectedId) : null;
      if (!dev) return;
      const port = dev.ports.find(p => p.id === dhcpBtn.dataset.port);
      if (!port) return;
      if (dhcpBtn.dataset.dhcpAction === 'get' || dhcpBtn.dataset.dhcpAction === 'renew') {
        startDhcp(dev.id);
      } else if (dhcpBtn.dataset.dhcpAction === 'release') {
        M.releaseLeaseForPort(dev, port);
        afterConfigChange();
        toast(dev.name + ' released its address. Press Get an address to lease one again.');
      }
      return;
    }

    const suggest = e.target.closest('[data-suggest-pool]');
    if (suggest) {
      const dev = ui.selectedId ? M.getDevice(ui.selectedId) : null;
      if (!dev) return;
      if (!M.suggestPool(dev)) {
        toast('Give ' + dev.name + ' an IP address first, then I can suggest a pool.', 'err');
        return;
      }
      afterConfigChange();
      toast('Suggested pool: ' + dev.dhcp.poolStart + '–' + dev.dhcp.poolEnd + '.', 'ok');
      return;
    }

    const forget = e.target.closest('[data-forget-lease]');
    if (forget) {
      const dev = ui.selectedId ? M.getDevice(ui.selectedId) : null;
      if (!dev) return;
      M.forgetLease(dev, forget.dataset.forgetLease);
      afterConfigChange();
      toast('Lease forgotten. That address is free to hand out again.');
      return;
    }

    const routingRun = e.target.closest('[data-routing-run]');
    if (routingRun) {
      const dev = M.getDevice(routingRun.dataset.routingRun);
      if (!dev) return;
      const proto = (dev.routing && dev.routing.protocol) || 'ospf';
      if (proto === 'none') { toast('Choose a routing protocol first.', 'err'); return; }
      setDockCollapsed(false);
      NL.sim.routing(proto);
      return;
    }
    const routingClear = e.target.closest('[data-routing-clear]');
    if (routingClear) {
      M.state.devices.forEach(d => d.dynamicRoutes = []);
      renderInspector(); renderGuide(); save();
      toast('Dynamic routes cleared from all routers.');
      return;
    }

    const demoBtn = e.target.closest('[data-protocol-demo]');
    if (demoBtn) {
      const dev = ui.selectedId ? M.getDevice(ui.selectedId) : null;
      if (!dev) return;
      let peer = M.state.devices.find(d => d.id !== dev.id && ip.valid(M.primaryIp(d)));
      if (!peer) peer = M.state.devices.find(d => d.id !== dev.id && (d.type === 'server' || d.type === 'pc' || d.type === 'ap' || d.type === 'wifi'));
      if (!peer) peer = M.state.devices.find(d => d.id !== dev.id);
      if (!peer) { toast('Add another device to demonstrate this protocol.', 'err'); return; }
      setDockCollapsed(false);
      NL.sim.demo(demoBtn.dataset.protocolDemo, dev.id, peer.id);
      return;
    }

    const udpBtn = e.target.closest('[data-udp-send]');
    if (udpBtn) {
      const dev = ui.selectedId ? M.getDevice(ui.selectedId) : null;
      if (!dev) return;
      let dst = M.state.devices.find(d => d.id !== dev.id && (d.type === 'server' || d.type === 'pc'));
      if (!dst) { toast('Add a destination host to send UDP to.', 'err'); return; }
      setDockCollapsed(false);
      NL.sim.udp(dev.id, dst.id, { dstPort: 53, app: 'DNS query' });
      return;
    }

    const remove = e.target.closest('[data-remove-route]');
    if (remove) {
      const dev = ui.selectedId ? M.getDevice(ui.selectedId) : null;
      if (!dev) return;
      const index = Number(remove.dataset.removeRoute);
      M.removeStaticRoute(dev, index);
      renderGuide();
      renderInspector();
      save();
      toast('Static route removed.');
      return;
    }

    const removeDns = e.target.closest('[data-remove-dns]');
    if (removeDns) {
      const dev = ui.selectedId ? M.getDevice(ui.selectedId) : null;
      if (dev && dev.dns && Array.isArray(dev.dns.records)) {
        dev.dns.records.splice(Number(removeDns.dataset.removeDns), 1);
        renderInspector(); save(); toast('DNS record removed.');
      }
      return;
    }
    const removeAcl = e.target.closest('[data-remove-acl]');
    if (removeAcl) {
      const dev = ui.selectedId ? M.getDevice(ui.selectedId) : null;
      if (dev && dev.acl && Array.isArray(dev.acl.rules)) {
        dev.acl.rules.splice(Number(removeAcl.dataset.removeAcl), 1);
        renderInspector(); save(); toast('ACL rule removed.');
      }
      return;
    }
    const traceBtn = e.target.closest('[data-trace-run]');
    if (traceBtn) {
      const dev = M.getDevice(traceBtn.dataset.traceRun) || (ui.selectedId ? M.getDevice(ui.selectedId) : null);
      if (!dev) return;
      let dst = M.state.devices.find(d => d.id !== dev.id && ip.valid(M.primaryIp(d)));
      if (!dst) { toast('Add another configured device to traceroute to.', 'err'); return; }
      setDockCollapsed(false);
      NL.sim.trace(dev.id, dst.id);
      return;
    }
    const dnsBtn = e.target.closest('[data-dns-resolve]');
    if (dnsBtn) {
      const dev = M.getDevice(dnsBtn.dataset.dnsResolve) || (ui.selectedId ? M.getDevice(ui.selectedId) : null);
      if (!dev) return;
      const input = document.getElementById('dnsQueryName');
      const name = input ? input.value.trim() : 'web.local';
      setDockCollapsed(false);
      NL.sim.dns(dev.id, name || 'web.local');
      return;
    }

    const action = e.target.closest('[data-device-action]');
    if (!action) return;
    const dev = ui.selectedId ? M.getDevice(ui.selectedId) : null;
    if (!dev) return;
    if (action.dataset.deviceAction === 'ping') startPingFromDevice(dev);
    if (action.dataset.deviceAction === 'delete') deleteDevice(dev);
  }

  function handleRouteSubmit(e) {
    const form = e.target.closest('form[data-route-form]');
    if (form) {
      e.preventDefault();
      const dev = ui.selectedId ? M.getDevice(ui.selectedId) : null;
      if (!dev) return;
      const network = form.querySelector('[name="network"]').value.trim();
      const gateway = form.querySelector('[name="gateway"]').value.trim();
      const prefix = Number(form.querySelector('[name="prefix"]').value);
      if (!ip.valid(network) || !ip.valid(gateway) || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
        toast('Route needs a valid network, a prefix 0–32, and a valid next-hop IP.', 'err');
        return;
      }
      if (!M.addStaticRoute(dev, network, prefix, gateway)) {
        toast('That route is invalid or already exists.', 'err');
        return;
      }
      renderGuide(); renderInspector(); save();
      toast('Static route added: ' + ip.network(network, prefix) + '/' + prefix + ' via ' + gateway + '.', 'ok');
      return;
    }
    const dnsForm = e.target.closest('form[data-dns-form]');
    if (dnsForm) {
      e.preventDefault();
      const dev = ui.selectedId ? M.getDevice(ui.selectedId) : null;
      if (!dev) return;
      if (!dev.dns) dev.dns = { enabled: false, records: [] };
      const name = dnsForm.querySelector('[name="name"]').value.trim();
      const ipaddr = dnsForm.querySelector('[name="ip"]').value.trim();
      if (!name || !ip.valid(ipaddr)) { toast('DNS A record needs a name and a valid IP.', 'err'); return; }
      dev.dns.records.push({ name, ip: ipaddr });
      dev.dns.enabled = true;
      if (dev.services) dev.services.dns = true;
      renderInspector(); save();
      toast('DNS record added: ' + name + ' → ' + ipaddr + '.', 'ok');
      return;
    }
    const aclForm = e.target.closest('form[data-acl-form]');
    if (aclForm) {
      e.preventDefault();
      const dev = ui.selectedId ? M.getDevice(ui.selectedId) : null;
      if (!dev) return;
      if (!dev.acl) dev.acl = { enabled: false, rules: [] };
      const action = aclForm.querySelector('[name="action"]').value;
      const proto = (aclForm.querySelector('[name="proto"]').value.trim() || 'any').toLowerCase();
      const src = aclForm.querySelector('[name="src"]').value.trim() || 'any';
      const dst = aclForm.querySelector('[name="dst"]').value.trim() || 'any';
      dev.acl.rules.push({ action, proto, src, dst });
      dev.acl.enabled = true;
      if (action === 'deny') NL.flags.aclDenyAdded = true;
      if (action === 'permit') NL.flags.aclPermitAdded = true;
      renderInspector(); save();
      toast('ACL rule added (' + action + ' ' + proto + ').', 'ok');
      return;
    }
  }

  // =================== workspace events ===================
  function onWorkspaceClick(e) {
    if (e.target.closest('.device')) return;
    const hit = e.target.closest('[data-link-id]');
    if (hit) {
      const id = hit.dataset.linkId;
      if (ui.tool === 'delete') removeLinkById(id);
      else toast('That is a cable. Switch to the Delete tool (X) to remove it.');
      return;
    }
    if (ui.cableSource || ui.pingSource) {
      ui.cableSource = null;
      ui.pingSource = null;
      renderScene();
      updateHint();
    }
    if (ui.selectedId) {
      ui.selectedId = null;
      renderScene();
      renderInspector();
    }
  }

  // =================== panel ===================
  function openPanel() { setPanelVisible(true); }

  function openTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    els.paneLab.classList.toggle('active', name === 'lab');
    els.paneDevice.classList.toggle('active', name === 'device');
    if (name === 'device') renderInspector();
    else renderGuide();
  }

  // =================== boot ===================
  function populateLabs() {
    els.lessonSelect.innerHTML = NL.missions.labs.map(l =>
      '<option value="' + esc(l.id) + '">' + esc(l.name) + '</option>').join('');
  }

  function bootLab(id, opts) {
    const lab = NL.missions.get(id) || NL.missions.labs[0];
    NL.sim.cancel();
    M.clearLab();
    M.state.lessonId = lab.id;
    NL.resetFlags();
    ui.currentLab = lab;
    ui.selectedId = null;
    ui.cableSource = null;
    ui.pingSource = null;
    els.lessonSelect.value = lab.id;
    clearLog();
    clearFrame();
    renderStatus('idle', '');
    setTool('select');
    lab.build(pos);
    arrangeDevices();
    repairOverlaps();
    refresh();
    captureSize();
    if (consoleState.started) consoleBanner('Lab “' + lab.title + '” loaded.');
    if (!opts || !opts.silent) toast('Loaded “' + lab.title + '”.', 'ok');
  }

  // =================== modals ===================
  function openModal(title, sub, body, opts) {
    const wide = opts && opts.wide ? ' wide' : '';
    els.modalRoot.innerHTML =
      '<div class="modal' + wide + '" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
        '<div class="modal-head">' +
          '<div><div class="modal-title">' + esc(title) + '</div>' +
          '<div class="modal-sub">' + esc(sub) + '</div></div>' +
          '<button class="modal-close" aria-label="Close"><svg class="icon"><use href="#i-close"/></svg></button>' +
        '</div>' +
        '<div class="modal-body">' + body + '</div>' +
      '</div>';
    els.modalRoot.hidden = false;
  }

  function closeModal() {
    els.modalRoot.hidden = true;
    els.modalRoot.innerHTML = '';
  }

  // =================== IOS-style console ===================
  NL.ui = {
    openModal,
    toast,
    setDockView,
    selectDevice,
    refresh
  };

  function collectLogLines() {
    return Array.from(els.log.querySelectorAll('.entry')).map(entry => {
      const time = entry.querySelector('.t');
      const tag = entry.querySelector('.tag');
      const body = entry.querySelector('.body');
      return '[' + (time ? time.textContent : '--:--:--') + '] ' +
        (tag ? tag.textContent : 'LOG') + ' ' + (body ? body.textContent : '');
    });
  }

  function preferredConsoleDevice() {
    if (ui.selectedId && M.getDevice(ui.selectedId)) return ui.selectedId;
    const order = ['router', 'switch', 'server', 'pc', 'ap', 'wifi', 'hub'];
    for (const type of order) {
      const found = M.state.devices.find(d => d.type === type);
      if (found) return found.id;
    }
    return M.state.devices.length ? M.state.devices[0].id : null;
  }

  function updateConsolePrompt() {
    if (!els.consolePrompt) return;
    els.consolePrompt.textContent = consoleState.cli ? consoleState.cli.prompt() : '>';
  }

  function syncConsoleDevices() {
    if (!els.consoleDevice) return;
    const devices = M.state.devices.slice();
    const validId = consoleState.deviceId && M.getDevice(consoleState.deviceId) ? consoleState.deviceId : null;
    const chosen = validId || preferredConsoleDevice();
    if (!devices.length) {
      els.consoleDevice.innerHTML = '<option value="">No devices yet</option>';
    } else {
      els.consoleDevice.innerHTML = devices.map(d =>
        '<option value="' + esc(d.id) + '">' + esc(d.name + ' · ' + M.TYPES[d.type].label) + '</option>'
      ).join('');
    }
    els.consoleDevice.value = chosen || '';
    if (consoleState.deviceId !== chosen) {
      consoleState.deviceId = chosen || null;
      if (consoleState.cli) consoleState.cli.setDevice(consoleState.deviceId);
    }
    if (consoleState.cli && consoleState.cli.getDeviceId() !== consoleState.deviceId) {
      consoleState.cli.setDevice(consoleState.deviceId);
    }
    updateConsolePrompt();
  }

  function appendConsoleLines(lines) {
    if (!els.consoleOut || !Array.isArray(lines)) return;
    const frag = document.createDocumentFragment();
    lines.forEach(line => {
      const el = document.createElement('div');
      el.className = 'console-line' + (line && line.kind ? ' ' + line.kind : '');
      el.textContent = line && line.text != null ? String(line.text) : '';
      frag.appendChild(el);
    });
    els.consoleOut.appendChild(frag);
    while (els.consoleOut.children.length > 600) els.consoleOut.removeChild(els.consoleOut.firstChild);
    els.consoleOut.scrollTop = els.consoleOut.scrollHeight;
  }

  function consoleBanner(prefix) {
    if (!els.consoleOut) return;
    els.consoleOut.innerHTML = '';
    const dev = consoleState.deviceId ? M.getDevice(consoleState.deviceId) : null;
    appendConsoleLines([
      { text: 'NetLab teaching CLI · IOS-style commands · not a real router OS', kind: 'info' },
      { text: 'Connected to: ' + (dev ? dev.name + ' (' + M.TYPES[dev.type].label + ')' : 'no device — add one in the lab'), kind: 'dim' },
      { text: 'Type ? for help, or click Commands for the Network+ reference.', kind: 'dim' },
      { text: '' , kind: '' }
    ].concat(prefix ? [{ text: prefix, kind: 'dim' }] : []));
  }

  function initConsole() {
    if (!NL.cli || consoleState.started) return;
    consoleState.started = true;
    consoleState.deviceId = preferredConsoleDevice();
    consoleState.cli = NL.cli.create({
      deviceId: consoleState.deviceId,
      getLogs: collectLogLines
    });
    syncConsoleDevices();
    consoleBanner();
  }

  function runConsoleCommand() {
    if (!consoleState.cli) initConsole();
    if (!consoleState.cli || !els.consoleInput) return;
    const raw = els.consoleInput.value;
    els.consoleInput.value = '';
    if (!String(raw).trim()) return;
    const result = consoleState.cli.execute(raw);
    if (result.clear) {
      els.consoleOut.innerHTML = '';
    }
    appendConsoleLines(result.lines);
    updateConsolePrompt();
    if (result.changed) {
      afterConfigChange();
      syncConsoleDevices();
    }
    if (result.animate) {
      setDockCollapsed(false);
      setDockView('log');
    }
  }

  function completionCandidates(value) {
    if (!NL.cli) return [];
    const live = NL.cli.catalog.filter(c => c.live).map(c => c.syntax);
    const lowerValue = String(value || '').toLowerCase();
    if (!lowerValue) return [];
    const whole = live.filter(s => s.toLowerCase().startsWith(lowerValue));
    if (whole.length) return whole;
    const parts = String(value).split(/\s+/);
    if (parts.length < 2) return [];
    const prefix = parts.slice(0, -1).join(' ') + ' ';
    const fragment = parts[parts.length - 1].toLowerCase();
    const next = {};
    live.forEach(syntax => {
      if (!syntax.toLowerCase().startsWith(prefix.toLowerCase())) return;
      const word = syntax.slice(prefix.length).split(' ')[0];
      if (word && word.toLowerCase().startsWith(fragment)) next[prefix + word] = true;
    });
    return Object.keys(next);
  }

  function completeConsoleInput() {
    const input = els.consoleInput;
    if (!input) return;
    const candidates = completionCandidates(input.value);
    if (!candidates.length) return;
    if (candidates.length === 1) {
      input.value = candidates[0] + (candidates[0].endsWith(' ') ? '' : ' ');
      return;
    }
    let common = candidates[0].toLowerCase();
    candidates.forEach(candidate => {
      const lower = candidate.toLowerCase();
      let i = 0;
      while (i < common.length && i < lower.length && common[i] === lower[i]) i++;
      common = common.slice(0, i);
    });
    if (common.length > input.value.length) input.value = candidates[0].slice(0, common.length);
    appendConsoleLines([{ text: '  ' + candidates.slice(0, 18).join('   '), kind: 'dim' }]);
  }

  function renderCommandReference(query) {
    const results = NL.cli.reference(query);
    const count = $('cmdRefCount');
    if (count) {
      const live = results.filter(c => c.live).length;
      count.textContent = results.length + ' commands · ' + live + ' can run in NetLab';
    }
    const box = $('cmdRefResults');
    if (!box) return;
    if (!results.length) {
      box.innerHTML = '<div class="cmd-ref-empty">No commands match “' + esc(query) + '”. Try “show”, “route”, “ip”, “debug” or “wireless”.</div>';
      return;
    }
    let html = '';
    let lastGroup = '';
    results.forEach(c => {
      if (c.group !== lastGroup) {
        lastGroup = c.group;
        html += '<h4 class="cmd-ref-group">' + esc(c.group) + '</h4>';
      }
      html +=
        '<div class="cmd-ref-row">' +
          '<div class="cmd-ref-head"><code>' + esc(c.syntax) + '</code>' +
            '<span class="chip' + (c.live ? ' green' : '') + '">' + (c.live ? 'Live in NetLab' : 'Reference only') + '</span>' +
          '</div>' +
          '<div class="cmd-ref-desc">' + esc(c.desc) + '</div>' +
          '<div class="cmd-ref-meta">Example: <code>' + esc(c.example) + '</code></div>' +
          '<div class="cmd-ref-tip">' + esc(c.tip) + '</div>' +
          (c.live ? '<button class="btn small" data-cmd-try="' + esc(c.example) + '">Use this command</button>' : '') +
        '</div>';
    });
    box.innerHTML = html;
  }

  function openCommandReference(query) {
    if (!NL.cli) { toast('Command reference is not available.', 'err'); return; }
    const q = String(query || '');
    const body =
      '<p>Network+ commands you may meet on an exam or a real Cisco device. <span class="chip green">Live in NetLab</span> commands work in the console; the rest are clearly marked teaching reference.</p>' +
      '<div class="field"><label>Search commands, descriptions, examples or tips</label>' +
        '<input id="cmdRefSearch" value="' + esc(q) + '" placeholder="try: ospf, arp, vlan, debug, ssh" autocomplete="off" spellcheck="false"></div>' +
      '<div class="muted-small" id="cmdRefCount" style="margin:8px 0 12px"></div>' +
      '<div id="cmdRefResults"></div>' +
      '<p class="teach-note">IOS accepts abbreviations as long as they are unambiguous: <b>sh ip int br</b> means <b>show ip interface brief</b>. Type <b>?</b> in the console for help in the current mode.</p>';
    openModal('Network+ command reference', 'Searchable · live commands and exam-only commands', body);
    const search = $('cmdRefSearch');
    renderCommandReference(q);
    if (search) {
      search.focus();
      search.select();
      search.addEventListener('input', e => renderCommandReference(e.target.value));
    }
  }

  // =================== address teaching tools ===================
  function bits(value, width) { return (value >>> 0).toString(2).padStart(width, '0'); }

  function parseMac(value) {
    let s = String(value == null ? '' : value).trim().replace(/[\s.\-]/g, ':');
    if (/^[0-9a-f]{12}$/i.test(s)) s = s.match(/.{2}/g).join(':');
    const parts = s.split(':');
    if (parts.length !== 6 || !parts.every(p => /^[0-9a-f]{2}$/i.test(p))) return null;
    return parts.map(p => parseInt(p, 16));
  }

  function parseIPv6(value) {
    const halves = String(value == null ? '' : value).trim().toLowerCase().split('::');
    if (halves.length > 2) return null;
    const head = halves[0] ? halves[0].split(':') : [];
    const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
    const all = head.concat(tail);
    if (!all.every(h => /^[0-9a-f]{1,4}$/.test(h))) return null;
    const missing = 8 - all.length;
    if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
    return head.concat(Array(missing).fill('0'), tail).map(h => parseInt(h, 16));
  }

  function compressIPv6(groups) {
    let bestStart = -1, bestLen = 0, start = -1, len = 0;
    for (let i = 0; i < 8; i++) {
      if (groups[i] === 0) {
        if (start < 0) start = i;
        len++;
        if (len > bestLen) { bestLen = len; bestStart = start; }
      } else { start = -1; len = 0; }
    }
    if (bestLen < 2) return groups.map(g => g.toString(16)).join(':');
    return groups.slice(0, bestStart).map(g => g.toString(16)).join(':') + '::' +
      groups.slice(bestStart + bestLen).map(g => g.toString(16)).join(':');
  }

  function ipv6Type(g) {
    const a = g[0];
    if (a === 0 && g.slice(0, 7).every(v => v === 0) && g[7] === 1) return ['Loopback', '::1 is this machine — the IPv6 version of 127.0.0.1.', ''];
    if (g.every(v => v === 0)) return ['Unspecified', 'All zeroes means “no address yet” — a placeholder, not a usable destination.', ''];
    if (a === 0x2001 && g[1] === 0x0db8) return ['Documentation', '2001:db8::/32 is reserved for examples, like 192.0.2.0/24 in IPv4.', 'amber'];
    if ((a & 0xff00) === 0xff00) return ['Multicast', 'FF00::/8 reaches a group of interfaces. Neighbor Discovery depends on it.', 'purple'];
    if ((a & 0xffc0) === 0xfe80) return ['Link-local', 'FE80::/10 works only on this link. Routers never forward it.', 'green'];
    if ((a & 0xfe00) === 0xfc00) return ['Unique local', 'FC00::/7 is private to your site — the IPv6 version of RFC 1918 space.', 'amber'];
    if ((a & 0xe000) === 0x2000) return ['Global unicast', '2000::/3 is publicly routable, like a public IPv4 address.', 'cyan'];
    if (a === 0 && g.slice(1, 5).every(v => v === 0) && g[5] === 0xffff) return ['IPv4-mapped', '::ffff:0:0/96 represents an IPv4 address in a dual-stack IPv6 socket.', 'green'];
    return ['Other / reserved', 'This prefix is not one of the common types above.', ''];
  }

  function openMacTool() {
    const sample = '02:1A:2B:3C:4D:5E';
    let initial = sample;
    let options = '<option value="sample">Practice MAC (locally administered)</option>';
    M.state.devices.forEach(d => d.ports.forEach((p, i) => {
      const selected = initial === sample ? ' selected' : '';
      options += '<option value="' + esc(d.id) + '|' + i + '"' + selected + '>' + esc(d.name + ' · ' + p.name) + '</option>';
      if (initial === sample) initial = p.mac;
    }));
    const body =
      '<p>Every network interface has a 48-bit hardware address. Type one below — or pick a device from your lab — and watch it come apart byte by byte.</p>' +
      '<div class="modal-grid">' +
        '<div class="field"><label>MAC address</label><input id="macAddr" value="' + esc(initial) + '" autocomplete="off" spellcheck="false"></div>' +
        '<div class="field"><label>Example from</label><select id="macSource">' + options + '</select></div>' +
      '</div>' +
      '<div class="preset-row">' +
        '<button class="btn small" data-mac="FF:FF:FF:FF:FF:FF">Broadcast</button>' +
        '<button class="btn small" data-mac="01:00:5E:00:00:FB">IPv4 multicast</button>' +
        '<button class="btn small" data-mac="33:33:00:00:00:01">IPv6 multicast</button>' +
        '<button class="btn small" data-mac="' + sample + '">Locally administered</button>' +
      '</div>' +
      '<div id="macVisual"></div>' +
      '<div class="result-box" id="macResult"></div>' +
      '<div class="teach-details">' +
        '<details open><summary>How the 48 bits are divided</summary><div class="detail-body">' +
          '<p>A MAC (Media Access Control) address is 48 bits: 6 bytes, written as 12 hexadecimal digits. The first 3 bytes are the <b>OUI</b> (Organizationally Unique Identifier) assigned by the IEEE to a manufacturer; the last 3 bytes are assigned by that manufacturer to the individual interface. Together they must be unique on a LAN.</p>' +
          '<p>Packets on Ethernet carry these addresses in the frame header: <b>source MAC</b> (who sent it) and <b>destination MAC</b> (who should read it). This is a Layer 2 address — it only matters on the local network.</p>' +
        '</div></details>' +
        '<details><summary>Reading the first byte: I/G and U/L</summary><div class="detail-body">' +
          '<table class="teach-table"><tr><th>Bit</th><th>Value</th><th>Meaning</th></tr>' +
          '<tr><td>I/G (last bit)</td><td>0 / 1</td><td>Individual (unicast) / Group (multicast). Broadcast FF:FF:FF:FF:FF:FF is a special multicast.</td></tr>' +
          '<tr><td>U/L (second-to-last)</td><td>0 / 1</td><td>Universally administered (OUI from IEEE) / Locally administered (chosen by software).</td></tr>' +
          '</table>' +
          '<p>This is why a locally administered address often starts with 02, 06, 0A or 0E: bit 1 is set. NetLab generates random MACs this way so they never claim a real vendor prefix.</p>' +
        '</div></details>' +
        '<details><summary>Why switches care about MACs</summary><div class="detail-body">' +
          '<p>A switch reads the <b>source MAC</b> of an incoming frame and remembers “that address is on this port”. When it later sees a known <b>destination MAC</b>, it forwards only out that port. If the destination is unknown, it floods the frame out every other port — like a hub — until it learns where that address lives.</p>' +
          '<p>Open a switch in this lab and look at its <b>MAC table</b>. Run a ping and watch addresses appear. Hubs never learn, so they always repeat frames to everyone.</p>' +
        '</div></details>' +
        '<details><summary>MAC vs IP, and special addresses</summary><div class="detail-body">' +
          '<table class="teach-table"><tr><th></th><th>MAC address</th><th>IP address</th></tr>' +
          '<tr><td>Layer</td><td>2 — Ethernet frame</td><td>3 — IP packet</td></tr>' +
          '<tr><td>Length</td><td>48 bits (EUI-48)</td><td>32 bits (IPv4) or 128 bits (IPv6)</td></tr>' +
          '<tr><td>Changes?</td><td>New frame at every router hop</td><td>Stays end-to-end (unless NAT rewrites it)</td></tr>' +
          '<tr><td>Finds</td><td>Next network interface on this link</td><td>Final destination across networks</td></tr>' +
          '</table>' +
          '<p><b>ARP</b> asks “which MAC owns this IP?” so a host can build the frame. <b>Broadcast</b> FF:FF:FF:FF:FF:FF reaches every NIC on the LAN. <b>Multicast</b> starts with an odd first byte (01, 33, etc.) and reaches a selected group. There are also 64-bit <b>EUI-64</b> addresses used in some IPv6 interface IDs.</p>' +
        '</div></details>' +
      '</div>';
    openModal('MAC address explorer', 'Dissect a hardware address, bit by bit', body, { wide: true });

    const addrEl = $('macAddr');
    const sourceEl = $('macSource');
    function byteGroups(bytes) {
      return [
        { cls: 'oui', title: 'Bytes 1–3 · OUI / vendor prefix', from: 0 },
        { cls: 'nic', title: 'Bytes 4–6 · NIC / device-specific', from: 3 }
      ].map(g =>
        '<div class="byte-group ' + g.cls + '">' +
          '<div class="byte-group-title">' + g.title + '</div>' +
          '<div class="byte-strip">' +
            bytes.slice(g.from, g.from + 3).map((b, i) => {
              const idx = g.from + i + 1;
              return '<div class="byte-box' + (idx === 1 ? ' flag' : '') + '">' +
                '<small>Byte ' + idx + '</small>' +
                '<b>' + b.toString(16).toUpperCase().padStart(2, '0') + '</b>' +
                '<i>' + bits(b, 8) + '</i>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>'
      ).join('');
    }
    function calc() {
      const bytes = parseMac(addrEl.value);
      const visual = $('macVisual');
      const box = $('macResult');
      if (!bytes) {
        visual.innerHTML = '';
        box.innerHTML = '<div class="error-text">Enter 6 hexadecimal bytes, e.g. 02:1A:2B:3C:4D:5E.</div>';
        return;
      }
      const canonical = bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(':');
      const ig = bytes[0] & 1;
      const ul = (bytes[0] >> 1) & 1;
      const fb = bits(bytes[0], 8);
      const scope = ig ? 'group address (multicast / broadcast)' : (ul ? 'locally administered' : 'globally unique (OUI from IEEE)');
      const scopeNote = ig
        ? 'For a group address this bit is set, but the address is shared by many interfaces — it is not a vendor lookup.'
        : (ul ? 'Chosen by software — no vendor lookup. NetLab uses this for random MACs.' : 'The OUI should belong to an IEEE-registered organization.');
      visual.innerHTML =
        '<div class="byte-groups">' + byteGroups(bytes) + '</div>' +
        '<div class="flag-row">' +
          '<div class="flag-card"><b>First byte: <span class="bit-mark">' + fb + '</span></b>' +
            '<span>The second-to-last bit is U/L; the very last bit is I/G.</span></div>' +
          '<div class="flag-card"><b>I/G = ' + ig + ' · ' + (ig ? 'multicast' : 'unicast') + '</b>' +
            '<span>' + (ig ? 'A group address: one frame can reach many interfaces.' : 'An individual address: one NIC is the intended destination.') + '</span></div>' +
          '<div class="flag-card"><b>U/L = ' + ul + ' · ' + (ul ? 'locally administered' : 'globally unique') + '</b>' +
            '<span>' + scopeNote + '</span></div>' +
        '</div>';
      box.innerHTML =
        '<div class="result-row"><span>Canonical form</span><b class="big-answer">' + canonical + '</b></div>' +
        '<div class="result-row"><span>Length</span><b>48 bits · 6 bytes · 12 hex digits</b></div>' +
        '<div class="result-row"><span>Destination type</span><b>' + (ig ? 'multicast' : 'unicast') + '</b></div>' +
        '<div class="result-row"><span>Scope</span><b>' + scope + '</b></div>' +
        (canonical === 'FF:FF:FF:FF:FF:FF' ? '<div class="result-row"><span>Special</span><b class="warn-text">Ethernet broadcast — every NIC on the LAN listens</b></div>' : '');
    }
    addrEl.addEventListener('input', calc);
    sourceEl.addEventListener('change', () => {
      if (sourceEl.value === 'sample') { addrEl.value = sample; calc(); return; }
      const parts = sourceEl.value.split('|');
      const dev = M.getDevice(parts[0]);
      const port = dev && dev.ports[Number(parts[1])];
      if (port) { addrEl.value = port.mac; calc(); }
    });
    document.querySelectorAll('[data-mac]').forEach(btn => {
      btn.addEventListener('click', () => {
        addrEl.value = btn.dataset.mac;
        sourceEl.value = 'sample';
        calc();
      });
    });
    calc();
    addrEl.focus();
    addrEl.select();
  }

  function openIPv6Tool() {
    const demo = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
    const body =
      '<p>IPv6 addresses are 128 bits written as eight hexadecimal groups. Paste one below (or try a preset) to see it parsed live.</p>' +
      '<div class="modal-grid">' +
        '<div class="field"><label>IPv6 address</label><input id="ipv6Addr" value="' + demo + '" autocomplete="off" spellcheck="false"></div>' +
        '<div class="field"><label>Prefix length (0–128)</label><input id="ipv6Prefix" type="number" min="0" max="128" value="64"></div>' +
      '</div>' +
      '<div class="preset-row">' +
        '<button class="btn small" data-ipv6="2606:4700:4700::1111">Global</button>' +
        '<button class="btn small" data-ipv6="fe80::1">Link-local</button>' +
        '<button class="btn small" data-ipv6="fd00::1">Unique local</button>' +
        '<button class="btn small" data-ipv6="ff02::1">Multicast</button>' +
        '<button class="btn small" data-ipv6="::1">Loopback</button>' +
        '<button class="btn small" data-ipv6="' + demo + '">Full form</button>' +
      '</div>' +
      '<div id="ipv6Visual"></div>' +
      '<div class="result-box ipv6-forms" id="ipv6Result"></div>' +
      '<div class="type-chips" id="ipv6Type"></div>' +
      '<div class="teach-details">' +
        '<details open><summary>Reading and compressing an address</summary><div class="detail-body">' +
          '<p>Each group (a <b>hextet</b>) is 16 bits = 4 hex digits. You may drop leading zeroes, and you may replace one run of all-zero groups with <b>::</b>. The <b>::</b> shortcut can appear only once — using it twice would be ambiguous.</p>' +
          '<p><b>2001:0db8:0000:0000:0000:0000:0000:0001</b> shrinks to <b>2001:db8::1</b>. Change the address above and watch both forms update.</p>' +
        '</div></details>' +
        '<details><summary>Why 128 bits?</summary><div class="detail-body">' +
          '<p>IPv4 has 2³² addresses — about 4.3 billion. IPv6 has 2¹²⁸, roughly 5×10³⁷. That is enough for every phone, sensor and light bulb, so devices can have globally unique addresses again and NAT is no longer needed just to conserve addresses.</p>' +
        '</div></details>' +
        '<details><summary>Address types at a glance</summary><div class="detail-body">' +
          '<table class="teach-table"><tr><th>Prefix</th><th>Type</th><th>Think of it as</th></tr>' +
          '<tr><td>2000::/3</td><td>Global unicast</td><td>A public IPv4 address</td></tr>' +
          '<tr><td>FE80::/10</td><td>Link-local</td><td>An automatic address for one link</td></tr>' +
          '<tr><td>FC00::/7</td><td>Unique local</td><td>Private RFC 1918 space</td></tr>' +
          '<tr><td>FF00::/8</td><td>Multicast</td><td>One-to-many; replaces much of broadcast</td></tr>' +
          '<tr><td>::1</td><td>Loopback</td><td>127.0.0.1</td></tr>' +
          '<tr><td>2001:db8::/32</td><td>Documentation</td><td>Example-only addresses</td></tr>' +
          '</table>' +
        '</div></details>' +
        '<details><summary>SLAAC, Router Advertisements & Neighbor Discovery</summary><div class="detail-body">' +
          '<p>A host sends a <b>Router Solicitation</b>; the router answers with a <b>Router Advertisement</b> carrying the on-link prefix (usually /64) and the default gateway. The host combines that prefix with its own interface ID to form a global address — that is <b>SLAAC</b>.</p>' +
          '<p>Before using the address, the host runs <b>Duplicate Address Detection</b> with Neighbor Solicitation. <b>Neighbor Discovery</b> maps IPv6 addresses to MAC addresses, replacing IPv4 ARP. IPv6 has no broadcast: it uses multicast such as FF02::1 (all nodes) and FF02::2 (all routers).</p>' +
          '<p>Try the <b>SLAAC</b> protocol demo on a host in this lab to watch the exchange.</p>' +
        '</div></details>' +
        '<details><summary>SLAAC vs DHCPv6</summary><div class="detail-body">' +
          '<p><b>SLAAC</b> is stateless: routers advertise the prefix, hosts choose their interface ID, and no server keeps leases. <b>Stateful DHCPv6</b> assigns addresses and tracks them (Solicit → Advertise → Request → Reply). <b>Stateless DHCPv6</b> can still hand out extras such as DNS servers.</p>' +
          '<p>Router Advertisement flags tell hosts what to do: the <b>M</b>anaged flag means get addresses from DHCPv6; the <b>O</b>ther flag means get other settings from DHCPv6.</p>' +
        '</div></details>' +
        '<details><summary>EUI-64 and the U/L bit flip</summary><div class="detail-body">' +
          '<p>Classic SLAAC can build a 64-bit interface ID from a 48-bit MAC: insert <b>FFFE</b> in the middle and flip the <b>U/L</b> bit (bit 1 of the first byte). A globally unique MAC becomes a locally administered interface ID because the scope changed.</p>' +
          '<p>Most modern systems instead use randomized, stable or temporary interface IDs so a device cannot be tracked across networks — the same privacy idea behind random Wi-Fi MACs.</p>' +
        '</div></details>' +
        '<details><summary>Subnets and prefixes</summary><div class="detail-body">' +
          '<p>The prefix is the network part; the rest is the interface ID. <b>/64</b> is the normal LAN size because SLAAC expects 64 bits for the interface ID. Point-to-point links often use <b>/127</b> (two addresses). ISPs usually delegate shorter prefixes such as <b>/48</b> or <b>/56</b> to a whole site.</p>' +
          '<p>IPv6 has no broadcast address, so every address in the subnet is usable.</p>' +
        '</div></details>' +
        '<details><summary>IPv4 vs IPv6, and the packet itself</summary><div class="detail-body">' +
          '<table class="teach-table"><tr><th></th><th>IPv4</th><th>IPv6</th></tr>' +
          '<tr><td>Address</td><td>32 bits, dotted decimal</td><td>128 bits, hexadecimal groups</td></tr>' +
          '<tr><td>Neighbors</td><td>ARP</td><td>ICMPv6 Neighbor Discovery</td></tr>' +
          '<tr><td>Autoconfig</td><td>DHCP (or APIPA)</td><td>SLAAC, DHCPv6</td></tr>' +
          '<tr><td>Broadcast</td><td>Yes</td><td>No — multicast instead</td></tr>' +
          '<tr><td>Header</td><td>20–60 bytes, checksum</td><td>Fixed 40 bytes, no header checksum</td></tr>' +
          '</table>' +
          '<p>Router work is simpler: no header checksum to recompute and no router fragmentation — senders discover the path MTU with ICMPv6. Optional features live in chained <b>extension headers</b>, and a 20-bit <b>flow label</b> can mark traffic flows. During the transition, networks use <b>dual stack</b> (both protocols) or tunnel IPv6 inside IPv4.</p>' +
        '</div></details>' +
      '</div>';
    openModal('IPv6 address explorer', '128 bits, eight groups, one live address', body, { wide: true });

    const addrEl = $('ipv6Addr');
    const prefixEl = $('ipv6Prefix');
    function calc() {
      const groups = parseIPv6(addrEl.value);
      const prefix = Number(prefixEl.value);
      const visual = $('ipv6Visual');
      const box = $('ipv6Result');
      const typeBox = $('ipv6Type');
      if (!groups || !Number.isInteger(prefix) || prefix < 0 || prefix > 128) {
        visual.innerHTML = '';
        typeBox.innerHTML = '';
        box.innerHTML = '<div class="error-text">Enter 8 hex groups (you may use :: once) and a prefix from 0 to 128.</div>';
        return;
      }
      const full = groups.map(g => g.toString(16).padStart(4, '0')).join(':');
      const short = compressIPv6(groups);
      visual.innerHTML =
        '<div class="hextet-strip">' + groups.map((g, i) => {
          const start = i * 16;
          let cls = prefix > start ? 'prefix' : 'interface';
          if (prefix > start && prefix < start + 16) cls += ' split';
          return '<div class="hextet ' + cls + '"><small>' + (i + 1) + '</small><b>' + g.toString(16).padStart(4, '0') + '</b></div>';
        }).join('') + '</div>' +
        '<div class="legend"><span><i class="net"></i>Prefix: first ' + prefix + ' bits</span>' +
        '<span><i class="host"></i>Interface ID: last ' + (128 - prefix) + ' bits</span></div>';
      const t = ipv6Type(groups);
      typeBox.innerHTML = '<span class="chip' + (t[2] ? ' ' + t[2] : '') + '">' + t[0] + '</span>' +
        '<span class="muted-small">' + t[1] + '</span>';
      box.innerHTML =
        '<div class="result-row"><span>Full form</span><b>' + full + '</b></div>' +
        '<div class="result-row"><span>Compressed</span><b class="big-answer">' + short + '</b></div>' +
        '<div class="result-row"><span>Split</span><b>/' + prefix + ' · boundary after group ' + Math.ceil(prefix / 16) + '</b></div>';
    }
    addrEl.addEventListener('input', calc);
    prefixEl.addEventListener('input', calc);
    document.querySelectorAll('[data-ipv6]').forEach(btn => {
      btn.addEventListener('click', () => { addrEl.value = btn.dataset.ipv6; calc(); });
    });
    calc();
    addrEl.focus();
    addrEl.select();
  }

  function openLayoutPanel() {
    const s = ui.settings;
    const body =
      '<p class="customize-hero">Set the pace and shape of the lab. Everything here is saved automatically for next time.</p>' +
      '<h3>Animation speed</h3>' +
      '<div class="speed-row">' +
        '<input type="range" id="layoutSpeed" min="0.25" max="2" step="0.25" value="' + s.speed + '" aria-label="Animation speed">' +
        '<b class="speed-label" id="layoutSpeedLabel">' + fmtSpeed(s.speed) + '</b>' +
      '</div>' +
      '<div class="preset-row">' +
        [0.25, 0.5, 1, 2].map(v => '<button class="btn small" data-speed="' + v + '">' + fmtSpeed(v) + '</button>').join('') +
      '</div>' +
      '<p class="muted-small">Slower gives you more time to read each hop. 0.25× is very slow — good for your first few pings.</p>' +
      '<label class="check-row"><input type="checkbox" id="layoutStep"' + (s.stepMode ? ' checked' : '') + '> Auto-pause after every hop so I can look around</label>' +
      '<h3>Layout presets</h3>' +
      '<div class="preset-row">' +
        '<button class="btn small" data-preset="balanced">Balanced</button>' +
        '<button class="btn small" data-preset="canvas">Wide canvas</button>' +
        '<button class="btn small" data-preset="guide">Guide focus</button>' +
        '<button class="btn small" data-preset="zen">Canvas only</button>' +
      '</div>' +
      '<h3>Panels</h3>' +
      '<label class="check-row"><input type="checkbox" id="layoutShowPalette"' + (s.paletteHidden ? '' : ' checked') + '> Show the add &amp; tools panel</label>' +
      '<label class="check-row"><input type="checkbox" id="layoutShowPanel"' + (s.panelHidden ? '' : ' checked') + '> Show the lab guide panel</label>' +
      '<label class="check-row"><input type="checkbox" id="layoutShowDock"' + (s.dockCollapsed ? '' : ' checked') + '> Show the bottom panel</label>' +
      '<label class="check-row"><input type="radio" name="layoutDockView" id="layoutDockLog"' + (s.dockView === 'console' ? '' : ' checked') + '> Bottom panel: Journey log</label>' +
      '<label class="check-row"><input type="radio" name="layoutDockView" id="layoutDockConsole"' + (s.dockView === 'console' ? ' checked' : '') + '> Bottom panel: IOS-style console</label>' +
      '<h3>Panel sizes</h3>' +
      '<label class="slider-row"><span>Add &amp; tools width</span><input type="range" id="layoutPaletteW" min="72" max="220" step="2" value="' + s.paletteW + '"></label>' +
      '<label class="slider-row"><span>Guide width</span><input type="range" id="layoutPanelW" min="260" max="620" step="2" value="' + s.panelW + '"></label>' +
      '<label class="slider-row"><span>Journey log height</span><input type="range" id="layoutDockH" min="110" max="460" step="2" value="' + s.dockH + '"></label>' +
      '<div class="modal-foot"><button class="btn small ghost" id="layoutReset">Reset sizes &amp; panels</button>' +
      '<span class="muted-small">Tip: you can also drag the thin dividers between panels.</span></div>';
    openModal('Customize NetLab', 'Slower animations, bigger panels, or just the canvas', body);

    const speed = $('layoutSpeed');
    if (speed) speed.addEventListener('input', e => setSpeed(e.target.value));
    document.querySelectorAll('[data-speed]').forEach(btn => {
      btn.addEventListener('click', () => { setSpeed(btn.dataset.speed); syncSettingsUI(); });
    });
    const step = $('layoutStep');
    if (step) step.addEventListener('change', e => setStepMode(e.target.checked));

    const showPalette = $('layoutShowPalette');
    if (showPalette) showPalette.addEventListener('change', e => setPaletteVisible(e.target.checked));
    const showPanel = $('layoutShowPanel');
    if (showPanel) showPanel.addEventListener('change', e => setPanelVisible(e.target.checked));
    const showDock = $('layoutShowDock');
    if (showDock) showDock.addEventListener('change', e => setDockCollapsed(!e.target.checked));
    document.querySelectorAll('[name="layoutDockView"]').forEach(radio => {
      radio.addEventListener('change', e => { if (e.target.checked) setDockView(e.target.value); });
    });

    const paletteW = $('layoutPaletteW');
    if (paletteW) paletteW.addEventListener('input', e => updateLayoutValue('paletteW', e.target.value));
    const panelW = $('layoutPanelW');
    if (panelW) panelW.addEventListener('input', e => updateLayoutValue('panelW', e.target.value));
    const dockH = $('layoutDockH');
    if (dockH) dockH.addEventListener('input', e => updateLayoutValue('dockH', e.target.value));

    document.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
    });
    const reset = $('layoutReset');
    if (reset) reset.addEventListener('click', () => {
      ui.settings.paletteW = LAYOUT_DEFAULTS.paletteW;
      ui.settings.panelW = LAYOUT_DEFAULTS.panelW;
      ui.settings.dockH = LAYOUT_DEFAULTS.dockH;
      ui.settings.paletteHidden = false;
      ui.settings.panelHidden = false;
      ui.settings.dockCollapsed = false;
      ui.settings.dockView = LAYOUT_DEFAULTS.dockView;
      applyLayout({ reflow: true });
      saveSettings();
      syncSettingsUI();
      toast('Sizes and panels reset.', 'ok');
    });
  }

  function openHelp() {
    const terms = [
      ['Ethernet frame', 'The envelope that carries data on a LAN. It has a source MAC, destination MAC, and a payload (often an IP packet).'],
      ['MAC address', 'A 48-bit hardware address burned into every network card. Switches use it to decide which port to forward to.'],
      ['Switch', 'Learns which MAC is on which port and forwards frames only where they need to go. Starts by flooding when unsure.'],
      ['Hub', 'A dumb repeater: copies every frame out of every other port. No MAC learning. Useful for seeing why switches won.'],
      ['Router', 'Connects different IP subnets. It strips the incoming Ethernet frame, looks up the destination IP, and builds a new frame for the next hop.'],
      ['IP address', 'A logical address in four numbers. Devices in the same subnet talk directly; different subnets need a router.'],
      ['Subnet mask / prefix', 'Tells a device which part of the IP is the network. /24 (255.255.255.0) means the first three numbers identify the network.'],
      ['Default gateway', 'The router address a host sends to when the destination is outside its own subnet.'],
      ['ARP', 'Address Resolution Protocol. “Who has 192.168.1.20? Tell me its MAC.” The answer is cached in the ARP table.'],
      ['DHCP', 'Dynamic Host Configuration Protocol. A server lends an IP address, subnet mask and default gateway to a device that asks for one.'],
      ['DORA', 'The four DHCP messages: Discover, Offer, Request, ACK. The first three are broadcasts because the client has no address yet.'],
      ['Lease', 'A DHCP address is borrowed, not owned. It comes with a timer; the client renews it before the timer runs out.'],
      ['APIPA', 'Automatic Private IP Addressing. If DHCP fails, a host can self-assign 169.254.x.x/16 for same-link communication only (no gateway, no routing).'],
      ['VLAN (802.1Q)', 'Virtual LANs split one switch into isolated Layer 2 domains. Access ports carry one VLAN; trunk ports tag frames to carry multiple VLANs.'],
      ['UDP', 'User Datagram Protocol. Connectionless transport: no handshake and no delivery guarantee, used for DNS, streaming, VoIP and more.'],
      ['TTL', 'Time To Live. Each router subtracts one. At zero the packet dies, which stops routing loops.'],
      ['Static route', 'A hand-written routing table entry: destination network + prefix + next-hop IP.'],
      ['OSPF / IS-IS', 'Link-state routing protocols: routers share topology (LSAs/LSPs) and compute shortest paths (SPF). IS-IS runs at Layer 2 and is common in SP networks.'],
      ['EIGRP', 'An advanced distance-vector (hybrid) routing protocol that exchanges routes with composite metrics (bandwidth, delay, etc.).'],
      ['BGP', 'Border Gateway Protocol, a path-vector protocol between autonomous systems (AS). Peers exchange prefixes with attributes like AS_PATH.'],
      ['TLS', 'Transport Layer Security secures application traffic (e.g. HTTPS) via a handshake that negotiates ciphers and keys.'],
      ['IPsec', 'Secures IP packets (often VPNs). IKE negotiates security associations; ESP provides encryption, integrity and anti-replay.'],
      ['802.1X', 'Port-based network access control. A supplicant authenticates via EAP/EAPOL before the port is authorized.'],
      ['RADIUS', 'AAA protocol over UDP commonly used for network access and 802.1X (Access-Request/Accept/Challenge).'],
      ['TACACS+', 'AAA protocol over TCP that separates authentication, authorization, and accounting; often used for device administration.'],
      ['Wi-Fi (802.11)', 'Wireless LANs: clients discover/associate with an AP; WPA2/WPA3 use handshakes to derive encryption keys.'],
      ['WPA3', 'Newer Wi-Fi security using SAE (Simultaneous Authentication of Equals). Resists offline password guessing and adds forward secrecy.'],
      ['DNS', 'Domain Name System. Translates names (web.local) into IP addresses using records such as A/AAAA, over UDP/TCP port 53.'],
      ['NAT / PAT', 'Network Address Translation rewrites private addresses to public ones. PAT (overload) lets many internal hosts share one public IP by tracking ports.'],
      ['ACL / firewall', 'Access Control Lists (and firewall rules) permit or deny traffic by criteria such as source, destination, and protocol. Evaluated top-down.'],
      ['Traceroute', 'Discovers the path to a destination by sending probes with increasing TTL; each router replies ICMP Time Exceeded until the target answers.'],
      ['NTP', 'Network Time Protocol (UDP 123) synchronizes clocks — important for logs, certificates, and authentication.'],
      ['SNMP', 'Simple Network Management Protocol (UDP 161/162) monitors and manages devices via MIBs/OIDs; SNMPv3 adds authentication and encryption.'],
      ['Syslog', 'Centralized logging protocol (UDP 514, or TCP/TLS). Collects events with severity/facility for operations and auditing.'],
      ['IPv6 / SLAAC / DHCPv6', 'IPv6 uses 128-bit addresses. SLAAC lets hosts form addresses from router advertisements; DHCPv6 can supply addresses and options (e.g. DNS).'],
      ['Common ports', 'HTTP 80, HTTPS 443, SSH 22, Telnet 23, FTP 20/21, SMTP 25, DNS 53, DHCP 67/68, TFTP 69, NTP 123, SNMP 161/162, LDAP 389, HTTPS 443, SMB 445, Syslog 514, LDAPS 636, IMAP 143, POP3 110, RDP 3389, RADIUS 1812/1813, TACACS+ 49, 802.1X/EAPOL (Layer 2).']
    ];
    const body =
      '<h3>How a ping works</h3>' +
      '<p><b>1.</b> The sender compares the destination IP with its own subnet.<br>' +
      '<b>2.</b> Same subnet → ARP for the destination directly. Different subnet → ARP for the default gateway.<br>' +
      '<b>3.</b> Switches forward the frame and learn MAC addresses along the way.<br>' +
      '<b>4.</b> Each router looks up the destination IP, decrements TTL, and forwards to the next hop.<br>' +
      '<b>5.</b> The destination replies, and the reply retraces the path.</p>' +
      '<h3>How DHCP gives out an address</h3>' +
      '<p><b>1. Discover.</b> The client has no address, so it broadcasts “is there a DHCP server?” from 0.0.0.0 to 255.255.255.255.<br>' +
      '<b>2. Offer.</b> A server proposes an address from its pool.<br>' +
      '<b>3. Request.</b> The client broadcasts back “I would like that one.”<br>' +
      '<b>4. ACK.</b> The server confirms, and the client may start using the address, mask and gateway. The address is now a lease.<br>' +
      '<b>No server?</b> A host may self-assign an APIPA link-local address (169.254.x.x/16) for same-segment communication.</p>' +
      '<h3>More protocols in NetLab</h3>' +
      '<p><b>UDP</b> sends datagrams without a handshake. <b>802.1Q</b> uses VLAN tags to separate traffic on switches/trunks. <b>Dynamic routing</b> (OSPF, EIGRP, BGP, IS-IS) lets routers learn paths. <b>Security & access</b> demos show TLS, IPsec, 802.1X, RADIUS, TACACS+, Wi-Fi/WPA2, and WPA3 exchanges in simplified form.</p>' +
      '<h3>Network+ services, ports & tools</h3>' +
      '<p><b>Web/remote:</b> HTTP 80, HTTPS 443, SSH 22, Telnet 23, RDP 3389. <b>Files/mail:</b> FTP 20/21, TFTP 69, SMB 445, SMTP 25, IMAP 143, POP3 110. <b>Network services:</b> DNS 53, DHCP 67/68, NTP 123, SNMP 161/162, Syslog 514, LDAP 389, RADIUS 1812/1813, TACACS+ 49.</p>' +
      '<p><b>DNS</b> resolves names to IPs. <b>NAT/PAT</b> translates private addresses to public ones. <b>ACLs/firewalls</b> permit or deny traffic by rules. <b>Traceroute</b> reveals each hop using TTL expiry. <b>IPv6</b> uses SLAAC/DHCPv6 for addressing. Enable DNS/NAT/ACL settings in a device’s Device tab, then use the DNS Resolve and Traceroute actions.</p>' +
      '<h3>The pieces</h3>' +
      terms.map(t => '<div class="term"><b>' + t[0] + '</b><span>' + t[1] + '</span></div>').join('') +
      '<h3>Controls</h3>' +
      '<div class="shortcut-grid">' +
        '<div class="shortcut"><kbd>V</kbd> Select / move</div>' +
        '<div class="shortcut"><kbd>C</kbd> Connect a cable</div>' +
        '<div class="shortcut"><kbd>G</kbd> Ping</div>' +
        '<div class="shortcut"><kbd>X</kbd> Delete</div>' +
        '<div class="shortcut"><kbd>Space</kbd> Pause / continue</div>' +
        '<div class="shortcut"><kbd>S</kbd> Advance one step</div>' +
        '<div class="shortcut"><kbd>Del</kbd> Delete selected device</div>' +
        '<div class="shortcut"><kbd>Esc</kbd> Cancel / close</div>' +
      '</div>' +
      '<h3>Make it easier on your eyes</h3>' +
      '<p>The <b>Speed</b> menu in the journey log slows every animation down (0.25× is very slow). Use pause and Step to freeze the action and inspect one hop at a time, or open <b>Customize</b> to resize/hide panels and save a layout that fits you.</p>' +
      '<h3>The one trick that teaches the most</h3>' +
      '<p>Change one thing — an IP, a gateway, a prefix — and predict what happens before you ping. Being wrong is the fastest way to learn networking.</p>';
    openModal('NetLab help', 'Networking, the friendly version', body);
  }

  function openSubnetTool() {
    const body =
      '<p>Paste an address and pick a prefix. The strip shows exactly which bits a device keeps as the network and which are free for hosts.</p>' +
      '<div class="modal-grid">' +
        '<div class="field"><label>IP address</label><input id="subnetAddr" value="192.168.1.10" autocomplete="off" spellcheck="false"></div>' +
        '<div class="field"><label>Prefix (0–32)</label><input id="subnetPrefix" type="number" min="0" max="32" value="24"></div>' +
      '</div>' +
      '<div id="subnetBinary"></div>' +
      '<div class="result-box" id="subnetResult"></div>';
    openModal('Subnet calculator', 'Watch the mask divide network bits from host bits', body, { wide: true });

    const addrEl = $('subnetAddr');
    const prefixEl = $('subnetPrefix');
    function cellRow(label, value, prefix) {
      const b = bits(value, 32);
      let cells = '';
      for (let i = 0; i < 32; i++) {
        const state = i < prefix ? 'net' : 'host';
        const edge = i % 8 === 7 && i < 31 ? ' octet-end' : '';
        const one = b[i] === '1' ? ' one' : '';
        cells += '<span class="bit-cell ' + state + edge + one + '">' + b[i] + '</span>';
      }
      return '<div class="bit-row"><span class="bit-label">' + label + '</span><div class="bit-cells">' + cells + '</div></div>';
    }
    function calc() {
      const addr = addrEl.value.trim();
      const prefix = Number(prefixEl.value);
      const visual = $('subnetBinary');
      const box = $('subnetResult');
      if (!ip.valid(addr) || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
        visual.innerHTML = '';
        box.innerHTML = '<div class="error-text">Enter a valid IPv4 address and a prefix from 0 to 32.</div>';
        return;
      }
      const n = ip.toInt(addr);
      const mask = ip.maskInt(prefix);
      const net = ip.netInt(n, prefix);
      const bcast = (net | (~mask >>> 0)) >>> 0;
      const first = prefix >= 31 ? ip.fromInt(net) : ip.fromInt((net + 1) >>> 0);
      const last = prefix >= 31 ? ip.fromInt(bcast) : ip.fromInt((bcast - 1) >>> 0);
      const usable = ip.hostCount(prefix);
      const isHost = !ip.isNetworkOrBroadcast(addr, prefix);
      const axis =
        '<div class="bit-axis"><span></span><div class="bit-cells">' +
          [1, 2, 3, 4].map(o => '<span class="axis-label" style="grid-column: span 8">Octet ' + o + '</span>').join('') +
        '</div></div>';
      visual.innerHTML =
        '<div class="bit-grid">' + axis +
          cellRow('Address', n, prefix) +
          cellRow('Mask', mask, prefix) +
          cellRow('Network', net, prefix) +
          cellRow('Broadcast', bcast, prefix) +
          '<div class="legend"><span><i class="net"></i>Network bits (first ' + prefix + ')</span>' +
          '<span><i class="host"></i>Host bits (last ' + (32 - prefix) + ')</span>' +
          '<span>An underline marks a 1 bit</span></div>' +
        '</div>';
      box.innerHTML =
        '<div class="result-row"><span>Network</span><b class="big-answer">' + ip.fromInt(net) + '/' + prefix + '</b></div>' +
        '<div class="result-row"><span>Subnet mask</span><b>' + ip.mask(prefix) + '</b></div>' +
        '<div class="result-row"><span>Broadcast</span><b>' + ip.fromInt(bcast) + '</b></div>' +
        '<div class="result-row"><span>Usable range</span><b>' + first + ' – ' + last + '</b></div>' +
        '<div class="result-row"><span>Usable hosts</span><b>' + usable + '</b></div>' +
        '<div class="result-row"><span>What the mask does</span><b>Keeps the first ' + prefix + ' bits, zeroes the rest</b></div>' +
        '<div class="result-row"><span>Your address</span><b class="' + (isHost ? 'ok-text' : 'warn-text') + '">' +
          (isHost ? 'usable host' : 'network or broadcast') + '</b></div>';
    }
    addrEl.addEventListener('input', calc);
    prefixEl.addEventListener('input', calc);
    calc();
    addrEl.focus();
    addrEl.select();
  }

  // =================== events ===================
  function bindEvents() {
    els.btnLoad.addEventListener('click', () => bootLab(els.lessonSelect.value));
    els.lessonSelect.addEventListener('change', () => bootLab(els.lessonSelect.value));

    els.palette.addEventListener('click', e => {
      const add = e.target.closest('[data-add]');
      if (add) { addDevice(add.dataset.add); return; }
      const tool = e.target.closest('[data-tool]');
      if (tool) setTool(tool.dataset.tool);
    });

    els.workspace.addEventListener('click', onWorkspaceClick);

    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => openTab(tab.dataset.tab));
    });
    els.panelClose.addEventListener('click', () => setPanelVisible(false));
    els.btnPanel.addEventListener('click', () => setPanelVisible(ui.settings.panelHidden));

    els.paneLab.addEventListener('click', e => {
      const loadSaved = e.target.closest('[data-saved-load]');
      if (loadSaved) { loadSavedLab(loadSaved.dataset.savedLoad); return; }
      const deleteSaved = e.target.closest('[data-saved-delete]');
      if (deleteSaved) { deleteSavedLab(deleteSaved.dataset.savedDelete); return; }

      const btn = e.target.closest('[data-action]');
      if (!btn || !ui.currentLab) return;
      const action = btn.dataset.action;
      const task = ui.currentLab.tasks.find(t => t.id === btn.dataset.task);

      if (action === 'apply' && task && task.apply) {
        const message = task.apply();
        M.clearL2Data();
        NL.resetTrafficFlags();
        refresh();
        if (task.focus) {
          const d = M.byName(task.focus);
          if (d) selectDevice(d.id, false);
        }
        toast(message || 'Filled in the suggested settings.', 'ok');
      } else if (action === 'run' && task) {
        runTask(task, Number(btn.dataset.run || 0));
      } else if (action === 'focus' && task) {
        focusTaskDevice(task);
      } else if (action === 'reset') {
        bootLab(ui.currentLab.id);
      } else if (action === 'clear-data') {
        M.state.devices.forEach(d => M.clearDeviceData(d));
        M.clearL2Data();
        NL.resetFlags();
        refresh();
        clearFrame();
        toast('Addresses and routes cleared. The cables are still there.');
      } else if (action === 'tidy') {
        arrangeDevices();
        repairOverlaps();
        refresh();
        toast('Layout tidied into topology rows.');
      } else if (action === 'next') {
        const next = NL.missions.labs[NL.missions.indexOf(ui.currentLab.id) + 1];
        if (next) bootLab(next.id);
      }
    });

    els.paneLab.addEventListener('submit', e => {
      const form = e.target.closest('form[data-saved-lab-form]');
      if (!form) return;
      e.preventDefault();
      const input = form.querySelector('input[name="name"]');
      saveCurrentLab(input ? input.value : '');
    });

    els.paneDevice.addEventListener('change', e => {
      const input = e.target.closest('input[data-field], input[data-dhcp-field], select[data-dhcp-field], select[data-routing-field], input[data-routing-field], select[data-vlan-field], input[data-vlan-field], input[data-dns-field], input[data-nat-field], select[data-nat-field], input[data-acl-field], input[data-service-field]');
      if (input) handleFieldChange(input);
    });
    els.paneDevice.addEventListener('click', handleInspectorClick);
    els.paneDevice.addEventListener('submit', handleRouteSubmit);

    els.btnHelp.addEventListener('click', openHelp);
    els.btnSubnet.addEventListener('click', openSubnetTool);
    els.btnMac.addEventListener('click', openMacTool);
    els.btnIPv6.addEventListener('click', openIPv6Tool);
    if (els.btnWireless && NL.learn) els.btnWireless.addEventListener('click', NL.learn.openWirelessTool);
    if (els.btnEthernet && NL.learn) els.btnEthernet.addEventListener('click', NL.learn.openEthernetTool);
    if (els.btnOSI && NL.learn) els.btnOSI.addEventListener('click', NL.learn.openOSITool);
    if (els.btnRoutingViz && NL.learn) els.btnRoutingViz.addEventListener('click', NL.learn.openRoutingVisualizer);
    els.btnLayout.addEventListener('click', openLayoutPanel);

    if (els.dockTabLog) els.dockTabLog.addEventListener('click', () => setDockView('log'));
    if (els.dockTabConsole) els.dockTabConsole.addEventListener('click', () => setDockView('console'));

    if (els.consoleDevice) els.consoleDevice.addEventListener('change', e => {
      initConsole();
      const id = e.target.value || null;
      if (consoleState.cli && consoleState.cli.getDeviceId() !== id) {
        consoleState.deviceId = id;
        consoleState.cli.setDevice(id);
        updateConsolePrompt();
        const dev = id ? M.getDevice(id) : null;
        consoleBanner('Switched to ' + (dev ? dev.name : 'no device') + '.');
      }
    });
    if (els.btnConsoleHelp) els.btnConsoleHelp.addEventListener('click', () => openCommandReference(''));
    if (els.btnConsoleClear) els.btnConsoleClear.addEventListener('click', () => {
      initConsole();
      consoleBanner('Console output cleared.');
      if (els.consoleInput) els.consoleInput.focus();
    });
    if (els.consoleForm) els.consoleForm.addEventListener('submit', e => {
      e.preventDefault();
      runConsoleCommand();
    });
    if (els.consoleInput) els.consoleInput.addEventListener('keydown', e => {
      if (!consoleState.cli) initConsole();
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const value = consoleState.cli.historyPrev();
        if (value != null) {
          els.consoleInput.value = value;
          setTimeout(() => els.consoleInput.setSelectionRange(value.length, value.length), 0);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const value = consoleState.cli.historyNext();
        if (value != null) {
          els.consoleInput.value = value;
          setTimeout(() => els.consoleInput.setSelectionRange(value.length, value.length), 0);
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        completeConsoleInput();
      }
    });

    els.dockToggle.addEventListener('click', () => {
      setDockCollapsed(!ui.settings.dockCollapsed);
    });
    els.speedSelect.addEventListener('change', () => setSpeed(els.speedSelect.value));
    els.btnPause.addEventListener('click', togglePause);
    els.btnStep.addEventListener('click', stepSim);
    els.btnStop.addEventListener('click', () => {
      NL.sim.cancel();
      toast('Simulation stopped.');
    });
    els.btnClearLog.addEventListener('click', clearLog);

    els.modalRoot.addEventListener('click', e => {
      const tryBtn = e.target && e.target.closest ? e.target.closest('[data-cmd-try]') : null;
      if (tryBtn) {
        const command = tryBtn.getAttribute('data-cmd-try') || '';
        closeModal();
        setDockView('console');
        initConsole();
        if (els.consoleInput) {
          els.consoleInput.value = command;
          els.consoleInput.focus();
          els.consoleInput.setSelectionRange(command.length, command.length);
        }
        return;
      }
      if (e.target === els.modalRoot || (e.target && e.target.closest && e.target.closest('.modal-close'))) closeModal();
    });

    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !els.modalRoot.hidden) { closeModal(); return; }
      const tag = (e.target && e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if (e.key === 'Escape') {
        if (ui.cableSource || ui.pingSource) {
          ui.cableSource = null;
          ui.pingSource = null;
          renderScene();
          updateHint();
          return;
        }
        setTool('select');
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (ui.selectedId) {
          const dev = M.getDevice(ui.selectedId);
          if (dev) { e.preventDefault(); deleteDevice(dev); }
        }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === ' ') { e.preventDefault(); togglePause(); }
      else if (key === 's') stepSim();
      else if (key === 'v') setTool('select');
      else if (key === 'c') setTool('cable');
      else if (key === 'g') setTool('ping');
      else if (key === 'x') setTool('delete');
    });

    window.addEventListener('resize', () => {
      applyLayout();
      scheduleWorkspaceResize(120);
    });
  }

  // =================== start ===================
  function init() {
    NL.hooks = {
      log: addLog,
      frame: renderFrame,
      status: renderStatus,
      travel: travel,
      done: onPingDone
    };

    populateLabs();
    loadSettings();
    setupResizers();
    bindEvents();
    applyLayout();
    setSpeed(ui.settings.speed);
    setStepMode(ui.settings.stepMode);
    renderStatus('idle', '');
    clearFrame();
    clearLog();

    if (!restoreSession()) {
      bootLab(NL.missions.labs[0].id, { silent: true });
      addLog({
        kind: 'ip',
        text: 'Welcome to NetLab. Follow the lab guide on the right.',
        detail: 'Add devices from the left, connect them with the Cable tool, then use Ping to watch a packet travel.'
      });
    }

    initConsole();
    updateHint();
    updateChrome();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
