'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
let app;
try {
  ({ app } = require('electron'));
} catch (e) {}
const { writeJson } = require('./atomic-json');
const pathGrants = require('./path-grants');

let inMemoryData = null;
let writeQueue = Promise.resolve();
let changeNotifier = null;

function setNotifier(fn) {
  changeNotifier = fn;
}

function notify() {
  if (typeof changeNotifier === 'function') {
    try {
      changeNotifier();
    } catch (e) {}
  }
}

let customRegistryPath = null;

function getRegistryFilePath() {
  if (customRegistryPath) return customRegistryPath;
  const dir = app && typeof app.getPath === 'function' ? app.getPath('userData') : process.cwd();
  return path.join(dir, 'documents.json');
}

function canonicalPath(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) return '';
  let resolved = path.resolve(filePath);
  try {
    resolved = fs.realpathSync(resolved);
  } catch (e) {}
  return resolved;
}

function normalizeKey(p) {
  return process.platform === 'win32' ? p.toLowerCase() : p;
}

function documentId(filePath) {
  const canonical = canonicalPath(filePath);
  const key = normalizeKey(canonical);
  return crypto.createHash('sha1').update(key).digest('hex').slice(0, 16);
}

async function backupCorrupt(filePath) {
  const corruptFile = path.join(path.dirname(filePath), `documents.corrupt-${Date.now()}.json`);
  try {
    await fs.promises.rename(filePath, corruptFile);
  } catch (e) {}
}

async function load() {
  const filePath = getRegistryFilePath();
  let content;
  try {
    content = await fs.promises.readFile(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { version: 1, documents: [] };
    }
    await backupCorrupt(filePath);
    return { version: 1, documents: [] };
  }

  let data;
  try {
    data = JSON.parse(content);
  } catch (err) {
    await backupCorrupt(filePath);
    return { version: 1, documents: [] };
  }

  if (!data || typeof data !== 'object' || data.version !== 1 || !Array.isArray(data.documents)) {
    await backupCorrupt(filePath);
    return { version: 1, documents: [] };
  }

  return data;
}

async function ensureLoaded() {
  if (!inMemoryData) {
    inMemoryData = await load();
  }
  return inMemoryData;
}

function applyHousekeeping(documents) {
  const now = Date.now();
  const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
  let filtered = documents.filter((doc) => {
    if (doc.missingSince && (now - doc.missingSince) > NINETY_DAYS) {
      return false;
    }
    return true;
  });

  if (filtered.length > 500) {
    filtered.sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0));
    filtered = filtered.slice(0, 500);
  }
  return filtered;
}

function enqueue(task) {
  const next = writeQueue.then(task, task);
  writeQueue = next.catch(() => {});
  return next;
}

function checkStatus(filePath) {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve('unknown');
      }
    }, 1500);

    try {
      fs.stat(filePath, (err, stats) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (err) {
          resolve('missing');
        } else if (stats.isFile()) {
          resolve('available');
        } else {
          resolve('missing');
        }
      });
    } catch (e) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve('missing');
    }
  });
}

async function touch(pathOrOpts, opts) {
  return enqueue(async () => {
    let filePath = '';
    let options = {};
    if (typeof pathOrOpts === 'string') {
      filePath = pathOrOpts;
      options = opts && typeof opts === 'object' ? opts : {};
    } else if (pathOrOpts && typeof pathOrOpts === 'object') {
      filePath = pathOrOpts.path;
      options = pathOrOpts;
    }

    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid path for touch');
    }

    if (!pathGrants.isGranted(filePath)) {
      const err = new Error(`Access to path not granted: ${filePath}`);
      err.code = 'NOT_GRANTED';
      throw err;
    }

    const reg = await ensureLoaded();
    const absPath = canonicalPath(filePath);
    const id = documentId(absPath);
    const now = Date.now();
    const eventType = options.event;

    let entry = reg.documents.find((d) => d.id === id);
    if (entry) {
      entry.path = absPath;
      entry.fileName = path.basename(absPath);
      if (options.module !== undefined) entry.module = options.module || null;
      if (options.stylesheetPath !== undefined) entry.stylesheetPath = options.stylesheetPath || null;
      entry.missingSince = null;
      entry.lastOpened = now;
      if (eventType === 'opened') {
        entry.openCount = (entry.openCount || 0) + 1;
      } else if (eventType === 'saved') {
        entry.lastModified = now;
      }
    } else {
      entry = {
        id,
        path: absPath,
        fileName: path.basename(absPath),
        stylesheetPath: options.stylesheetPath || null,
        module: options.module || null,
        firstSeen: now,
        lastOpened: now,
        lastModified: eventType === 'saved' ? now : null,
        openCount: eventType === 'opened' ? 1 : 0,
        missingSince: null,
      };
      reg.documents.push(entry);
    }

    reg.documents = applyHousekeeping(reg.documents);
    await writeJson(getRegistryFilePath(), reg);
    notify();
    return entry;
  });
}

async function list({ recentLimit = 5 } = {}) {
  return enqueue(async () => {
    const reg = await ensureLoaded();
    const statuses = await Promise.all(reg.documents.map((d) => checkStatus(d.path)));

    let changed = false;
    const now = Date.now();
    for (let i = 0; i < reg.documents.length; i++) {
      const doc = reg.documents[i];
      const status = statuses[i];
      if (status === 'missing') {
        if (!doc.missingSince) {
          doc.missingSince = now;
          changed = true;
        }
      }
    }

    if (changed) {
      reg.documents = applyHousekeeping(reg.documents);
      await writeJson(getRegistryFilePath(), reg);
      notify();
    }

    const decorated = reg.documents.map((doc, i) => ({
      ...doc,
      directory: path.dirname(doc.path),
      status: statuses[i],
    }));

    decorated.sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0));

    const recent = [];
    const others = [];
    for (const entry of decorated) {
      if (recent.length < recentLimit && (entry.status === 'available' || entry.status === 'unknown')) {
        recent.push(entry);
      } else {
        others.push(entry);
      }
    }

    for (const entry of decorated) {
      try {
        pathGrants.grant(entry.path);
      } catch (e) {}
    }

    return {
      recent,
      others,
      all: decorated,
      total: decorated.length,
    };
  });
}

async function remove(id) {
  return enqueue(async () => {
    const reg = await ensureLoaded();
    const idx = reg.documents.findIndex((d) => d.id === id);
    if (idx !== -1) {
      reg.documents.splice(idx, 1);
      await writeJson(getRegistryFilePath(), reg);
      notify();
      return true;
    }
    return false;
  });
}

async function removeMissing() {
  return enqueue(async () => {
    const reg = await ensureLoaded();
    const before = reg.documents.length;
    reg.documents = reg.documents.filter((d) => d.missingSince == null);
    if (reg.documents.length !== before) {
      await writeJson(getRegistryFilePath(), reg);
      notify();
      return before - reg.documents.length;
    }
    return 0;
  });
}

module.exports = {
  touch,
  list,
  remove,
  removeMissing,
  setNotifier,
  getRegistryFilePath,
  _resetForTesting: () => { inMemoryData = null; },
  _setRegistryPathForTesting: (p) => { customRegistryPath = p; inMemoryData = null; },
};
