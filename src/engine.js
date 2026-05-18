import { readFile } from 'node:fs/promises';

import { applyBaseline, loadBaseline } from './baseline.js';
import { loadConfig } from './config.js';
import { discoverResourceInputs } from './discovery.js';
import { compareFindings, isFindingSuppressed, normalizeFinding } from './findings.js';
import { parseGenericFile } from './parsers/genericParser.js';
import { parseJsFile } from './parsers/jsParser.js';
import { parseLuaFile } from './parsers/luaParser.js';
import { parseManifest } from './manifest.js';
import { loadNativeCatalog } from './natives.js';
import { buildStats } from './output.js';
import { matchesAnyGlobPattern } from './utils/fs.js';
import { RULE_METADATA, rules } from './rules/index.js';

export async function validateResource(resourcePath, options = {}) {
  const config = await loadConfig(resourcePath, options.configPath ?? null, Object.keys(RULE_METADATA));
  const manifest = await parseManifest(resourcePath, config.manifest);
  const discovered = await discoverResourceInputs(resourcePath, manifest, config);
  const catalog = await loadNativeCatalog({
    offline: options.offline || config.offline,
    disableRemoteNatives: options.disableRemoteNatives
  });

  const analyses = [];
  for (const target of discovered.analysisTargets) {
    const content = await readFile(target.absolutePath, 'utf8');
    analyses.push(parseAnalysis(target, content));
  }

  const analysisIndex = new Map(analyses.map((analysis) => [analysis.relativePath, analysis]));
  const baseline = await loadBaseline(resourcePath, config.baselinePath, options.baselinePath);

  const context = {
    resourcePath,
    config,
    manifest,
    catalog,
    baseline,
    discovered,
    analyses,
    analysisIndex,
    scriptAnalyses: analyses.filter((analysis) => ['client', 'server', 'shared', 'unknown'].includes(analysis.kind)),
    webAnalyses: analyses.filter((analysis) => analysis.kind === 'ui'),
    isIgnoredPath(relativePath) {
      return matchesAnyGlobPattern(config.ignore, relativePath);
    }
  };

  const rawFindings = [];
  for (const rule of rules) {
    rawFindings.push(...rule.apply(context));
  }

  const normalizedFindings = rawFindings
    .map((finding) => normalizeFinding(finding, RULE_METADATA[finding.ruleId], config, analysisIndex))
    .filter(Boolean)
    .sort(compareFindings);

  const suppressedFindings = [];
  const baselineCandidates = [];

  for (const finding of normalizedFindings) {
    const analysis = analysisIndex.get(finding.file);
    if (isFindingSuppressed(finding, analysis)) {
      suppressedFindings.push(finding);
      continue;
    }

    baselineCandidates.push(finding);
  }

  const baselineResult = options.writeBaseline
    ? { findings: baselineCandidates, baselinedFindings: [] }
    : applyBaseline(baselineCandidates, baseline);

  const findings = [...baselineResult.findings].sort(compareFindings);
  const stats = buildStats(findings, context, {
    totalCandidateFindings: normalizedFindings.length,
    suppressedFindings: suppressedFindings.length,
    baselinedFindings: baselineResult.baselinedFindings.length,
    failOn: options.failOn || 'error'
  });

  return {
    resourcePath,
    config,
    manifest,
    catalog: catalog.meta,
    analyses,
    allFindings: normalizedFindings,
    baselineCandidates,
    suppressedFindings,
    baselinedFindings: baselineResult.baselinedFindings,
    baseline,
    findings,
    stats,
    rules: RULE_METADATA,
    filesScanned: discovered.analysisTargets.length,
    exitCode: stats.failed ? 1 : 0
  };
}

function parseAnalysis(target, content) {
  switch (target.language) {
    case 'lua':
      return parseLuaFile(target, content);
    case 'javascript':
      return parseJsFile(target, content);
    default:
      return parseGenericFile(target, content);
  }
}