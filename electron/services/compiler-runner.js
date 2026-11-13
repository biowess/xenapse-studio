'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
let app = null;
try {
  ({ app } = require('electron'));
} catch (e) {}

const activeChildren = new Set();
let runningCount = 0;
const queue = [];

if (app) {
  app.on('before-quit', () => {
    for (const child of activeChildren) {
      try { child.kill('SIGKILL'); } catch (e) {}
    }
    activeChildren.clear();
  });
}

function runNext() {
  if (runningCount >= 2 || queue.length === 0) return;
  const { fn, resolve, reject } = queue.shift();
  runningCount++;
  fn().then(resolve, reject).finally(() => {
    runningCount--;
    runNext();
  });
}

function enqueue(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    runNext();
  });
}

async function compile(options) {
  return enqueue(() => doCompile(options));
}

async function doCompile(options) {
  const { requestId, xnp, xcss, hasStylesheet } = options || {};
  let exe = options && options.exe;

  if (!exe) {
    const locator = require('./compiler-locator');
    const loc = await locator.locate();
    if (!loc.usable || !loc.path) {
      return {
        requestId,
        exitCode: null,
        svg: null,
        stderr: '',
        durationMs: 0,
        error: { type: 'missing-compiler', message: loc.reason || 'Compiler not found or unusable' },
      };
    }
    exe = loc.path;
  }

  let tempDir = null;
  try {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'xenapse-studio-'));
  } catch (err) {
    return {
      requestId,
      exitCode: null,
      svg: null,
      stderr: '',
      durationMs: 0,
      error: { type: 'temp', message: `Failed to create temporary directory: ${err.message}` },
    };
  }

  try {
    const cleanXnp = (typeof xnp === 'string' ? xnp : '')
      .replace(/^\uFEFF/, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    await fs.promises.writeFile(path.join(tempDir, 'input.xnp'), cleanXnp, 'utf8');

    const args = ['compile', 'input.xnp', '-o', '-'];
    if (hasStylesheet) {
      const cleanXcss = (typeof xcss === 'string' ? xcss : '')
        .replace(/^\uFEFF/, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
      await fs.promises.writeFile(path.join(tempDir, 'style.xcss'), cleanXcss, 'utf8');
      args.push('--style', 'style.xcss');
    }

    const startTime = Date.now();
    let child = null;
    const execResult = await new Promise((resolve) => {
      child = execFile(
        exe,
        args,
        {
          cwd: tempDir,
          timeout: 10000,
          maxBuffer: 32 * 1024 * 1024,
          windowsHide: true,
          encoding: 'utf8',
        },
        (error, stdout, stderr) => {
          activeChildren.delete(child);
          const durationMs = Date.now() - startTime;
          resolve({ error, stdout, stderr, durationMs });
        }
      );
      activeChildren.add(child);
    });

    const { error: execErr, stdout, stderr, durationMs } = execResult;

    if (execErr) {
      if (execErr.killed && (execErr.signal === 'SIGTERM' || execErr.code === 'ETIMEDOUT')) {
        return {
          requestId,
          exitCode: null,
          svg: null,
          stderr: stderr || '',
          durationMs,
          error: { type: 'timeout', message: 'Compilation timed out after 10000ms' },
        };
      }
      if (execErr.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
        return {
          requestId,
          exitCode: null,
          svg: null,
          stderr: stderr || '',
          durationMs,
          error: { type: 'output-too-large', message: 'Compiler output exceeded maximum buffer size' },
        };
      }
      if (typeof execErr.code === 'number' && !execErr.signal) {
        return {
          requestId,
          exitCode: execErr.code,
          svg: null,
          stderr: stderr || '',
          durationMs,
          error: null,
        };
      }
      return {
        requestId,
        exitCode: null,
        svg: null,
        stderr: stderr || '',
        durationMs,
        error: { type: 'spawn', message: execErr.message || String(execErr) },
      };
    }

    return {
      requestId,
      exitCode: 0,
      svg: stdout,
      stderr: stderr || '',
      durationMs,
      error: null,
    };
  } catch (err) {
    return {
      requestId,
      exitCode: null,
      svg: null,
      stderr: '',
      durationMs: 0,
      error: { type: 'temp', message: err.message || String(err) },
    };
  } finally {
    if (tempDir) {
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

module.exports = { compile };
