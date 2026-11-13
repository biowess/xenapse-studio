'use strict';
const path = require('path');

const granted = new Set();

function normalize(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) return '';
  const resolved = path.resolve(filePath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function grant(filePath) {
  const norm = normalize(filePath);
  if (norm) granted.add(norm);
  return path.resolve(filePath);
}

function isGranted(filePath) {
  const norm = normalize(filePath);
  return !!norm && granted.has(norm);
}

function assertGranted(filePath) {
  if (!isGranted(filePath)) {
    const err = new Error(`Access to path not granted: ${filePath}`);
    err.code = 'NOT_GRANTED';
    throw err;
  }
}

module.exports = { grant, isGranted, assertGranted, normalize };
