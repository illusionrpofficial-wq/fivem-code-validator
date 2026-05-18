export const meta = {
  id: 'manifest-missing-dependency',
  title: 'Used export should be declared as a dependency',
  defaultSeverity: 'warn',
  description: 'Warns when a resource export is used in code without a matching manifest dependency entry.'
};

export function apply(context) {
  if (!context.manifest.exists) {
    return [];
  }

  const declaredDependencies = new Set(context.manifest.dependencies);
  const findings = [];

  for (const analysis of context.scriptAnalyses) {
    for (const usage of analysis.exportsUsed) {
      if (declaredDependencies.has(usage.resourceName)) {
        continue;
      }

      findings.push({
        ruleId: meta.id,
        file: analysis.relativePath,
        line: usage.line,
        column: usage.column,
        message: `Export from ${usage.resourceName} is used without declaring dependency ${usage.resourceName} in fxmanifest.lua.`
      });
    }

    if (/\blib\.callback(?:\.register)?\b/.test(analysis.strippedContent) && !declaredDependencies.has('ox_lib')) {
      findings.push({
        ruleId: meta.id,
        file: analysis.relativePath,
        line: 1,
        column: 1,
        message: 'dependency ox_lib missing while lib.callback is used.'
      });
    }
  }

  return dedupeFindings(findings);
}

function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    const key = `${finding.file}:${finding.line}:${finding.ruleId}:${finding.message}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}