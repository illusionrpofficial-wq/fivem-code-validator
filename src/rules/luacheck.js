export const meta = {
  id: 'luacheck',
  title: 'Luacheck reported a Lua issue',
  defaultSeverity: 'warn',
  description: 'Runs luacheck on Lua source files and merges the results with the FiveM-specific validator. Known FiveM runtime globals from the official Lua docs and native calls used in a file are auto-whitelisted.',
  suggestion: 'Install luacheck and tune luacheck.extraGlobals or your project .luacheckrc when a legitimate runtime global should be allowed.'
};

export function apply() {
  return [];
}