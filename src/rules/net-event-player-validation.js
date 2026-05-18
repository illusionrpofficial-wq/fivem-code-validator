import { collectServerEventSecuritySignals } from './helpers/server-events.js';

export const meta = {
  id: 'net-event-player-validation',
  title: 'Server event has no visible player validation',
  defaultSeverity: 'warn',
  description: 'Flags sensitive server event handlers that do not show a player lookup or early-return validation pattern.'
};

export function apply(context) {
  const findings = [];
  for (const signal of collectServerEventSecuritySignals(context)) {
    if (signal.hasPlayerValidation) {
      continue;
    }

    findings.push({
      ruleId: meta.id,
      file: signal.analysis.relativePath,
      line: signal.line,
      column: signal.column,
      message: `Event ${signal.eventName} performs ${signal.operationName}() without a visible player validation pattern.`
    });
  }

  return findings;
}