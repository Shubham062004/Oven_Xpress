/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * audit_client_imports.js
 *
 * Detailed audit of Client Components to ensure zero server-only dependencies
 * reach client JavaScript bundles.
 *
 * Verifies:
 * 1. Zero Client Components import 'server-only'
 * 2. Zero Client Components directly or transitively import Prisma instance ('@/lib/db/prisma')
 * 3. Zero Client Components directly or transitively import environment validator ('@/lib/security/env-validation')
 * 4. Zero Client Components directly or transitively import server session / auth secrets
 * 5. Server Actions ('use server') are respected as RPC boundaries
 * 6. Type imports are verified as erased
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const SRC_DIR = path.join(ROOT_DIR, 'src');

const FORBIDDEN_PACKAGES = ['server-only', 'next/headers', 'crypto', 'bcryptjs'];

const FORBIDDEN_FILE_PATTERNS = [
  { label: 'Environment Security Validation', regex: /lib[/\\]security[/\\]env-validation/ },
  { label: 'Prisma Client Instance', regex: /lib[/\\]db[/\\]prisma/ },
  { label: 'Auth Session / Token Management', regex: /lib[/\\]auth[/\\](session|tokens)\.ts/ },
];

function normalize(p) {
  return path.resolve(p).replace(/\\/g, '/');
}

function getAllFiles(dir, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (item !== 'node_modules' && item !== '.next') {
        results = results.concat(getAllFiles(full, extensions));
      }
    } else if (extensions.includes(path.extname(full))) {
      results.push(full);
    }
  }
  return results;
}

function hasDirective(filePath, directive) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const snippet = content.slice(0, 1000);
    const regex = new RegExp(`^\\s*['"]${directive}['"]`, 'm');
    return regex.test(snippet);
  } catch {
    return false;
  }
}

function resolveImport(specifier, currentFile) {
  if (FORBIDDEN_PACKAGES.includes(specifier)) {
    return `[FORBIDDEN_PKG:${specifier}]`;
  }
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) {
    return null;
  }

  let basePath;
  if (specifier.startsWith('@/')) {
    basePath = path.join(SRC_DIR, specifier.slice(2));
  } else {
    basePath = path.resolve(path.dirname(currentFile), specifier);
  }

  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
  for (const ext of extensions) {
    const candidate = basePath + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

function parseImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const imports = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trim();
    if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;
    if (!line.includes('import') && !line.includes('export')) continue;

    const isTypeOnly = /^\s*import\s+type\s+/.test(line) || /^\s*export\s+type\s+/.test(line);

    const fromMatch = line.match(/\bfrom\s+['"]([^'"]+)['"]/);
    const directMatch = line.match(/^\s*import\s+['"]([^'"]+)['"]/);

    const specifier = fromMatch ? fromMatch[1] : (directMatch ? directMatch[1] : null);
    if (specifier) {
      imports.push({
        specifier,
        line: idx + 1,
        raw: line,
        isTypeOnly,
      });
    }
  }

  return imports;
}

function checkForbidden(targetPath) {
  if (!targetPath) return null;
  if (targetPath.startsWith('[FORBIDDEN_PKG:')) {
    return targetPath.slice(15, -1);
  }
  const norm = normalize(targetPath);
  for (const item of FORBIDDEN_FILE_PATTERNS) {
    if (item.regex.test(norm)) {
      return item.label;
    }
  }
  return null;
}

function audit() {
  console.log('='.repeat(80));
  console.log('AUDIT CLIENT IMPORTS - Transitive Dependency Security Scanner');
  console.log('='.repeat(80));

  const allFiles = getAllFiles(SRC_DIR);
  const clientFiles = allFiles.filter(f => hasDirective(f, 'use client'));

  console.log(`Auditing ${clientFiles.length} Client Components across ${allFiles.length} source files...\n`);

  const depMap = new Map();
  for (const file of allFiles) {
    depMap.set(file, parseImports(file));
  }

  const issues = [];

  for (const clientFile of clientFiles) {
    const visited = new Set();

    function search(currentPath) {
      const current = currentPath[currentPath.length - 1];
      const currentFilePath = current.file;

      const violation = checkForbidden(currentFilePath);
      if (violation) {
        issues.push({
          clientComponent: path.relative(ROOT_DIR, clientFile),
          violationType: violation,
          forbiddenTarget: currentFilePath,
          chain: [...currentPath],
        });
        return;
      }

      if (visited.has(currentFilePath)) return;
      visited.add(currentFilePath);

      // Next.js 'use server' boundary stops client module inclusion
      if (currentPath.length > 1 && hasDirective(currentFilePath, 'use server')) {
        return;
      }

      const imports = depMap.get(currentFilePath) || [];
      for (const imp of imports) {
        if (imp.isTypeOnly) continue; // Erased at compile time

        const resolved = resolveImport(imp.specifier, currentFilePath);
        if (resolved) {
          search([...currentPath, { file: resolved, import: imp }]);
        }
      }
    }

    search([{ file: clientFile, import: null }]);
  }

  if (issues.length === 0) {
    console.log('[PASS] All Client Components are completely free of server-only modules:');
    console.log('  - No Client Component reaches Prisma Client initialization');
    console.log('  - No Client Component reaches Environment Validation (DATABASE_URL / AUTH_SECRET)');
    console.log('  - No Client Component reaches Server Session / Auth secrets');
    console.log('  - No Client Component reaches server-only guards');
    console.log('='.repeat(80));
    return true;
  } else {
    console.log(`[FAIL] Detected ${issues.length} violation(s) in Client Components:\n`);

    issues.forEach((issue, i) => {
      console.log(`[Violation #${i + 1}] Category: ${issue.violationType}`);
      console.log(`Client Component: ${issue.clientComponent}`);
      console.log('Import Chain:');
      for (let step = 0; step < issue.chain.length - 1; step++) {
        const from = path.relative(ROOT_DIR, issue.chain[step].file);
        const to = issue.chain[step + 1].file.startsWith('[')
          ? issue.chain[step + 1].file
          : path.relative(ROOT_DIR, issue.chain[step + 1].file);
        const imp = issue.chain[step + 1].import;
        console.log(`  ${from} (line ${imp.line})`);
        console.log(`    ↳ Code: ${imp.raw}`);
        console.log(`    ↳ Resolves to: ${to}`);
      }
      console.log('');
    });

    console.log('='.repeat(80));
    return false;
  }
}

const ok = audit();
process.exit(ok ? 0 : 1);
