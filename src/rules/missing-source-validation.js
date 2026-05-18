import { collectServerEventSecuritySignals } from './helpers/server-events.js';

export const meta = {
  id: 'missing-source-validation',
  title: 'Sensitive server event does not reference or validate source',
  defaultSeverity: 'warn',
  description: 'Flags sensitive server callbacks that mutate state without any visible use or validation of the caller source.',
  suggestion: 'Use source to load and validate the calling player before mutating state.'
};

export function apply(context) {
  const findings = [];

  for (const signal of collectServerEventSecuritySignals(context)) {
    if (signal.hasSourceValidation) {
      continue;
    }

    findings.push({
      ruleId: meta.id,
      file: signal.analysis.relativePath,
      line: signal.line,
      column: signal.column,
      message: `Event ${signal.eventName} performs ${signal.operationName}() without any visible source lookup or validation.`
    });
  }

  return findings;
}