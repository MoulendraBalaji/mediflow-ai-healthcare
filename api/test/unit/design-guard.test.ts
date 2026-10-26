import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const BANNED = [
  'backdrop-blur',
  'glass',
  'floating-orb',
  'gradient-mesh',
  'bg-clip-text',
  'from-brand',
  'shadow-brand',
  'hover:-translate-y',
  'border-3',
];

function walk(directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(tsx?|css)$/.test(entry.name) ? [full] : [];
  });
}

const appSrc = path.resolve(process.cwd(), '..', 'app', 'src');

test('the frontend contains none of the banned visual patterns', { skip: !fs.existsSync(appSrc) }, () => {
  const offenders: string[] = [];
  for (const file of walk(appSrc)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const pattern of BANNED) {
      if (text.includes(pattern)) offenders.push(`${path.relative(appSrc, file)}: ${pattern}`);
    }
  }
  assert.deepEqual(offenders, []);
});
