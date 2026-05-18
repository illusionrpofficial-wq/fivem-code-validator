import { normalizeNativeName } from '../natives.js';

export const meta = {
  id: 'native-arg-count',
  title: 'Native call argument count looks suspicious',
  defaultSeverity: 'warn',
  description: 'Uses a curated native catalog to spot obviously wrong argument counts without trying to fully interpret wrappers.'
};

export function apply(context) {
  const findings = [];

  for (const analysis of context.scriptAnalyses) {
    for (const call of analysis.calls) {
      const native = context.catalog.natives.get(normalizeNativeName(call.name));
      if (!native || !native.enforceArgCount) {
        continue;
      }

      if (typeof native.minArgs !== 'number' || typeof native.maxArgs !== 'number') {
        continue;
      }

      if (call.argCount < native.minArgs || call.argCount > native.maxArgs) {
        findings.push({
          ruleId: meta.id,
          file: analysis.relativePath,
          line: call.line,
          column: call.column,
          message: `${call.name}() argument count looks suspicious. Expected ${formatExpectedRange(native.minArgs, native.maxArgs)}, found ${call.argCount}.`
        });
      }
    }
  }

  return findings;
}

function formatExpectedRange(minArgs, maxArgs) {
  return minArgs === maxArgs ? String(minArgs) : `${minArgs}-${maxArgs}`;
}