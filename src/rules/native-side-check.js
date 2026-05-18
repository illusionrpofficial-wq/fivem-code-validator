import { normalizeNativeName } from '../natives.js';

export const meta = {
  id: 'native-side-check',
  title: 'Native is used from the wrong side',
  defaultSeverity: 'error',
  description: 'Checks curated client/server/all native metadata against the manifest side of each script.'
};

export function apply(context) {
  const findings = [];

  for (const analysis of context.scriptAnalyses) {
    if (!['client', 'server', 'shared'].includes(analysis.kind)) {
      continue;
    }

    for (const call of analysis.calls) {
      const native = context.catalog.natives.get(normalizeNativeName(call.name));
      if (!native || native.apiset === 'unknown') {
        continue;
      }

      if (analysis.kind === 'server' && native.apiset === 'client') {
        findings.push({
          ruleId: meta.id,
          file: analysis.relativePath,
          line: call.line,
          column: call.column,
          message: `${call.name}() is client-only but is used in a server script.`
        });
      }

      if (analysis.kind === 'client' && native.apiset === 'server') {
        findings.push({
          ruleId: meta.id,
          file: analysis.relativePath,
          line: call.line,
          column: call.column,
          message: `${call.name}() is server-only but is used in a client script.`
        });
      }

      if (analysis.kind === 'shared' && native.apiset !== 'all') {
        findings.push({
          ruleId: meta.id,
          severity: 'warn',
          file: analysis.relativePath,
          line: call.line,
          column: call.column,
          message: `${call.name}() is marked ${native.apiset} and may be unsafe inside a shared script.`
        });
      }
    }
  }

  return findings;
}