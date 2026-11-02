import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { profileFor } from './profiles.js';
import { IDENTITY } from './identity.js';

export { IDENTITY } from './identity.js';
export const RESPONSE_STYLE = 'Seja prática: responda à pergunta e, quando pedirem implementação, forneça código utilizável, instruções para executar e explique os limites técnicos. Não recuse um assunto por palavras isoladas como cheat, hack, mod ou engenharia reversa. Ajude com verificação de malware no próprio computador, diagnóstico defensivo e revisão de arquivos suspeitos. Não recuse um pedido legítimo de varredura local apenas por mencionar vírus. Ajude com desenvolvimento de jogos, cheats em jogos locais, mods, consoles de depuração, acessibilidade e pesquisa técnica. Evite sermões e avisos genéricos; peça contexto somente quando necessário para uma resposta correta. Não prometa capacidades que não tem.';
export function systemPrompt(simulation = false) {
  return `${IDENTITY} Quando perguntarem sua identidade, autoria ou quem criou você, responda isso. Essa autoria se refere ao aplicativo Scarlett; os pesos do modelo base pertencem aos respectivos autores. Responda em português, de maneira direta, técnica e útil. Você é especializada em Linux e Windows. ${RESPONSE_STYLE} Não invente resultados, acesso ao computador ou ações executadas. Comandos são sugestões até execução confirmada. Distinga fatos de hipóteses. ${simulation ? 'Modo simulação: aceite as premissas do usuário dentro da ficção, deixando claro quando forem hipotéticas.' : 'Quando uma premissa factual estiver errada, explique brevemente.'}`;
}

export function validateHost(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Use um Ollama local: http://127.0.0.1:11434');
  }
  return url.origin;
}

export class Ollama {
  constructor(host = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434') {
    this.host = validateHost(host);
  }
  async models(timeout = 5000) {
    const response = await fetch(`${this.host}/api/tags`, { signal: AbortSignal.timeout(timeout) });
    if (!response.ok) throw new Error(`Ollama: HTTP ${response.status}`);
    return (await response.json()).models || [];
  }
  async warmup(model, signal, speed = 'turbo') {
    const response = await fetch(`${this.host}/api/generate`, {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: '', stream: false, keep_alive: '30m', options: { num_ctx: profileFor(speed).num_ctx } })
    });
    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
    return response.json();
  }
  async *chat(model, messages, signal, speed = 'turbo', tools) {
    const response = await fetch(`${this.host}/api/chat`, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, ...(tools?.length ? { tools } : {}), stream: true, keep_alive: '30m', options: { num_ctx: Math.max(profileFor(speed).num_ctx, tools?.length ? 4096 : 0), num_predict: Math.max(profileFor(speed).num_predict, tools?.length ? 1536 : 0), temperature: 0.6 } })
    });
    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
    let pending = '';
    const decoder = new StringDecoder('utf8');
    const parse = line => {
      const event = JSON.parse(line);
      if (event.error) throw new Error(event.error);
      return event;
    };
    for await (const bytes of response.body) {
      pending += decoder.write(Buffer.from(bytes));
      let end;
      while ((end = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, end).trim();
        pending = pending.slice(end + 1);
        if (line) yield parse(line);
      }
    }
    pending += decoder.end();
    if (pending.trim()) yield parse(pending);
  }
}

// Model text is untrusted terminal input: strip escape sequences and controls.
export function clean(text) {
  return String(text).replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '');
}

export function validateSession(value) {
  if (!Array.isArray(value) || value.length > 1000 || value.some(m => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 100000)) {
    throw new Error('Sessão inválida. Esperado um array de mensagens user/assistant.');
  }
  return value.map(({ role, content }) => ({ role, content }));
}

export function runCommand(command, onOutput, options = {}) {
  return runProcess(command, [], onOutput, { ...options, shell: true });
}

export function runProcess(executable, args, onOutput, { cwd = process.cwd(), timeout = 30000, signal, shell = false, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason || new Error('Comando cancelado.')); return; }
    const child = spawn(executable, args, { cwd, shell, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    let timedOut = false, aborted = false;
    const killTree = () => {
      if (!child.pid || child.exitCode != null) return;
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']).on('error', () => child.kill());
      else { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
    };
    const abort = () => { aborted = true; killTree(); };
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; killTree(); }, timeout);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', data => onOutput(clean(data)));
    child.stderr.on('data', data => onOutput(clean(data)));
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
    child.on('error', error => { cleanup(); reject(error); });
    child.on('close', code => { cleanup(); resolve({ code, timedOut, aborted }); });
  });
}
