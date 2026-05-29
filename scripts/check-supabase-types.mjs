#!/usr/bin/env node

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const typePaths = [
  'src/lib/supabase/database.types.ts',
  'supabase/functions/_shared/database.types.ts',
];

const before = new Map(
  typePaths.map((relativePath) => [
    relativePath,
    readFileSync(join(rootDir, relativePath), 'utf-8'),
  ]),
);

try {
  execSync('node scripts/generate-supabase-types.mjs', {
    cwd: rootDir,
    stdio: 'inherit',
  });
} catch {
  process.exit(1);
}

let drift = false;

for (const relativePath of typePaths) {
  const after = readFileSync(join(rootDir, relativePath), 'utf-8');
  if (before.get(relativePath) !== after) {
    console.error(
      `Supabase types drift in ${relativePath}. Run: yarn generate-supabase-types`,
    );
    drift = true;
  }
}

if (drift) {
  process.exit(1);
}

console.log('Supabase types are in sync with local schema.');
