import { createHash } from 'node:crypto';

export const VALID_SEVERITIES = Object.freeze(['off', 'info', 'warn', 'error', 'high']);

const SORT_RANK = {
  high: 0,
  error: 1,
  warn: 2,
  info: 3
};

const FAIL_ON_RANK = {
  off: -1,
  info: 0,
  warn: 1,
  error: 2,
  high: 3
};

export function normalizeSeverity(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return VALID_SEVERITIES.includes(normalized) ? normalized : null;
}

export function normalizeFailOn(value) {
  return normalizeSeverity(value);
}

export function normalizeFinding(rawFinding, ruleMeta, config, analysisIndex) {
  if (!ruleMeta) {
    return null;
  }

  const configuredSeverity = normalizeSeverity(config.rules[rawFinding.ruleId]);
  const rawSeverity = normalizeSeverity(rawFinding.severity);
  const severity = configuredSeverity || rawSeverity || ruleMeta.defaultSeverity;
  if (!severity || severity === 'off') {
    return null;
  }

  const file = String(rawFinding.file || '').replace(/\\/g, '/');
  const line = normalizeLocation(rawFinding.line, 1);
  const column = normalizeLocation(rawFinding.column, 1);
  const endLine = normalizeLocation(rawFinding.endLine, line);
  const endColumn = normalizeLocation(rawFinding.endColumn, column);
  const analysis = analysisIndex.get(file);
  const sourceLine = analysis?.lines?.[line - 1] ?? '';
  const lineHash = createLineHash(sourceLine);

  return {
    ruleId: rawFinding.ruleId,
    title: ruleMeta.title,
    severity,
    file,
    line,
    column,
    endLine,
    endColumn,
    message: rawFinding.message,
    suggestion: rawFinding.suggestion || ruleMeta.suggestion || null,
    help: ruleMeta.description,
    lineHash,
    fingerprint: createFingerprint(rawFinding.ruleId, file, lineHash, rawFinding.message)
  };
}

export function compareFindings(left, right) {
  if (SORT_RANK[left.severity] !== SORT_RANK[right.severity]) {
    return SORT_RANK[left.severity] - SORT_RANK[right.severity];
  }

  if (left.file !== right.file) {
    return left.file.localeCompare(right.file);
  }

  if (left.line !== right.line) {
    return left.line - right.line;
  }

  if (left.column !== right.column) {
    return left.column - right.column;
  }

  return left.ruleId.localeCompare(right.ruleId);
}

export function shouldFailForFindings(findings, failOn = 'error') {
  const normalizedFailOn = normalizeFailOn(failOn) || 'error';
  if (normalizedFailOn === 'off') {
    return false;
  }

  return findings.some((finding) => FAIL_ON_RANK[finding.severity] >= FAIL_ON_RANK[normalizedFailOn]);
}

export function isFindingSuppressed(finding, analysis) {
  if (!analysis?.suppressions) {
    return false;
  }

  const { fileRules = [], nextLineRules = {} } = analysis.suppressions;
  if (fileRules.includes('all') || fileRules.includes(finding.ruleId)) {
    return true;
  }

  const lineRules = nextLineRules[String(finding.line)] || [];
  return lineRules.includes('all') || lineRules.includes(finding.ruleId);
}

function normalizeLocation(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function createLineHash(sourceLine) {
  return createHash('sha1')
    .update(String(sourceLine).trim())
    .digest('hex')
    .slice(0, 12);
}

function createFingerprint(ruleId, file, lineHash, message) {
  return createHash('sha1')
    .update(`${ruleId}|${file}|${lineHash}|${message}`)
    .digest('hex')
    .slice(0, 16);
}