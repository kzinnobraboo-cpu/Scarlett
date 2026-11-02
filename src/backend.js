import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { clean } from './core.js';

export async function ensureBackend(api, { launch = startServer, sleep = ms => new Promise(r => setTimeout(r, ms)), attempts = 24 } = {}) {
  try { return await api.models(); } catch {}
  const child = await launch(api.host);
  for (let i = 0; i < attempts; i++) {
    if (child.failure) throw new Error(child.failure.code === 'ENOENT' ? 'Ollama não instalado. Instale em ollama.com/download e abra Scarlett novamente.' : `Não foi possível iniciar Ollama: ${child.failure.message}`);
    if (child.exitCode != null) break;
    await sleep(250);
    try { return await api.models(); } catch {}
  }
  throw new Error('Ollama não respondeu. Abra outro terminal e execute: ollama serve. Depois use /connect. Se aparecer “operation not permitted”, este ambiente bloqueia sockets; abra Scarlett no terminal normal do sistema.');
}
function startServer(host) {
  const child = spawn('ollama', ['serve'], { detached: true, windowsHide: true, stdio: 'ignore', env: { ...process.env, OLLAMA_HOST: host } });
  child.on('error', error => { child.failure = error; });
  child.unref();
  return child;
}
export async function setupModel(api, onProgress, signal) {
  await runOllama(['pull', 'qwen2.5:3b'], onProgress, signal, api.host);
  const path = fileURLToPath(new URL('../Modelfile', import.meta.url));
  await readFile(path);
  await runOllama(['create', 'scarlett', '-f', path], onProgress, signal, api.host);
}
function runOllama(args, onProgress, signal, host) {
  return new Promise((resolve, reject) => {
    const child = spawn('ollama', args, { signal, windowsHide: true, env: { ...process.env, OLLAMA_HOST: host }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', data => onProgress(clean(data.toString()).trim()));
    child.stderr.on('data', data => onProgress(clean(data.toString()).trim()));
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`ollama ${args[0]} terminou com código ${code}. Use /setup para tentar novamente.`)));
  });
}
