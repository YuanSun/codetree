// Builds dist/dsh-chrome-bridge-<version>.zip from the whole project, leaving
// out node_modules, dist and .DS_Store. Needs the `zip` command.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'server', 'package.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extension', 'manifest.json'), 'utf8'));
if (manifest.version !== version) {
  console.error(`manifest.json (${manifest.version}) and package.json (${version}) versions differ`);
  process.exit(1);
}

const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
const out = path.join(dist, `dsh-chrome-bridge-${version}.zip`);
fs.rmSync(out, { force: true });

// Zip from the parent folder so the archive unpacks to one dsh-chrome-bridge/ folder.
const base = path.basename(root);
execFileSync(
  'zip',
  ['-r', '-X', out, base, '-x', `${base}/dist/*`, '*/node_modules/*', '*.DS_Store', `${base}/.git/*`],
  { cwd: path.dirname(root), stdio: ['ignore', 'ignore', 'inherit'] },
);
console.log(out);
