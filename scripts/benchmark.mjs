import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { Ollama } from '../src/core.js';
import { profileFor } from '../src/profiles.js';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('node scripts/benchmark.mjs --model scarlett:turbo --profile turbo --runs 3 [--output resultado.json]');
  process.exit(0);
}
const get = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const model = get('--model', process.env.SCARLETT_MODEL || 'scarlett:turbo');
const profile = get('--profile', 'turbo'), runs = Number(get('--runs', '3'));
profileFor(profile);
if (!Number.isInteger(runs) || runs < 1 || runs > 20) throw new Error('Use de 1 a 20 repetições.');
const api = new Ollama(), results = [];
console.error(`Pré-carregando ${model}. O benchmark mede gerações após warmup, sem afirmar latência a frio.`);
await api.warmup(model, AbortSignal.timeout(180000), profile);
for (let i = 0; i < runs; i++) {
  const start = performance.now();
  let first, stats;
  for await (const event of api.chat(model, [{ role: 'user', content: 'Explique em português como listar processos no Linux. Seja breve.' }], AbortSignal.timeout(180000), profile)) {
    if (event.message?.content) first ??= performance.now();
    if (event.done) stats = event;
  }
  if (!stats || !first) throw new Error('Backend não forneceu resposta completa.');
  results.push({ first_token_ms: first - start, total_ms: performance.now() - start, tokens: stats.eval_count || 0, tokens_per_second: stats.eval_duration > 0 ? stats.eval_count / (stats.eval_duration / 1e9) : null });
  console.error(`Repetição ${i + 1}/${runs} concluída.`);
}
const report = { version: '1.3', measured_at: new Date().toISOString(), model, profile, warm: true, platform: process.platform, arch: process.arch, node: process.version, results };
const json = JSON.stringify(report, null, 2);
console.log(json);
const output = get('--output');
if (output) await writeFile(output, json + '\n', { flag: 'wx' });
