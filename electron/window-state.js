'use strict';
const fs = require('fs');
const path = require('path');
const { app, screen } = require('electron');

const DEFAULT_W = 1280;
const DEFAULT_H = 800;
const MIN_W = 720;
const MIN_H = 480;
const SAVE_DELAY = 500;
const MIN_VISIBLE_W = 200; /* horizontal overlap with a display's work area */
const TOP_MARGIN = 8;      /* the top bar must stay reachable */

const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');
const isInt = (n) => typeof n === 'number' && Number.isFinite(n);

function read() {
  try {
    const raw = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    if (!raw || typeof raw !== 'object') return null;
    return raw;
  } catch (e) { return null; }
}

/* Atomic write: temp file in the same directory, then rename over the target. */
function write(state) {
  const file = stateFile(), tmp = file + '.tmp';
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, file);
  } catch (e) { try { fs.unlinkSync(tmp); } catch (e2) { /* ignore */ } }
}

function boundsAreUsable(b) {
  if (!b || ![b.x, b.y, b.width, b.height].every(isInt)) return false;
  if (b.width < MIN_W || b.height < MIN_H || b.width > 16384 || b.height > 16384) return false;
  return screen.getAllDisplays().some((d) => {
    const wa = d.workArea;
    const ow = Math.min(b.x + b.width, wa.x + wa.width) - Math.max(b.x, wa.x);
    const oh = Math.min(b.y + b.height, wa.y + wa.height) - Math.max(b.y, wa.y);
    return ow >= MIN_VISIBLE_W && oh >= 100 && b.y >= wa.y - TOP_MARGIN && b.y < wa.y + wa.height - 40;
  });
}

function centredDefault() {
  const wa = screen.getPrimaryDisplay().workArea;
  const width = Math.min(DEFAULT_W, wa.width), height = Math.min(DEFAULT_H, wa.height);
  return { x: wa.x + Math.round((wa.width - width) / 2), y: wa.y + Math.round((wa.height - height) / 2), width, height };
}

/* Returns { bounds, maximized } to use when creating the window. Call after app is ready. */
function resolve() {
  const saved = read();
  if (!saved) return { bounds: centredDefault(), maximized: false };
  const bounds = boundsAreUsable(saved) ? { x: saved.x, y: saved.y, width: saved.width, height: saved.height } : centredDefault();
  return { bounds, maximized: saved.maximized === true };
}

/* Keeps the file up to date. Nothing is recorded while minimized or full-screen. */
function attach(win, initial) {
  let state = { ...initial.bounds, maximized: !!initial.maximized };
  let timer = null;

  const snapshot = () => {
    if (win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return null;
    const maximized = win.isMaximized();
    const b = maximized ? win.getNormalBounds() : win.getBounds();
    return { x: b.x, y: b.y, width: b.width, height: b.height, maximized };
  };
  const flush = () => { clearTimeout(timer); timer = null; write(state); };
  const update = () => {
    const s = snapshot();
    if (!s) return;
    state = s;
    clearTimeout(timer);
    timer = setTimeout(flush, SAVE_DELAY);
  };

  ['resize', 'move', 'maximize', 'unmaximize', 'restore', 'leave-full-screen'].forEach((ev) => win.on(ev, update));
  win.on('close', () => { const s = snapshot(); if (s) state = s; flush(); });
}

module.exports = { resolve, attach, MIN_W, MIN_H };
