'use strict';
const fs = require('fs');
const path = require('path');

const writeQueues = new Map();

async function readJson(file, fallback = null) {
  try {
    const content = await fs.promises.readFile(file, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    return fallback;
  }
}

function writeJson(file, data) {
  const resolved = path.resolve(file);
  const prev = writeQueues.get(resolved) || Promise.resolve();
  const next = prev.then(async () => {
    const dir = path.dirname(resolved);
    await fs.promises.mkdir(dir, { recursive: true });
    const tmp = path.join(dir, `.${path.basename(resolved)}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
    const json = JSON.stringify(data, null, 2);
    const fh = await fs.promises.open(tmp, 'w');
    try {
      await fh.writeFile(json, 'utf8');
      await fh.sync();
    } finally {
      await fh.close();
    }
    try {
      await fs.promises.rename(tmp, resolved);
    } catch (renameErr) {
      if (renameErr.code === 'EXDEV') {
        await fs.promises.copyFile(tmp, resolved);
        await fs.promises.unlink(tmp);
      } else {
        await fs.promises.unlink(tmp).catch(() => {});
        throw renameErr;
      }
    }
  });

  writeQueues.set(resolved, next.catch(() => {}));
  return next;
}

module.exports = { readJson, writeJson };
