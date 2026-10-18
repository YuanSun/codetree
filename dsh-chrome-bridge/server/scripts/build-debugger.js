// Builds dist/extension-debugger/: the extension folder with the debugger
// manifest as manifest.json. Load it unpacked in Chrome instead of extension/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = path.join(root, 'dist', 'extension-debugger');

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, 'extension'), out, {
  recursive: true,
  filter: (src) => !src.endsWith('.DS_Store') && path.basename(src) !== 'manifest.debugger.json',
});
fs.copyFileSync(path.join(root, 'extension', 'manifest.debugger.json'), path.join(out, 'manifest.json'));
console.log(out);
