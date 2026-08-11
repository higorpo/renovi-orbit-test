#!/usr/bin/env node
/**
 * Hook Cursor: evento `stop` (agente concluiu a resposta).
 * Detecta alterações em código de produto e grava um lembrete para sincronizar
 * `docs/business/`. Não invoca o modelo sozinho — use a regra + Task ou o comando
 * `.cursor/commands/atualizar-documentacao-negocio.md`.
 *
 * @see https://cursor.com/docs/hooks
 * @see https://github.com/johnlindquist/cursor-hooks (tipos e schema)
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PENDING_REL = path.join(".cursor", "hooks", ".business-docs-sync-pending.json");

const PRODUCT_PATTERNS = [
  /^src\//,
  /^supabase\/migrations\//,
  /^supabase\/functions\//,
  /^supabase\/config\.toml$/,
];

function matchesProductPath(filePath) {
  const n = filePath.replace(/^\/+/, "");
  return PRODUCT_PATTERNS.some((re) => re.test(n));
}

async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getChangedFiles(workspaceRoot) {
  let out;
  try {
    out = execSync("git status --porcelain -u", {
      cwd: workspaceRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return [];
  }
  const files = new Set();
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const entry = line.slice(3).trim();
    const parts = entry.split(" -> ");
    const p = parts[parts.length - 1].trim();
    if (p) files.add(p);
  }
  return [...files];
}

function main() {
  readStdinJson()
    .then((payload) => {
      if (!payload || typeof payload !== "object") return;

      const roots = Array.isArray(payload.workspace_roots) ? payload.workspace_roots : [];
      const workspaceRoot = roots[0] || process.cwd();

      if (!fs.existsSync(path.join(workspaceRoot, ".git"))) return;

      const changed = getChangedFiles(workspaceRoot);
      const productFiles = changed.filter(matchesProductPath);
      if (productFiles.length === 0) return;

      const pendingPath = path.join(workspaceRoot, PENDING_REL);
      fs.mkdirSync(path.dirname(pendingPath), { recursive: true });
      const record = {
        updatedAt: new Date().toISOString(),
        hook_event_name: payload.hook_event_name || "stop",
        reason: "product_code_changed",
        files: productFiles,
        hint:
          "Sincronize docs/business: use Task (subagente) conforme .cursor/rules/business-docs-sync-after-code-changes.mdc ou o comando atualizar-documentacao-negocio.",
      };
      fs.writeFileSync(pendingPath, JSON.stringify(record, null, 2), "utf8");

      // Logs do hook no Cursor costumam exibir stderr
      console.error(
        "[Prestway docs]\n" +
          `Alterações em código de produto detectadas (${productFiles.length} arquivo(s)).\n` +
          `Lembrete gravado em: ${PENDING_REL}\n` +
          "Atualize a documentação de negócio antes de encerrar o trabalho.",
      );
    })
    .catch(() => {});
}

main();
