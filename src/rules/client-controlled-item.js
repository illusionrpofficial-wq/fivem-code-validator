import { collectServerEventSecuritySignals } from './helpers/server-events.js';

export const meta = {
  id: 'client-controlled-item',
  title: 'Client-controlled item input reaches a sensitive operation',
  defaultSeverity: 'high',
  description: 'Flags server event handlers that pass client parameters directly into item, inventory, or weapon operations.',
  suggestion: 'Whitelist item names and counts on the server before granting inventory or weapons.'
};

export function apply(context) {
  const findings = [];
  for (const signal of collectServerEventSecuritySignals(context)) {
    if (signal.category !== 'item' || signal.clientControlledParams.length === 0) {
      continue;
    }

    findings.push({
      ruleId: meta.id,
      severity: 'high',
      file: signal.analysis.relativePath,
      line: signal.line,
      column: signal.column,
      message: `Event ${signal.eventName} passes client-controlled value(s) ${signal.clientControlledParams.join(', ')} into ${signal.operationName}().`
    });
  }

  return findings;
}