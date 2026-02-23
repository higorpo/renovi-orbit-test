#!/usr/bin/env node

import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    try {
      const content = readFileSync(join(rootDir, file), 'utf-8');
      const env = {};
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eq = trimmed.indexOf('=');
          if (eq > 0) {
            const key = trimmed.slice(0, eq).trim();
            let value = trimmed.slice(eq + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            env[key] = value;
          }
        }
      }
      return env;
    } catch {
      continue;
    }
  }
  return {};
}

const env = loadEnv();
const projectId = process.env.VITE_SUPABASE_PROJECT_ID || env.VITE_SUPABASE_PROJECT_ID;

if (!projectId) {
  console.error('Erro: VITE_SUPABASE_PROJECT_ID não encontrado. Defina em .env.local ou .env');
  process.exit(1);
}

const outputPath = join(rootDir, 'src/lib/supabase/database.types.ts');
mkdirSync(dirname(outputPath), { recursive: true });

try {
  const result = execSync(
    `npx supabase gen types typescript --project-id ${projectId}`,
    { encoding: 'utf-8', cwd: rootDir }
  );
  writeFileSync(outputPath, result, 'utf-8');
  console.log('Tipos gerados em src/lib/supabase/database.types.ts');
} catch (err) {
  console.error('Erro ao gerar tipos:', err.message);
  process.exit(1);
}
