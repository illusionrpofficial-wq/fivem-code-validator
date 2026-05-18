import path from 'node:path';
import { readFile } from 'node:fs/promises';

import { normalizeSeverity, VALID_SEVERITIES } from './findings.js';
import { fileExists } from './utils/fs.js';

export const DEFAULT_RULES = {
  'manifest-basic-check': 'error',
  'manifest-files-check': 'error',
  'native-side-check': 'error',
  'native-arg-count': 'warn',
  'no-loop-without-wait': 'error',
  'event-loop-spam': 'warn',
  'event-prefix-check': 'warn',
  'sql-injection-check': 'error',
  'debug-output-check': 'warn',
  'client-controlled-money': 'high',
  'net-event-player-validation': 'warn',
  'net-event-missing-cooldown': 'warn',
  'net-event-missing-distance-check': 'warn',
  'nui-innerhtml-check': 'warn',
  'nui-callback-check': 'warn',
  'manifest-missing-dependency': 'warn',
  'manifest-export-check': 'warn'
};

const VALID_FRAMEWORKS = new Set(['esx', 'qbcore', 'qbox', 'standalone']);

export class ConfigValidationError extends Error {
  constructor(issues) {
    super(`Invalid config:\n${issues.map((issue) => `- ${issue}`).join('\n')}`);
    this.name = 'ConfigValidationError';
    this.issues = issues;
  }
}

export async function loadConfig(resourcePath, explicitConfigPath, allowedRuleIds = []) {
  const configPath = explicitConfigPath
    ? path.resolve(process.cwd(), explicitConfigPath)
    : path.join(resourcePath, '.fivemcheck.json');

  const hasConfig = await fileExists(configPath);
  if (explicitConfigPath && !hasConfig) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  let userConfig = {};
  if (hasConfig) {
    try {
      userConfig = JSON.parse(await readFile(configPath, 'utf8'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ConfigValidationError([`config file is not valid JSON: ${message}`]);
    }
  }

  const issues = validateUserConfig(userConfig, allowedRuleIds);
  if (issues.length > 0) {
    throw new ConfigValidationError(issues);
  }

  const configuredRules = {};
  for (const [ruleId, severity] of Object.entries({ ...DEFAULT_RULES, ...(userConfig.rules ?? {}) })) {
    const normalized = normalizeSeverity(severity);
    if (normalized) {
      configuredRules[ruleId] = normalized;
    }
  }

  return {
    configPath,
    hasConfig,
    manifest: userConfig.manifest || 'fxmanifest.lua',
    framework: typeof userConfig.framework === 'string' ? userConfig.framework.toLowerCase() : null,
    webDir: userConfig.webDir || null,
    eventPrefix: userConfig.eventPrefix || null,
    ignore: userConfig.ignore || [],
    baselinePath: userConfig.baseline || null,
    rules: configuredRules,
    offline: Boolean(userConfig.offline),
    userConfig
  };
}

function validateUserConfig(userConfig, allowedRuleIds) {
  const issues = [];

  if (!userConfig || Array.isArray(userConfig) || typeof userConfig !== 'object') {
    issues.push('root config value must be a JSON object');
    return issues;
  }

  if (userConfig.framework !== undefined) {
    const framework = String(userConfig.framework).toLowerCase();
    if (!VALID_FRAMEWORKS.has(framework)) {
      issues.push('framework must be one of: esx, qbcore, qbox, standalone');
    }
  }

  for (const [fieldName, fieldValue] of Object.entries({
    manifest: userConfig.manifest,
    webDir: userConfig.webDir,
    eventPrefix: userConfig.eventPrefix,
    baseline: userConfig.baseline
  })) {
    if (fieldValue !== undefined && (typeof fieldValue !== 'string' || fieldValue.trim() === '')) {
      issues.push(`${fieldName} must be a non-empty string`);
    }
  }

  if (userConfig.offline !== undefined && typeof userConfig.offline !== 'boolean') {
    issues.push('offline must be a boolean');
  }

  if (userConfig.ignore !== undefined) {
    if (!Array.isArray(userConfig.ignore)) {
      issues.push('ignore must be an array of glob strings');
    } else {
      userConfig.ignore.forEach((value, index) => {
        if (typeof value !== 'string' || value.trim() === '') {
          issues.push(`ignore[${index}] must be a non-empty string glob`);
        }
      });
    }
  }

  if (userConfig.rules !== undefined) {
    if (!userConfig.rules || Array.isArray(userConfig.rules) || typeof userConfig.rules !== 'object') {
      issues.push('rules must be an object keyed by rule id');
    } else {
      for (const [ruleId, severity] of Object.entries(userConfig.rules)) {
        if (allowedRuleIds.length > 0 && !allowedRuleIds.includes(ruleId)) {
          issues.push(`rules.${ruleId} is not a known rule id`);
          continue;
        }

        if (!VALID_SEVERITIES.includes(String(severity).trim().toLowerCase())) {
          issues.push(`rules.${ruleId} must be one of: ${VALID_SEVERITIES.join(', ')}`);
        }
      }
    }
  }

  return issues;
}