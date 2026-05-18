import { spawn } from 'node:child_process';

import { normalizeNativeName } from './natives.js';

const FRAMEWORK_GLOBALS = Object.freeze({
  esx: ['ESX'],
  qbcore: ['QBCore'],
  qbox: ['QBX'],
  standalone: []
});

const OUTPUT_PATTERN = /^(.*?):(\d+):(\d+)(?:-(\d+))?:\s*(?:\(([EW]\d{3})\)\s*)?(.*)$/;

export async function runLuacheck(context) {
  if (!context.config.luacheck.enabled) {
    return [];
  }

  const luaAnalyses = context.analyses.filter((analysis) => analysis.language === 'lua');
  if (luaAnalyses.length === 0) {
    return [];
  }

  const findings = [];
  for (const analysis of luaAnalyses) {
    findings.push(...await runLuacheckForFile(analysis, context));
  }

  return findings;
}

async function runLuacheckForFile(analysis, context) {
  const args = buildArguments(analysis, context);

  let result;
  try {
    result = await runProcess(
      context.config.luacheck.binary,
      [...context.config.luacheck.args, ...args],
      analysis.content,
      context.resourcePath
    );
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      throw new Error(
        `Luacheck binary not found: ${context.config.luacheck.binary}. ` +
        'Install luacheck or disable luacheck.enabled.'
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Luacheck failed for ${analysis.relativePath}: ${message}`);
  }

  const findings = parseOutput(result.stdout, analysis.relativePath);
  if (result.exitCode > 1 && findings.length === 0) {
    const details = [result.stderr.trim(), result.stdout.trim()]
      .filter(Boolean)
      .join('\n');
    throw new Error(
      `Luacheck failed for ${analysis.relativePath}: ${details || `exit code ${result.exitCode}`}`
    );
  }

  return findings;
}

function buildArguments(analysis, context) {
  const args = [
    '--formatter',
    'plain',
    '--codes',
    '--ranges',
    '--no-color',
    '-q',
    '--no-default-config',
    '--std',
    context.config.luacheck.std
  ];

  for (const pattern of context.config.luacheck.ignore) {
    args.push('--ignore', pattern);
  }

  for (const pattern of context.config.luacheck.only) {
    args.push('--only', pattern);
  }

  for (const globalName of collectReadGlobals(analysis, context)) {
    args.push('--read-globals', globalName);
  }

  for (const globalName of collectMutableGlobals(analysis, context)) {
    args.push('--globals', globalName);
  }

  args.push('--filename', analysis.relativePath, '-');
  return args;
}

function collectReadGlobals(analysis, context) {
  const runtimeGlobals = getRuntimeGlobals(analysis, context);
  const globals = new Set([
    ...runtimeGlobals.read,
    ...(FRAMEWORK_GLOBALS[context.config.framework || 'standalone'] || []),
    ...context.config.luacheck.extraGlobals
  ]);

  for (const call of analysis.calls) {
    if (context.catalog.natives.has(normalizeNativeName(call.name))) {
      globals.add(call.name);
    }
  }

  return [...globals]
    .filter(isValidGlobalName)
    .sort((left, right) => left.localeCompare(right));
}

function collectMutableGlobals(analysis, context) {
  return [...getRuntimeGlobals(analysis, context).mutable]
    .filter(isValidGlobalName)
    .sort((left, right) => left.localeCompare(right));
}

function getRuntimeGlobals(analysis, context) {
  return context.catalog.runtimeGlobals?.[analysis.kind]
    || context.catalog.runtimeGlobals?.unknown
    || { read: [], mutable: [] };
}

function isValidGlobalName(value) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function parseOutput(output, fallbackFile) {
  const findings = [];

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const match = line.match(OUTPUT_PATTERN);
    if (!match) {
      continue;
    }

    const [, filePath, lineNumber, startColumn, endColumn, code = '', message] = match;
    const normalizedMessage = message.trim();
    findings.push({
      ruleId: 'luacheck',
      severity: code.startsWith('E') || code === '' ? 'error' : 'warn',
      file: normalizeOutputPath(filePath || fallbackFile),
      line: Number(lineNumber),
      column: Number(startColumn),
      endLine: Number(lineNumber),
      endColumn: endColumn ? Number(endColumn) : Number(startColumn),
      message: code ? `[${code}] ${normalizedMessage}` : normalizedMessage,
      suggestion: buildSuggestion(normalizedMessage)
    });
  }

  return findings;
}

function normalizeOutputPath(filePath) {
  return String(filePath || '')
    .replace(/^\.\//, '')
    .replace(/\\/g, '/');
}

function buildSuggestion(message) {
  if (/undefined variable|setting non-standard global variable/i.test(message)) {
    return 'If this symbol is a real FiveM, framework, or project global, add it to luacheck.extraGlobals or your .luacheckrc. Otherwise define or import it before use.';
  }

  if (/unused/i.test(message)) {
    return 'Remove the unused variable, argument, or assignment, or rename intentionally unused locals with a leading underscore.';
  }

  if (/expected |syntax error|parse error/i.test(message)) {
    return 'Fix the Lua syntax error before relying on the FiveM-specific validator output.';
  }

  return null;
}

function runProcess(command, args, input, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({
        exitCode: Number.isInteger(exitCode) ? exitCode : 1,
        stdout,
        stderr
      });
    });

    child.stdin.end(input);
  });
}