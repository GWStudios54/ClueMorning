import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function restore(prefix, output) {
  const dir = path.join(root, 'content', 'runtime');
  const files = fs.readdirSync(dir)
    .filter(name => name.startsWith(prefix + '.gz.b64.part'))
    .sort();
  if (!files.length) throw new Error(`Missing runtime bundle parts for ${prefix}`);
  const encoded = files.map(name => fs.readFileSync(path.join(dir, name), 'utf8').trim()).join('');
  const data = zlib.gunzipSync(Buffer.from(encoded, 'base64'));
  const out = path.join(root, output);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, data);
  console.log(`Restored ${output} (${data.length.toLocaleString()} bytes)`);
}

restore('puzzles.js', 'src/puzzles.js');
restore('trail_lexicon.txt', 'tools/trail_lexicon.txt');
