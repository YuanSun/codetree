// Builds two zips in dist/ from the whole project, without node_modules,
// dist or .DS_Store. Needs the `zip` command.
//   dsh-chrome-bridge-<version>.zip           default build (no debugger permission)
//   dsh-chrome-bridge-<version>-debugger.zip  same project, extension/manifest.json = debugger manifest
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = (...p) => JSON.parse(fs.readFileSync(path.join(root, ...p), 'utf8'));
const { version } = readJson('server', 'package.json');
for (const f of ['manifest.json', 'manifest.debugger.json']) {
  const v = readJson('extension', f).version;
  if (v !== version) {
    console.error(`extension/${f} (${v}) and server/package.json (${version}) versions differ`);
    process.exit(1);
  }
}

const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
const base = path.basename(root);
const skip = new Set(['node_modules', 'dist', '.git', '.DS_Store']);

function build(name, debuggerBuild) {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-pack-'));
  try {
    const copy = path.join(stage, base);
    fs.cpSync(root, copy, { recursive: true, filter: (src) => !skip.has(path.basename(src)) });
    if (debuggerBuild) {
      fs.renameSync(path.join(copy, 'extension', 'manifest.debugger.json'), path.join(copy, 'extension', 'manifest.json'));
    }
    const out = path.join(dist, name);
    fs.rmSync(out, { force: true });
    execFileSync('zip', ['-r', '-X', out, base], { cwd: stage, stdio: ['ignore', 'ignore', 'inherit'] });
    console.log(out);
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

build(`dsh-chrome-bridge-${version}.zip`, false);
build(`dsh-chrome-bridge-${version}-debugger.zip`, true);
