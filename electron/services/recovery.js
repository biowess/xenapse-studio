'use strict';
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { readJson, writeJson } = require('./atomic-json');

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB max snapshot size
const recoveryPath = () => path.join(app.getPath('userData'), 'recovery', 'recovery.json');

async function readRecovery() {
  return readJson(recoveryPath(), null);
}

async function writeRecovery(snapshot) {
  if (!snapshot) return clearRecovery();
  const json = JSON.stringify(snapshot);
  if (Buffer.byteLength(json, 'utf8') > MAX_BYTES) {
    throw new Error('Recovery snapshot exceeds 6 MB limit');
  }
  await writeJson(recoveryPath(), snapshot);
  return { ok: true };
}

async function clearRecovery() {
  const file = recoveryPath();
  try {
    await fs.promises.unlink(file);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  return { ok: true };
}

module.exports = { readRecovery, writeRecovery, clearRecovery };
