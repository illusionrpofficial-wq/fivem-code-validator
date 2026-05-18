import { collectServerEventSecuritySignals } from './helpers/server-events.js';

export const meta = {
  id: 'raw-sql-from-client',
  title: 'Client-controlled value reaches a SQL call',
  defaultSeverity: 'high',
  description: 'Flags event handlers where a client-controlled parameter flows into a SQL query or insert call, especially when string concatenation is visible.',
  suggestion: 'Use placeholders and parameter arrays instead of concatenating client-controlled values into SQL.'
};

export function apply(context) {
  const findings = [];

  for (const signal of collectServerEventSecuritySignals(context)) {
    if (signal.category !== 'sql' || signal.clientControlledParams.length === 0) {
      continue;
    }

    findings.push({
      ruleId: meta.id,
      severity: 'high',
      file: signal.analysis.relativePath,
      line: signal.line,
      column: signal.column,
      message: `Event ${signal.eventName} passes client-controlled value(s) ${signal.clientControlledParams.join(', ')} into ${signal.operationName}()${signal.usesStringConcat ? ' via string concatenation' : ''}.`
    });
  }

  return findings;
}