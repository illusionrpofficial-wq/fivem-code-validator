import { collectServerEventSecuritySignals } from './helpers/server-events.js';

const JOB_EVENT_PATTERN = /job|boss|duty|salary|grade|society/i;

export const meta = {
  id: 'missing-job-check',
  title: 'Job-related server event has no visible job or permission check',
  defaultSeverity: 'warn',
  description: 'Flags job-like or role-changing events that perform sensitive actions without an obvious job or permission guard.',
  suggestion: 'Check the player job, group, ACE permission, or framework permission helper before applying the action.'
};

export function apply(context) {
  const findings = [];

  for (const signal of collectServerEventSecuritySignals(context)) {
    if ((!JOB_EVENT_PATTERN.test(signal.eventName) && signal.category !== 'job') || signal.hasJobCheck) {
      continue;
    }

    findings.push({
      ruleId: meta.id,
      file: signal.analysis.relativePath,
      line: signal.line,
      column: signal.column,
      message: `Event ${signal.eventName} looks job-related but no visible job or permission check was found before ${signal.operationName}().`
    });
  }

  return findings;
}