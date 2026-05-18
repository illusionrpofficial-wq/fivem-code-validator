import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

import { fileExists } from './utils/fs.js';

export const DEFAULT_BASELINE_FILE = '.fivemcheck-baseline.json';

export async function loadBaseline(resourcePath, configBaselinePath, cliBaselinePath) {
  const baselinePath = resolveBaselinePath(resourcePath, configBaselinePath, cliBaselinePath);
  const exists = await fileExists(baselinePath);

  if (!exists) {
    return {
      path: baselinePath,
      exists: false,
      entries: []
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(await readFile(baselinePath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid baseline file at ${baselinePath}: ${message}`);
  }

  const ignoredFindings = Array.isArray(parsed?.ignoredFindings) ? parsed.ignoredFindings : null;
  if (!ignoredFindings) {
    throw new Error(`Invalid baseline file at ${baselinePath}: ignoredFindings must be an array.`);
  }

  const entries = ignoredFindings
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      ruleId: String(entry.ruleId || ''),
      file: String(entry.file || '').replace(/\\/g, '/'),
      lineHash: String(entry.lineHash || '')
    }))
    .filter((entry) => entry.ruleId && entry.file && entry.lineHash);

  return {
    path: baselinePath,
    exists: true,
    entries
  };
}

export function applyBaseline(findings, baseline) {
  if (!baseline.exists || baseline.entries.length === 0) {
    return {
      findings,
      baselinedFindings: []
    };
  }

  const baselineIndex = new Set(baseline.entries.map(toBaselineKey));
  const activeFindings = [];
  const baselinedFindings = [];

  for (const finding of findings) {
    if (baselineIndex.has(toBaselineKey(finding))) {
      baselinedFindings.push(finding);
      continue;
    }

    activeFindings.push(finding);
  }

  return {
    findings: activeFindings,
    baselinedFindings
  };
}

export async function writeBaselineFile(findings, outputPath) {
  const resolvedPath = path.resolve(process.cwd(), outputPath);
  const payload = {
    ignoredFindings: findings.map((finding) => ({
      ruleId: finding.ruleId,
      file: finding.file,
      lineHash: finding.lineHash,
      severity: finding.severity,
      message: finding.message
    }))
  };

  await mkdir(path.dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return resolvedPath;
}

function resolveBaselinePath(resourcePath, configBaselinePath, cliBaselinePath) {
  const selectedPath = cliBaselinePath || configBaselinePath || DEFAULT_BASELINE_FILE;
  return path.isAbsolute(selectedPath)
    ? selectedPath
    : path.resolve(resourcePath, selectedPath);
}

function toBaselineKey(entry) {
  return `${entry.ruleId}|${entry.file}|${entry.lineHash}`;
}