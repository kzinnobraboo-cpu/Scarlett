export const PROFILES = Object.freeze({
  turbo: { label: 'TURBO', num_ctx: 2048, num_predict: 512, historyChars: 1800, turns: 4 },
  balanced: { label: 'EQUILIBRADO', num_ctx: 4096, num_predict: 1536, historyChars: 6500, turns: 12 },
  quality: { label: 'COMPLETO', num_ctx: 8192, num_predict: 4096, historyChars: 14000, turns: 20 }
});
export function profileFor(value = 'turbo') {
  const key = typeof value === 'boolean' ? (value ? 'balanced' : 'quality') : value;
  if (!Object.hasOwn(PROFILES, key)) throw new Error('Perfil inválido. Use turbo, balanced ou quality.');
  return PROFILES[key];
}
// Keep complete user/assistant pairs; never cut the current request or system prompt.
// Character budgets are approximate, not tokenizer-based limits.
export function contextMessages(system, history, user, profile = 'turbo') {
  const preset = profileFor(profile);
  const selected = [];
  let budget = preset.historyChars;
  for (let i = history.length - 2; i >= 0 && selected.length < preset.turns * 2; i -= 2) {
    const pair = history.slice(i, i + 2);
    if (pair[0]?.role !== 'user' || pair[1]?.role !== 'assistant') continue;
    const size = pair.reduce((n, m) => n + m.content.length, 0);
    if (size > budget) break;
    selected.unshift(...pair); budget -= size;
  }
  return [{ role: 'system', content: system }, ...selected, { role: 'user', content: user }];
}
