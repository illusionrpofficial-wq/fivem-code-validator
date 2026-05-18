export const meta = {
  id: 'nui-innerhtml-check',
  title: 'innerHTML assignment may allow XSS in NUI',
  defaultSeverity: 'warn',
  description: 'Warns when innerHTML is assigned from a non-literal expression in web assets.'
};

export function apply(context) {
  const findings = [];

  for (const analysis of context.analyses) {
    if (!['javascript', 'html'].includes(analysis.language)) {
      continue;
    }

    const pattern = /\.innerHTML\s*=\s*([^;\n]+)/g;
    for (const match of analysis.content.matchAll(pattern)) {
      const expression = match[1].trim();
      if (/^(['\"]).*\1$/.test(expression)) {
        continue;
      }

      const location = analysis.locate(match.index);
      findings.push({
        ruleId: meta.id,
        file: analysis.relativePath,
        line: location.line,
        column: location.column,
        message: 'innerHTML is assigned from a dynamic value. Prefer textContent or explicit sanitization.'
      });
    }
  }

  return findings;
}