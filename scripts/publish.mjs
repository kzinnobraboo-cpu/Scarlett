import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('../', import.meta.url));
function run(executable, args, { optional = false } = {}) {
  const result = spawnSync(executable, args, { cwd, encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) {
    if (optional) return null;
    throw new Error(result.error?.message || result.stderr || `${executable} falhou (${result.status}).`);
  }
  return result.stdout.trim();
}
try {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const tag = `v${pkg.version}`;
  const label = pkg.version.split('-')[0].split('.').slice(0, 2).join('.');
  const makePublic = process.argv.includes('--public');
  if (run('git', ['status', '--porcelain'])) throw new Error('Há alterações locais. Revise e faça commit antes de publicar.');
  if (run('git', ['branch', '--show-current']) !== 'main') throw new Error('Publique a partir da branch main.');
  if (run('git', ['rev-parse', `${tag}^{commit}`]) !== run('git', ['rev-parse', 'HEAD'])) throw new Error('A tag da versão precisa apontar para o commit atual.');
  run('gh', ['api', 'user', '--jq', '.login']);
  let remote = run('git', ['remote', 'get-url', 'origin'], { optional: true });
  if (!remote) {
    run('gh', ['repo', 'create', 'Scarlett', makePublic ? '--public' : '--private', '--source=.', '--remote=origin', '--description', `Scarlett ${label} — agente local criado por mark.code`]);
    remote = run('git', ['remote', 'get-url', 'origin']);
  }
  const match = remote.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  if (!match) throw new Error('origin não é um repositório reconhecido do GitHub.');
  const repo = match[1];
  const lookup = spawnSync('gh', ['repo', 'view', repo, '--json', 'name'], { cwd, encoding: 'utf8', windowsHide: true });
  if (lookup.error) throw lookup.error;
  if (lookup.status !== 0) {
    if (!/Could not resolve to a Repository|HTTP 404|Not Found/i.test(lookup.stderr)) throw new Error(lookup.stderr || 'Não foi possível verificar o repositório.');
    run('gh', ['repo', 'create', repo, makePublic ? '--public' : '--private', '--description', `Scarlett ${label} — agente local criado por mark.code`]);
  }
  run('git', ['push', 'origin', 'main', tag]);
  if (makePublic) {
    const visibility = run('gh', ['repo', 'view', repo, '--json', 'visibility', '--jq', '.visibility']);
    if (visibility !== 'PUBLIC') run('gh', ['repo', 'edit', repo, '--visibility', 'public', '--accept-visibility-change-consequences']);
    run('gh', ['repo', 'edit', repo, '--description', `Scarlett ${label} — agente local de terminal, personalização e LoRA. Criada por mark.code.`]);
  }
  const exists = run('gh', ['release', 'view', tag, '--repo', repo, '--json', 'tagName'], { optional: true });
  run('gh', ['release', exists ? 'edit' : 'create', tag, '--repo', repo, '--title', `Scarlett ${label} Beta`, '--notes-file', 'RELEASE_NOTES.md', '--prerelease', ...(exists ? [] : ['--verify-tag'])]);
  console.log(`Publicado: https://github.com/${repo}/releases/tag/${tag}`);
} catch (error) {
  console.error(`Publicação não concluída: ${error.message.trim()}`);
  process.exitCode = 1;
}
