#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const outputPath = join(rootDir, 'src/lib/supabase/database.types.ts');

mkdirSync(dirname(outputPath), { recursive: true });

try {
  const result = execSync('npx supabase gen types typescript --local', {
    encoding: 'utf-8',
    cwd: rootDir,
  });
  writeFileSync(outputPath, result, 'utf-8');
  console.log('Tipos gerados do banco local em src/lib/supabase/database.types.ts');
} catch (err) {
  console.error('Erro ao gerar tipos:', err.message);
  console.error('Certifique-se de que o Supabase local está rodando (npx supabase start).');
  process.exit(1);
}
