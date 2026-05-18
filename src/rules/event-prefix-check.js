const BUILTIN_EVENTS = new Set([
  'onClientResourceStart',
  'onClientResourceStop',
  'onResourceStart',
  'onResourceStop',
  'playerConnecting',
  'playerDropped'
]);

export const meta = {
  id: 'event-prefix-check',
  title: 'Custom event name should use the configured prefix',
  defaultSeverity: 'warn',
  description: 'Ensures custom network events use a repo-level prefix such as myresource:.'
};

export function apply(context) {
  if (!context.config.eventPrefix) {
    return [];
  }

  const findings = [];

  for (const analysis of context.scriptAnalyses) {
    for (const event of analysis.networkEvents) {
      if (BUILTIN_EVENTS.has(event.name) || event.name.startsWith('__cfx_')) {
        continue;
      }

      if (!event.name.startsWith(context.config.eventPrefix)) {
        findings.push({
          ruleId: meta.id,
          file: analysis.relativePath,
          line: event.line,
          column: event.column,
          message: `Event ${event.name} should start with ${context.config.eventPrefix}.`
        });
      }
    }
  }

  return findings;
}