export const meta = {
  id: 'nui-callback-check',
  title: 'NUI callback forwards raw data to a server event',
  defaultSeverity: 'warn',
  description: 'Flags RegisterNUICallback handlers that pass data.* directly into TriggerServerEvent.'
};

export function apply(context) {
  const findings = [];

  for (const analysis of context.scriptAnalyses) {
    if (analysis.language !== 'lua') {
      continue;
    }

    for (const callback of analysis.nuiCallbacks) {
      const triggerPattern = /TriggerServerEvent\s*\(([^)]*\bdata\.[A-Za-z_][A-Za-z0-9_]*[^)]*)\)/g;
      for (const match of callback.body.matchAll(triggerPattern)) {
        const location = analysis.locate(callback.bodyStartIndex + match.index);
        findings.push({
          ruleId: meta.id,
          file: analysis.relativePath,
          line: location.line,
          column: location.column,
          message: `NUI callback ${callback.name} forwards data.* directly into TriggerServerEvent(). Validate it on the server.`
        });
      }
    }
  }

  return findings;
}