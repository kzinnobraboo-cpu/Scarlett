import { open, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { validateSession, clean } from './core.js';

export async function exportExamples(messages, path) {
  const valid = validateSession(messages);
  if (!valid.length || valid.length % 2 || valid.some((m, i) => m.role !== (i % 2 ? 'assistant' : 'user') || !m.content.trim())) throw new Error('Converse com Scarlett antes de exportar. São necessários pares user/assistant completos.');
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  // Keep the whole conversation: follow-up answers depend on earlier context.
  const file = await open(target, 'a+', 0o600);
  try {
    const { size } = await file.stat();
    const last = Buffer.alloc(1);
    if (size) await file.read(last, 0, 1, size - 1);
    const prefix = size && last[0] !== 10 ? '\n' : '';
    await file.write(prefix + JSON.stringify({ messages: valid }) + '\n');
  } finally { await file.close(); }
  return { target, count: 1 };
}
export function trainingTask(dataset, validateOnly = false) {
  const executable = process.env.SCARLETT_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  const script = fileURLToPath(new URL('../training/train.py', import.meta.url));
  const args = ['-u', script, '--data', resolve(dataset)];
  if (validateOnly) args.push('--validate-only');
  else args.push('--model', process.env.SCARLETT_TRAIN_MODEL || 'Qwen/Qwen2.5-0.5B-Instruct', '--output', resolve('training/output', new Date().toISOString().replace(/[:.]/g, '-')), '--merge');
  return { executable, args };
}
export function runTraining(task, onOutput, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(task.executable, task.args, { signal, windowsHide: true, env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', text => onOutput(clean(text)));
    child.stderr.on('data', text => onOutput(clean(text)));
    child.on('error', error => reject(new Error(error.code === 'ENOENT' ? 'Python não encontrado. Configure SCARLETT_PYTHON para o Python do seu ambiente de treinamento.' : error.message)));
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`Python terminou com código ${code}. Consulte a saída acima.`)));
  });
}
