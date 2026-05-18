import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { validateResource } from '../src/engine.js';
import { runCli } from '../src/index.js';

const fixturePath = path.resolve('tests/fixtures/basic-resource');
const invalidConfigFixturePath = path.resolve('tests/fixtures/invalid-config-resource');
const luacheckFixturePath = path.resolve('tests/fixtures/luacheck-resource');
const suppressionFixturePath = path.resolve('tests/fixtures/suppression-resource');
const warnOnlyFixturePath = path.resolve('tests/fixtures/warn-only-resource');

test('validateResource detects core FiveM findings with a canonical finding shape', async () => {
  const result = await validateResource(fixturePath, { disableRemoteNatives: true });
  const ruleIds = new Set(result.findings.map((finding) => finding.ruleId));

  for (const ruleId of [
    'manifest-files-check',
    'native-side-check',
    'native-arg-count',
    'no-loop-without-wait',
    'event-prefix-check',
    'sql-injection-check',
    'debug-output-check',
    'client-controlled-money',
    'client-controlled-item',
    'missing-source-validation',
    'net-event-player-validation',
    'net-event-missing-cooldown',
    'missing-job-check',
    'raw-sql-from-client',
    'manifest-missing-dependency',
    'manifest-export-check',
    'nui-callback-check',
    'nui-innerhtml-check'
  ]) {
    assert.ok(ruleIds.has(ruleId), `Expected finding for ${ruleId}`);
  }

  assert.equal(result.stats.failed, true);
  assert.ok(result.stats.totalFindings >= 10);
  assert.ok(result.findings.every((finding) => Object.hasOwn(finding, 'suggestion')));
  assert.ok(result.findings.every((finding) => typeof finding.fingerprint === 'string'));
  assert.ok(result.findings.every((finding) => typeof finding.lineHash === 'string'));
});

test('CLI writes SARIF and stats files', async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'fivem-validator-'));
  const sarifPath = path.join(tempDirectory, 'fivem-check.sarif');
  const statsPath = path.join(tempDirectory, 'fivem-check.stats.json');
  const { stdout, result: exitCode } = await captureOutput(async () => runCli([
    fixturePath,
    '--format',
    'json',
    '--sarif',
    sarifPath,
    '--stats-file',
    statsPath,
    '--no-remote-natives'
  ]));

  assert.equal(exitCode, 1);

  const sarif = JSON.parse(await readFile(sarifPath, 'utf8'));
  const stats = JSON.parse(await readFile(statsPath, 'utf8'));
  const output = JSON.parse(stdout);

  assert.equal(sarif.version, '2.1.0');
  assert.ok(Array.isArray(sarif.runs[0].results));
  assert.equal(stats.stats.failed, true);
  assert.equal(output.stats.failed, true);
});

test('invalid config is rejected with explicit validation messages', async () => {
  const { stderr, result: exitCode } = await captureOutput(async () => runCli([
    invalidConfigFixturePath,
    '--no-remote-natives'
  ]));

  assert.equal(exitCode, 2);
  assert.match(stderr, /Invalid config:/);
  assert.match(stderr, /framework must be one of: esx, qbcore, qbox, standalone/);
  assert.match(stderr, /rules\.native-side-check must be one of: off, info, warn, error, high/);
});

test('ignore globs and inline suppressions remove noisy findings', async () => {
  const result = await validateResource(suppressionFixturePath, { disableRemoteNatives: true });

  assert.equal(result.findings.length, 0);
  assert.equal(result.stats.suppressedFindings, 2);
  assert.equal(result.stats.ignoredFiles, 1);
});

test('fail-on warn treats warnings as blocking', async () => {
  const defaultExitCode = await runCli([warnOnlyFixturePath, '--no-remote-natives']);
  const warnExitCode = await runCli([warnOnlyFixturePath, '--no-remote-natives', '--fail-on', 'warn']);

  assert.equal(defaultExitCode, 0);
  assert.equal(warnExitCode, 1);
});

test('baseline mode writes and later suppresses existing findings', async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'fivem-validator-baseline-'));
  const resourcePath = path.join(tempDirectory, 'resource');
  await cp(fixturePath, resourcePath, { recursive: true });

  const baselineExitCode = await runCli([resourcePath, '--write-baseline', '--no-remote-natives']);
  assert.equal(baselineExitCode, 0);

  const baselinePath = path.join(resourcePath, '.fivemcheck-baseline.json');
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
  assert.ok(Array.isArray(baseline.ignoredFindings));
  assert.ok(baseline.ignoredFindings.length > 0);

  const { stdout, result: exitCode } = await captureOutput(async () => runCli([
    resourcePath,
    '--format',
    'json',
    '--no-remote-natives'
  ]));

  assert.equal(exitCode, 0);

  const output = JSON.parse(stdout);
  assert.equal(output.findings.length, 0);
  assert.ok(output.stats.baselinedFindings > 0);
});

test('luacheck integration whitelists native calls discovered from the native catalog', async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'fivem-validator-luacheck-'));
  const fakeScriptPath = path.join(tempDirectory, 'fake-luacheck.js');

  await writeFile(fakeScriptPath, [
    '#!/usr/bin/env node',
    "const args = process.argv.slice(2);",
    "const filenameIndex = args.indexOf('--filename');",
    "const filePath = filenameIndex === -1 ? 'stdin.lua' : args[filenameIndex + 1];",
    'const allowedGlobals = new Set();',
    'for (let index = 0; index < args.length; index += 1) {',
    "  if (args[index] === '--read-globals' || args[index] === '--globals') {",
    '    allowedGlobals.add(args[index + 1]);',
    '    index += 1;',
    '  }',
    '}',
    "if (!allowedGlobals.has('PlayerPedId')) {",
    "  process.stdout.write(`${filePath}:1:1-11: (W113) accessing undefined variable PlayerPedId\\n`);",
    '}',
    "process.stdout.write(`${filePath}:2:1-19: (W113) accessing undefined variable SomeMissingFunction\\n`);",
    'process.exit(1);',
    ''
  ].join('\n'), 'utf8');

  const result = await validateResource(luacheckFixturePath, {
    disableRemoteNatives: true,
    luacheck: true,
    luacheckBinary: process.execPath,
    luacheckArgs: [fakeScriptPath]
  });

  const luacheckFindings = result.findings.filter((finding) => finding.ruleId === 'luacheck');
  assert.equal(luacheckFindings.length, 1);
  assert.match(luacheckFindings[0].message, /SomeMissingFunction/);
  assert.doesNotMatch(luacheckFindings[0].message, /PlayerPedId/);
});

test('luacheck integration whitelists runtime globals from the bundled Lua docs catalog', async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'fivem-validator-runtime-globals-'));
  const fakeScriptPath = path.join(tempDirectory, 'fake-luacheck.js');

  await writeFile(path.join(tempDirectory, 'fxmanifest.lua'), [
    "fx_version 'cerulean'",
    "game 'gta5'",
    "client_script 'client.lua'",
    ''
  ].join('\n'), 'utf8');

  await writeFile(path.join(tempDirectory, 'client.lua'), [
    'CreateThread(function()',
    '  Wait(0)',
    'end)',
    ''
  ].join('\n'), 'utf8');

  await writeFile(fakeScriptPath, [
    '#!/usr/bin/env node',
    'const args = process.argv.slice(2);',
    "const filenameIndex = args.indexOf('--filename');",
    "const filePath = filenameIndex === -1 ? 'stdin.lua' : args[filenameIndex + 1];",
    'const allowedGlobals = new Set();',
    'for (let index = 0; index < args.length; index += 1) {',
    "  if (args[index] === '--read-globals' || args[index] === '--globals') {",
    '    allowedGlobals.add(args[index + 1]);',
    '    index += 1;',
    '  }',
    '}',
    "if (!allowedGlobals.has('CreateThread')) {",
    "  process.stdout.write(`${filePath}:1:1-12: (W113) accessing undefined variable CreateThread\\n`);",
    '}',
    "if (!allowedGlobals.has('Wait')) {",
    "  process.stdout.write(`${filePath}:2:3-6: (W113) accessing undefined variable Wait\\n`);",
    '}',
    'process.exit(1);',
    ''
  ].join('\n'), 'utf8');

  const result = await validateResource(tempDirectory, {
    disableRemoteNatives: true,
    luacheck: true,
    luacheckBinary: process.execPath,
    luacheckArgs: [fakeScriptPath]
  });

  const luacheckFindings = result.findings.filter((finding) => finding.ruleId === 'luacheck');
  assert.equal(luacheckFindings.length, 0);
});

async function captureOutput(callback) {
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  let stdout = '';
  let stderr = '';

  process.stdout.write = (chunk, encoding, callbackWrite) => {
    stdout += String(chunk);
    if (typeof callbackWrite === 'function') {
      callbackWrite();
    }
    return true;
  };

  process.stderr.write = (chunk, encoding, callbackWrite) => {
    stderr += String(chunk);
    if (typeof callbackWrite === 'function') {
      callbackWrite();
    }
    return true;
  };

  try {
    const result = await callback();
    return { stdout, stderr, result };
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
}