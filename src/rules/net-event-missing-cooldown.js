import { collectServerEventSecuritySignals } from './helpers/server-events.js';

export const meta = {
  id: 'net-event-missing-cooldown',
  title: 'Reward-like server event has no visible cooldown or rate limit',
  defaultSeverity: 'warn',
  description: 'Flags server events that perform sensitive operations without an obvious cooldown or rate-limit guard.'
};

export function apply(context) {
  const findings = [];
  for (const signal of collectServerEventSecuritySignals(context)) {
    if (signal.hasCooldown) {
      continue;
    }

    findings.push({
      ruleId: meta.id,
      file: signal.analysis.relativePath,
      line: signal.line,
      column: signal.column,
      message: `Event ${signal.eventName} performs ${signal.operationName}() without an obvious cooldown or rate-limit pattern.`
    });
  }

  return findings;
}