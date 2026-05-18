export const meta = {
  id: 'manifest-export-check',
  title: 'Manifest export should exist in code',
  defaultSeverity: 'warn',
  description: 'Checks that exports declared in fxmanifest.lua are also registered in code.'
};

export function apply(context) {
  const findings = [];
  const clientExports = new Set();
  const serverExports = new Set();

  for (const analysis of context.scriptAnalyses) {
    for (const exportRegistration of analysis.registeredExports) {
      if (analysis.kind === 'server') {
        serverExports.add(exportRegistration.name);
      } else {
        clientExports.add(exportRegistration.name);
      }
    }
  }

  for (const exportName of context.manifest.exports) {
    if (!clientExports.has(exportName)) {
      findings.push({
        ruleId: meta.id,
        file: context.manifest.relativePath,
        line: 1,
        column: 1,
        message: `Manifest export ${exportName} is declared but no matching exports() registration was found in client/shared code.`
      });
    }
  }

  for (const exportName of context.manifest.serverExports) {
    if (!serverExports.has(exportName)) {
      findings.push({
        ruleId: meta.id,
        file: context.manifest.relativePath,
        line: 1,
        column: 1,
        message: `Manifest server export ${exportName} is declared but no matching exports() registration was found in server/shared code.`
      });
    }
  }

  return findings;
}