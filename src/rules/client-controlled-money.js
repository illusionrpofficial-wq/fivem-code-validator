import { collectServerEventSecuritySignals } from './helpers/server-events.js';

export const meta = {
  id: 'client-controlled-money',
  title: 'Client-controlled reward input reaches a sensitive operation',
  defaultSeverity: 'high',
  description: 'Flags server event handlers that pass event parameters directly into money, inventory, or reward operations.'
};

export function apply(context) {
  const findings = [];
  for (const signal of collectServerEventSecuritySignals(context)) {
    if (signal.category !== 'money' || signal.clientControlledParams.length === 0) {
      continue;
    }

    findings.push({
      ruleId: meta.id,
      severity: 'high',
      file: signal.analysis.relativePath,
      line: signal.line,
      column: signal.column,
      message: `Event ${signal.eventName} passes client-controlled value(s) ${signal.clientControlledParams.join(', ')} into ${signal.operationName}().`,
      suggestion: 'Validate reward amounts server-side before changing player money.'
    });
  }

  return findings;
}