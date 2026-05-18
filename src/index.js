import path from 'node:path';

import { writeBaselineFile } from './baseline.js';
import { validateResource } from './engine.js';
import { normalizeFailOn } from './findings.js';
import { printJsonReport, printTextReport, writeOptionalOutputs } from './output.js';

export async function runCli(args = []) {
  try {
    const options = parseArgs(args);

    if (options.help) {
      printHelp();
      return 0;
    }

    const result = await validateResource(path.resolve(process.cwd(), options.resourcePath), options);

    if (options.writeBaseline) {
      const baselinePath = await writeBaselineFile(result.baselineCandidates, result.baseline.path);
      if (options.format === 'json') {
        process.stdout.write(`${JSON.stringify({
          baselinePath,
          ignoredFindings: result.baselineCandidates.length
        }, null, 2)}\n`);
      } else {
        process.stdout.write(`Wrote baseline with ${result.baselineCandidates.length} findings to ${baselinePath}\n`);
      }

      return 0;
    }

    if (options.format === 'json') {
      printJsonReport(result);
    } else {
      printTextReport(result, options);
    }

    await writeOptionalOutputs(result, options);
    return result.exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`FiveM checker failed: ${message}\n`);
    return 2;
  }
}

function parseArgs(args) {
  const options = {
    resourcePath: '.',
    format: 'text',
    help: false,
    configPath: null,
    sarifPath: null,
    statsFilePath: null,
    baselinePath: null,
    failOn: 'error',
    noColor: false,
    writeBaseline: false,
    offline: false,
    disableRemoteNatives: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith('-') && options.resourcePath === '.') {
      options.resourcePath = arg;
      continue;
    }

    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--config':
        options.configPath = requireValue(args, ++index, arg);
        break;
      case '--sarif':
        options.sarifPath = requireValue(args, ++index, arg);
        break;
      case '--stats-file':
        options.statsFilePath = requireValue(args, ++index, arg);
        break;
      case '--baseline':
        options.baselinePath = requireValue(args, ++index, arg);
        break;
      case '--write-baseline':
        options.writeBaseline = true;
        if (index + 1 < args.length && !args[index + 1].startsWith('-')) {
          options.baselinePath = args[++index];
        }
        break;
      case '--fail-on': {
        const failOn = normalizeFailOn(requireValue(args, ++index, arg));
        if (!failOn) {
          throw new Error('Unsupported value for --fail-on. Use one of: off, info, warn, error, high');
        }

        options.failOn = failOn;
        break;
      }
      case '--format':
        options.format = requireValue(args, ++index, arg);
        if (!['text', 'json'].includes(options.format)) {
          throw new Error(`Unsupported format: ${options.format}`);
        }
        break;
      case '--offline':
        options.offline = true;
        break;
      case '--no-color':
        options.noColor = true;
        break;
      case '--no-remote-natives':
        options.disableRemoteNatives = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function requireValue(args, index, flag) {
  if (index >= args.length) {
    throw new Error(`Missing value for ${flag}`);
  }

  return args[index];
}

function printHelp() {
  process.stdout.write([
    'fivem-check <resource-path>',
    '',
    'Options:',
    '  --config <path>         Override .fivemcheck.json path',
    '  --sarif <path>          Write SARIF output',
    '  --stats-file <path>     Write JSON stats',
    '  --baseline <path>       Override baseline file path',
    '  --write-baseline [path] Write a baseline file and exit successfully',
    '  --fail-on <level>       Fail on info, warn, error, or high',
    '  --format <text|json>    Select console output format',
    '  --offline               Skip remote native refresh',
    '  --no-color              Disable ANSI colors in text output',
    '  --no-remote-natives     Only use the bundled native catalog',
    '  --help                  Show this help',
    ''
  ].join('\n'));
}