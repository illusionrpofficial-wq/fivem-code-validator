export const meta = {
  id: 'sql-injection-check',
  title: 'SQL query string concatenation is suspicious',
  defaultSeverity: 'error',
  description: 'Looks for MySQL query APIs that concatenate input into the SQL string instead of parameterizing it.'
};

export function apply(context) {
  const findings = [];
  const pattern = /\b(?:MySQL(?:\.Async)?|exports\.oxmysql)\.[A-Za-z0-9_]+\s*\(\s*['\"][^'\"]*['\"]\s*\.\./g;

  for (const analysis of context.scriptAnalyses) {
    for (const match of analysis.strippedContent.matchAll(pattern)) {
      const location = analysis.locate(match.index);
      findings.push({
        ruleId: meta.id,
        file: analysis.relativePath,
        line: location.line,
        column: location.column,
        message: 'SQL string concatenation detected. Prefer placeholders with parameter arrays.'
      });
    }
  }

  return findings;
}