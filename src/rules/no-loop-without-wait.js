export const meta = {
  id: 'no-loop-without-wait',
  title: 'Infinite loop should yield with Wait',
  defaultSeverity: 'error',
  description: 'Flags busy loops and high-frequency server event spam patterns.'
};

export function apply(context) {
  const findings = [];

  for (const analysis of context.scriptAnalyses) {
    for (const loop of analysis.loops) {
      if (!loop.hasWait) {
        findings.push({
          ruleId: meta.id,
          file: analysis.relativePath,
          line: loop.line,
          column: loop.column,
          message: 'Infinite loop has no Wait/Delay call.'
        });
        continue;
      }

      if (loop.waitZero && loop.hasTriggerServerEvent) {
        findings.push({
          ruleId: 'event-loop-spam',
          severity: 'warn',
          file: analysis.relativePath,
          line: loop.line,
          column: loop.column,
          message: 'Loop triggers a server event with Wait(0)/Delay(0), which is prone to spam and high load.'
        });
      }
    }
  }

  return findings;
}