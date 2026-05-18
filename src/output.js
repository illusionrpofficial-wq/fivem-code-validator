import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

import { shouldFailForFindings } from './findings.js';

const ANSI = {
  reset: '\u001b[0m',
  dim: '\u001b[2m',
  high: '\u001b[31;1m',
  error: '\u001b[31m',
  warn: '\u001b[33m',
  info: '\u001b[36m'
};

export function buildStats(findings, context, summary = {}) {
  const bySeverity = { high: 0, error: 0, warn: 0, info: 0 };
  const byRule = {};

  for (const finding of findings) {
    bySeverity[finding.severity] += 1;
    byRule[finding.ruleId] = (byRule[finding.ruleId] || 0) + 1;
  }

  return {
    failed: shouldFailForFindings(findings, summary.failOn || 'error'),
    failOn: summary.failOn || 'error',
    totalFindings: findings.length,
    totalCandidateFindings: summary.totalCandidateFindings ?? findings.length,
    suppressedFindings: summary.suppressedFindings ?? 0,
    baselinedFindings: summary.baselinedFindings ?? 0,
    bySeverity,
    byRule,
    filesScanned: context.discovered.analysisTargets.length,
    ignoredFiles: context.discovered.ignoredTargetCount,
    catalog: context.catalog.meta,
    generatedAt: new Date().toISOString()
  };
}

export function printTextReport(result, options = {}) {
  const useColor = shouldUseColor(options);

  if (result.findings.length === 0) {
    process.stdout.write('No active findings detected.\n');
    process.stdout.write(`${formatSummary(result)}\n`);
    return;
  }

  for (const finding of result.findings) {
    process.stdout.write(
      `${formatSeverityLabel(finding.severity, useColor)} ${finding.ruleId} ` +
      `${finding.file}:${finding.line}:${finding.column} ${finding.message}\n`
    );

    if (finding.suggestion) {
      process.stdout.write(`${useColor ? ANSI.dim : ''}  suggestion: ${finding.suggestion}${useColor ? ANSI.reset : ''}\n`);
    }
  }

  process.stdout.write(`${formatSummary(result)}\n`);

  if (process.env.GITHUB_ACTIONS === 'true') {
    emitGithubAnnotations(result.findings);
  }
}

export function printJsonReport(result) {
  process.stdout.write(`${JSON.stringify({
    resourcePath: result.resourcePath,
    stats: result.stats,
    findings: result.findings,
    catalog: result.catalog,
    baseline: {
      path: result.baseline.path,
      exists: result.baseline.exists
    }
  }, null, 2)}\n`);
}

export async function writeOptionalOutputs(result, options) {
  if (options.sarifPath) {
    await writeJsonFile(options.sarifPath, createSarifReport(result));
  }

  if (options.statsFilePath) {
    await writeJsonFile(options.statsFilePath, {
      resourcePath: result.resourcePath,
      stats: result.stats,
      catalog: result.catalog,
      baseline: {
        path: result.baseline.path,
        exists: result.baseline.exists
      }
    });
  }
}

function createSarifReport(result) {
  const rules = Object.values(result.rules).map((rule) => ({
    id: rule.id,
    name: rule.id,
    shortDescription: {
      text: rule.title
    },
    fullDescription: {
      text: rule.description
    }
  }));

  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'FiveM Resource Checker',
            version: '0.1.0',
            rules
          }
        },
        results: result.findings.map((finding) => ({
          ruleId: finding.ruleId,
          level: sarifLevelForSeverity(finding.severity),
          message: {
            text: finding.message
          },
          partialFingerprints: {
            findingFingerprint: finding.fingerprint
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: toPosix(finding.file)
                },
                region: {
                  startLine: finding.line,
                  startColumn: finding.column
                }
              }
            }
          ],
          properties: {
            severity: finding.severity,
            suggestion: finding.suggestion
          }
        }))
      }
    ]
  };
}

function sarifLevelForSeverity(severity) {
  if (severity === 'high' || severity === 'error') {
    return 'error';
  }

  if (severity === 'warn') {
    return 'warning';
  }

  return 'note';
}

function emitGithubAnnotations(findings) {
  for (const finding of findings) {
    const command = finding.severity === 'high' || finding.severity === 'error' ? 'error' : 'warning';
    const message = escapeGithubValue(`${finding.ruleId}: ${finding.message}`);
    const file = escapeGithubValue(toPosix(finding.file));
    process.stdout.write(`::${command} file=${file},line=${finding.line},col=${finding.column}::${message}\n`);
  }
}

function escapeGithubValue(value) {
  return String(value)
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
    .replace(/:/g, '%3A')
    .replace(/,/g, '%2C');
}

async function writeJsonFile(outputPath, data) {
  const resolvedPath = path.resolve(process.cwd(), outputPath);
  await mkdir(path.dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function shouldUseColor(options) {
  return Boolean(process.stdout.isTTY) && !options.noColor && process.env.NO_COLOR !== '1';
}

function formatSeverityLabel(severity, useColor) {
  const label = `[${severity.toUpperCase()}]`;
  if (!useColor) {
    return label;
  }

  return `${ANSI[severity]}${label}${ANSI.reset}`;
}

function formatSummary(result) {
  return `Summary: ${result.stats.totalFindings} active findings across ${result.filesScanned} files ` +
    `(high: ${result.stats.bySeverity.high}, error: ${result.stats.bySeverity.error}, ` +
    `warn: ${result.stats.bySeverity.warn}, info: ${result.stats.bySeverity.info}, ` +
    `suppressed: ${result.stats.suppressedFindings}, baselined: ${result.stats.baselinedFindings}, ` +
    `ignored files: ${result.stats.ignoredFiles}, fail-on: ${result.stats.failOn}).`;
}