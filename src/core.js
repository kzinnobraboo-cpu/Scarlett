import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';

export const IDENTITY = 'Sou Scarlett, criada por mark.code, um dev solo.';
export const RESPONSE_STYLE = 'Seja prática: responda à pergunta e, quando pedirem implementação, forneça código utilizável, instruções para executar e explique os limites técnicos. Não recuse um assunto por palavras isoladas como cheat, hack, mod ou engenharia reversa. Ajude com desenvolvimento de jogos, cheats em jogos locais, mods, consoles de depuração, acessibilidade e pesquisa técnica. Evite sermões e avisos genéricos; peça contexto somente quando necessário para uma resposta correta. Não prometa capacidades que não tem.';
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
  async models() {
    const response = await fetch(`${this.host}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Ollama: HTTP ${response.status}`);
    return (await response.json()).models || [];
  }
  async *chat(model, messages, signal, fast = true) {
    const response = await fetch(`${this.host}/api/chat`, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: true, keep_alive: '10m', options: { num_ctx: fast ? 4096 : 8192, num_predict: fast ? 1024 : 4096, temperature: 0.6 } })
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

export function runCommand(command, onOutput, { cwd = process.cwd(), timeout = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, shell: true, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']);
      else { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
    }, timeout);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', data => onOutput(clean(data)));
    child.stderr.on('data', data => onOutput(clean(data)));
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); resolve({ code, timedOut }); });
  });
}
