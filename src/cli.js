#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Ollama, IDENTITY, systemPrompt, validateSession, runCommand } from './core.js';
import { TerminalUI, COMMANDS } from './ui.js';
import { ensureBackend, setupModel } from './backend.js';

const demo = process.argv.includes('--demo');
const api = new Ollama();
let model = process.env.SCARLETT_MODEL || 'scarlett';
let messages = [], simulation = false, fast = true, busy = false, controller, confirmation, connected = false, installed = [];
const ui = new TerminalUI(submit, () => controller?.abort());
ui.model = model;
function status(value, notice = ui.notice) { ui.status = value; ui.notice = notice; ui.render(); }
function stop() { controller?.abort(); ui.close(); process.exit(0); }
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
process.on('uncaughtException', error => { ui.close(); console.error(error); process.exit(1); });
async function connect() {
  status('CONECTANDO', 'Iniciando Ollama local, se necessário…');
  installed = demo ? [{ name: 'scarlett', size: 0 }, { name: 'qwen2.5:3b', size: 1900000000 }] : await ensureBackend(api);
  connected = true;
  const current = installed.find(m => m.name === model || m.name === `${model}:latest`);
  if (!current && model === 'scarlett' && installed.length) {
    model = installed.find(m => m.name === 'qwen2.5:3b')?.name || installed[0].name;
    ui.model = model;
  }
  status(installed.length ? (demo ? 'DEMONSTRAÇÃO' : 'ONLINE') : 'SEM MODELO', installed.length ? 'Tudo pronto. Seus dados ficam no computador.' : 'Digite /setup para baixar e preparar Scarlett. O download inicial usa internet.');
}
async function command(line) {
  const space = line.indexOf(' ');
  const name = space < 0 ? line : line.slice(0, space);
  const arg = space < 0 ? '' : line.slice(space + 1).trim();
  switch (name) {
    case '/help': ui.add('Comandos', COMMANDS.map(([c, d]) => `${c.padEnd(16)} ${d}`).join('\n')); break;
    case '/connect': await connect(); break;
    case '/setup':
      controller = new AbortController();
      if (!connected) await connect();
      status('INSTALANDO', 'Baixando qwen2.5:3b e preparando Scarlett. Esc cancela.');
      if (!demo) await setupModel(api, progress => {
        if (progress) { ui.notice = progress.split(/[\r\n]/).filter(Boolean).at(-1) || ui.notice; ui.render(); }
      }, controller.signal);
      model = 'scarlett'; ui.model = model; messages = [];
      await connect(); ui.add('Pronto', 'Scarlett preparada. Pode conversar!'); break;
    case '/models': {
      if (!connected) await connect();
      installed = demo ? installed : await api.models();
      if (!installed.length) { status('SEM MODELO', 'Nenhum modelo instalado. Digite /setup para preparar Scarlett.'); break; }
      if (ui.tty) { ui.selected = 0; ui.modal = { options: installed.map(m => [m.name, `${(m.size / 1e9).toFixed(1)} GB${m.name === model ? ' · ativo' : ''}`]) }; }
      else ui.add('Modelos', installed.map(m => m.name).join('\n'));
      break;
    }
    case '/model':
      if (!arg || !/^[a-zA-Z0-9_./:@-]+$/.test(arg)) throw new Error('Uso: /model NOME');
      if (!connected) await connect();
      installed = demo ? installed : await api.models();
      if (!installed.some(m => m.name === arg || m.name === `${arg}:latest`)) throw new Error(`Modelo ${arg} não instalado. Use /models ou /setup.`);
      model = arg; ui.model = model; messages = []; ui.items = [];
      status(demo ? 'DEMONSTRAÇÃO' : 'ONLINE', `Modelo ${model} selecionado. Nova conversa.`); break;
    case '/new': messages = []; ui.items = []; ui.notice = 'Nova conversa. O que vamos construir?'; break;
    case '/system': ui.add('Personalidade', systemPrompt(simulation)); break;
    case '/sim': case '/fast':
      if (!['on', 'off'].includes(arg)) throw new Error(`Uso: ${name} on|off`);
      if (name === '/sim') { simulation = arg === 'on'; ui.sim = simulation; }
      else { fast = arg === 'on'; ui.fast = fast; }
      ui.notice = `${name}: ${arg}`; break;
    case '/save': {
      if (!arg) throw new Error('Uso: /save caminho.json');
      const target = resolve(arg);
      await mkdir(resolve(target, '..'), { recursive: true });
      await writeFile(target, JSON.stringify(messages, null, 2), { flag: 'wx', mode: 0o600 });
      ui.notice = `Conversa salva: ${target}`; break;
    }
    case '/load':
      if (!arg) throw new Error('Uso: /load caminho.json');
      messages = validateSession(JSON.parse(await readFile(resolve(arg), 'utf8')));
      ui.items = messages.map(m => ({ role: m.role === 'user' ? 'Você' : 'Scarlett', text: m.content }));
      ui.notice = `${messages.length} mensagens carregadas.`; break;
    case '/run':
      if (!arg) throw new Error('Uso: /run COMANDO');
      confirmation = arg;
      ui.add('Confirmar execução', `Pasta: ${process.cwd()}\nShell: ${process.platform === 'win32' ? 'cmd.exe' : '/bin/sh'}\n\n${arg}\n\nDigite EXECUTAR para confirmar. Qualquer outra mensagem cancela. Limite de 30s.`);
      ui.notice = 'Aguardando sua confirmação. Comandos usam suas permissões.'; break;
    case '/quit': stop(); break;
    default: throw new Error('Comando desconhecido. Digite / para escolher um comando.');
  }
}
async function submit(raw) {
  const line = raw.trim();
  if (line === '/quit') return stop();
  if (!line || busy) return;
  busy = true; ui.busy = true; ui.render();
  try {
    if (confirmation) {
      const pending = confirmation; confirmation = undefined;
      if (line === 'EXECUTAR') {
        const item = ui.add('Terminal', '');
        status('EXECUTANDO', pending);
        const result = await runCommand(pending, chunk => { item.text = (item.text + chunk).slice(-100000); ui.render(); });
        item.text += `\nCódigo: ${result.code}${result.timedOut ? ' · tempo esgotado' : ''}`;
        status(connected ? 'ONLINE' : 'OFFLINE', 'Comando finalizado.');
      } else ui.notice = 'Execução cancelada.';
    } else if (line.startsWith('/')) await command(line);
    else {
      if (!connected) await connect();
      if (!installed.length) throw new Error('Ainda não há modelo instalado. Use /setup para baixar e preparar Scarlett.');
      ui.add('Você', line);
      const item = ui.add('Scarlett', '');
      controller = new AbortController();
      const started = performance.now();
      status(demo ? 'DEMONSTRAÇÃO' : 'GERANDO', 'Preparando resposta… Esc interrompe.');
      let stats, firstToken;
      try {
        if (demo) {
          const answer = `${IDENTITY}\n\nEsta é a nova interface da Scarlett. Estou no modo demonstração; nenhuma inferência foi executada.\n\n• /models abre o seletor de modelos\n• /setup prepara o modelo local\n• /run executa comandos após sua confirmação\n\nVamos construir alguma coisa?`;
          for (const token of answer.match(/\S+\s*/g) || []) {
            if (controller.signal.aborted) break;
            item.text += token; ui.render(); await new Promise(r => setTimeout(r, 14));
          }
        } else for await (const event of api.chat(model, [{ role: 'system', content: systemPrompt(simulation) }, ...messages.slice(-40), { role: 'user', content: line }], controller.signal, fast)) {
          if (event.message?.content) {
            firstToken ??= performance.now();
            item.text += event.message.content;
            ui.notice = 'Respondendo localmente… Esc interrompe.';
            ui.render();
          }
          if (event.done) stats = event;
        }
      } finally {
        if (item.text) messages.push({ role: 'user', content: line }, { role: 'assistant', content: item.text });
      }
      const speed = stats?.eval_duration > 0 ? ` · ${(stats.eval_count / (stats.eval_duration / 1e9)).toFixed(1)} tok/s` : '';
      const latency = firstToken ? ` · primeiro token ${((firstToken - started) / 1000).toFixed(1)}s` : '';
      status(demo ? 'DEMONSTRAÇÃO' : 'ONLINE', `${((performance.now() - started) / 1000).toFixed(1)}s${latency}${speed}`);
    }
  } catch (error) {
    if (controller?.signal.aborted) status(connected ? 'ONLINE' : 'OFFLINE', 'Operação interrompida.');
    else {
      const network = error.message === 'fetch failed' || /Ollama não|sockets|Ollama: HTTP/.test(error.message);
      if (network) connected = false;
      ui.status = connected ? (demo ? 'DEMONSTRAÇÃO' : 'ONLINE') : 'OFFLINE';
      const message = error.message === 'fetch failed' ? 'Não consegui acessar Ollama. Use /connect para iniciar e reconectar; se persistir, execute ollama serve em outro terminal.' : error.message;
      ui.add('Atenção', message);
      ui.notice = network ? 'Use /connect para reconectar ao Ollama.' : message;
    }
  } finally { controller = undefined; busy = false; ui.busy = false; ui.render(); }
}
ui.start();
await submit('/connect');
