import { collectServerEventSecuritySignals } from './helpers/server-events.js';

const DISTANCE_EVENT_PATTERN = /shop|buy|reward|garage|bank|item|mission/i;

export const meta = {
  id: 'net-event-missing-distance-check',
  title: 'Reward-like server event has no visible distance check',
  defaultSeverity: 'warn',
  description: 'Flags common shop/reward style events that mutate state without an obvious coords or distance validation.'
};

export function apply(context) {
  const findings = [];
  for (const signal of collectServerEventSecuritySignals(context)) {
    if (!DISTANCE_EVENT_PATTERN.test(signal.eventName) || signal.hasDistanceCheck) {
      continue;
    }

    findings.push({
      ruleId: meta.id,
      file: signal.analysis.relativePath,
      line: signal.line,
      column: signal.column,
      message: `Event ${signal.eventName} looks reward-related but no obvious distance or coords check was found before ${signal.operationName}().`
    });
  }

  return findings;
}