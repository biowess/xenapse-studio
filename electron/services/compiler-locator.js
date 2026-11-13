'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

let cachedResult = null;
let locatingPromise = null;
let appInfo = null;

function getAppInfo() {
  if (appInfo) return appInfo;
  try {
    const configPath = path.resolve(__dirname, '..', '..', 'config', 'app-info.json');
    appInfo = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    appInfo = { language: { minVersion: '0.1.0', releasesUrl: 'https://github.com/biowess/xenapse/releases' } };
  }
  return appInfo;
}

function parseSemver(vStr) {
  if (!vStr || typeof vStr !== 'string') return null;
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(vStr);
  if (!m) return null;
  return { major: parseInt(m[1], 10), minor: parseInt(m[2], 10), patch: parseInt(m[3], 10) };
}

function isVersionSufficient(actualStr, minStr) {
  const actual = parseSemver(actualStr);
  const min = parseSemver(minStr);
  if (!actual || !min) return false;
  if (actual.major !== min.major) return actual.major > min.major;
  if (actual.minor !== min.minor) return actual.minor > min.minor;
  return actual.patch >= min.patch;
}

async function queryReg(args) {
  try {
    const { stdout } = await execFileAsync('reg.exe', args, { windowsHide: true, timeout: 5000 });
    return stdout;
  } catch (e) {
    return null;
  }
}

async function collectCandidates() {
  const candidates = [];
  const seen = new Set();

  function add(candidatePath, source) {
    if (!candidatePath) return;
    const resolved = path.resolve(candidatePath.trim().replace(/^"(.*)"$/, '$1'));
    const key = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ path: resolved, source });
  }

  // 1. XENAPSE_CLI environment variable
  if (process.env.XENAPSE_CLI) {
    add(process.env.XENAPSE_CLI, 'env');
  }

  // 2. Linux specific paths
  if (process.platform === 'linux') {
    const home = os.homedir();
    add(path.join(home, '.local', 'bin', 'xenapse'), 'user-bin');
    const xdgData = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
    add(path.join(xdgData, 'xenapse', 'app', 'xenapse'), 'xdg-data');
  }

  // 3. Windows specific path
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    add(path.join(localAppData, 'Programs', 'Xenapse', 'xenapse.exe'), 'localappdata');
  }

  // 4. PATH searched manually
  const pathEnv = process.env.PATH || '';
  const delimiter = path.delimiter || (process.platform === 'win32' ? ';' : ':');
  const pathDirs = pathEnv.split(delimiter);
  for (const dir of pathDirs) {
    const cleanDir = dir.trim().replace(/^"(.*)"$/, '$1');
    if (!cleanDir) continue;
    if (process.platform === 'win32') {
      add(path.join(cleanDir, 'xenapse.exe'), 'path');
      add(path.join(cleanDir, 'xenapse'), 'path');
    } else {
      add(path.join(cleanDir, 'xenapse'), 'path');
    }
  }

  // 5. Windows only: App Paths & persistent user PATH from registry
  if (process.platform === 'win32') {
    const appPathsKey = 'Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\xenapse.exe';
    let appPathsOut = await queryReg(['query', `HKCU\\${appPathsKey}`, '/ve']);
    if (!appPathsOut) {
      appPathsOut = await queryReg(['query', `HKLM\\${appPathsKey}`, '/ve']);
    }
    if (appPathsOut) {
      const match = /REG_SZ\s+(.*)$/m.exec(appPathsOut);
      if (match && match[1]) {
        add(match[1].trim(), 'app-paths');
      }
    }

    const userPathOut = await queryReg(['query', 'HKCU\\Environment', '/v', 'Path']);
    if (userPathOut) {
      const match = /Path\s+REG_(?:EXPAND_)?SZ\s+(.*)$/im.exec(userPathOut);
      if (match && match[1]) {
        const expanded = match[1].trim().replace(/%([^%]+)%/g, (_, v) => {
          return process.env[v] || process.env[v.toUpperCase()] || '';
        });
        const dirs = expanded.split(';');
        for (const dir of dirs) {
          const cleanDir = dir.trim().replace(/^"(.*)"$/, '$1');
          if (cleanDir) {
            add(path.join(cleanDir, 'xenapse.exe'), 'user-path');
          }
        }
      }
    }
  }

  return candidates;
}

async function doLocate() {
  const runner = require('./compiler-runner');
  const info = getAppInfo();
  const minVersion = (info && info.language && info.language.minVersion) || '0.1.0';
  const releasesUrl = (info && info.language && info.language.releasesUrl) || 'https://github.com/biowess/xenapse/releases';

  const candidates = await collectCandidates();
  const candidatesRecord = [];

  for (const candidate of candidates) {
    const candidatePath = candidate.path;
    let exists = false;
    try {
      const stat = fs.statSync(candidatePath);
      exists = stat.isFile();
    } catch (e) {
      exists = false;
    }

    if (!exists) {
      continue;
    }

    if (process.platform !== 'win32') {
      try {
        fs.accessSync(candidatePath, fs.constants.X_OK);
      } catch (e) {
        candidatesRecord.push({
          path: candidatePath,
          source: candidate.source,
          exists: true,
          usable: false,
          reason: 'not-executable',
        });
        continue;
      }
    }

    let versionOutput = '';
    try {
      const { stdout, stderr } = await execFileAsync(candidatePath, ['--version'], {
        timeout: 8000,
        windowsHide: true,
        encoding: 'utf8',
      });
      versionOutput = (stdout || stderr || '').trim();
    } catch (e) {
      candidatesRecord.push({
        path: candidatePath,
        source: candidate.source,
        exists: true,
        usable: false,
        reason: 'version-unreadable',
      });
      continue;
    }

    const versionMatch = /^xenapse\s+(\d+\.\d+\.\d+\S*)/im.exec(versionOutput);
    if (!versionMatch) {
      candidatesRecord.push({
        path: candidatePath,
        source: candidate.source,
        exists: true,
        usable: false,
        reason: 'version-unreadable',
      });
      continue;
    }

    const version = versionMatch[1];
    if (!isVersionSufficient(version, minVersion)) {
      candidatesRecord.push({
        path: candidatePath,
        source: candidate.source,
        exists: true,
        usable: false,
        version,
        reason: `version-too-old: ${version}`,
      });
      continue;
    }

    // Smoke test: compile IMPORT FLOW\nSTART\nEND\n and require exitCode 0 and SVG output
    try {
      const smokeResult = await runner.compile({
        xnp: 'IMPORT FLOW\nSTART\nEND\n',
        hasStylesheet: false,
        exe: candidatePath,
      });

      if (smokeResult.exitCode !== 0 || !smokeResult.svg || !smokeResult.svg.includes('<svg')) {
        candidatesRecord.push({
          path: candidatePath,
          source: candidate.source,
          exists: true,
          usable: false,
          version,
          reason: 'smoke-test-failed',
        });
        continue;
      }
    } catch (e) {
      candidatesRecord.push({
        path: candidatePath,
        source: candidate.source,
        exists: true,
        usable: false,
        version,
        reason: 'smoke-test-failed',
      });
      continue;
    }

    const usableCandidate = {
      path: candidatePath,
      source: candidate.source,
      exists: true,
      usable: true,
      version,
      reason: null,
    };
    candidatesRecord.push(usableCandidate);

    return {
      found: true,
      usable: true,
      path: candidatePath,
      source: candidate.source,
      version,
      reason: null,
      minVersion,
      releasesUrl,
      candidates: candidatesRecord,
    };
  }

  const rejected = candidatesRecord.find((c) => c.exists) || null;
  return {
    found: !!rejected,
    usable: false,
    path: rejected ? rejected.path : null,
    source: rejected ? rejected.source : null,
    version: rejected ? (rejected.version || null) : null,
    reason: rejected ? rejected.reason : 'not-found',
    minVersion,
    releasesUrl,
    candidates: candidatesRecord,
  };
}

async function locate() {
  if (cachedResult) return cachedResult;
  if (locatingPromise) return locatingPromise;
  locatingPromise = doLocate().then(
    (res) => {
      cachedResult = res;
      locatingPromise = null;
      return res;
    },
    (err) => {
      locatingPromise = null;
      throw err;
    }
  );
  return locatingPromise;
}

function invalidate() {
  cachedResult = null;
}

module.exports = { locate, invalidate, collectCandidates, isVersionSufficient };
