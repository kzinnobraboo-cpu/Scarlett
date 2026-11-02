#!/usr/bin/env node
import readline from 'node:readline';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Ollama, IDENTITY, systemPrompt, clean, validateSession, runCommand } from './core.js';

const tty = Boolean(process.stdout.isTTY);
const color = (code, text) => tty ? `\x1b[${code}m${text}\x1b[0m` : text;
const red = text => color('38;5;204', text);
const muted = text => color('38;5;245', text);
const out = text => console.log(text);
const commands = ['/help', '/models', '/model ', '/new', '/save ', '/load ', '/system', '/sim on', '/sim off', '/fast on', '/fast off', '/run ', '/quit'];
const demo = process.argv.includes('--demo');
const api = new Ollama();
let model = process.env.SCARLETT_MODEL || 'scarlett';
let messages = [], simulation = false, fast = true, busy = false, controller, confirmation;

function banner() {
  out('');
  out(red('   ╭────────────────────────────────────────────╮'));
  out(red('   │  S C A R L E T T                      ✦    │'));
  out(red('   ╰────────────────────────────────────────────╯'));
  out('   Sua assistente local. Seu terminal. Seu ritmo.');
  out(muted('   Criada por mark.code · dev solo · Linux + Windows'));
  out(muted(`   ${model}  •  ${fast ? 'rápido' : 'completo'}  •  ${api.host}`));
  out(muted('   /help comandos · Tab completar · Esc parar resposta · Ctrl+C sair\n'));
}
banner();
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: tty,
  completer: line => [commands.filter(c => c.startsWith(line)), line], historySize: 100 });
const prompt = () => { rl.setPrompt(red('  ❯ ')); rl.prompt(); };
if (tty) process.stdin.on('keypress', (_, key) => { if (key?.name === 'escape') controller?.abort(); });
rl.on('SIGINT', () => { controller?.abort(); rl.close(); });
rl.on('close', () => { controller?.abort(); out(muted('\n  Até logo. — Scarlett')); process.exit(0); });

async function command(line) {
  const space = line.indexOf(' ');
  const name = space < 0 ? line : line.slice(0, space);
  const arg = space < 0 ? '' : line.slice(space + 1).trim();
  switch (name) {
    case '/help':
      out(`\n${red('  Comandos')}\n  /models           listar modelos instalados\n  /model NOME       selecionar um modelo\n  /new              limpar conversa\n  /save ARQUIVO     salvar conversa JSON\n  /load ARQUIVO     abrir conversa JSON\n  /sim on|off       premissas de ficção\n  /fast on|off      contexto e respostas menores\n  /system           ver personalidade\n  /run COMANDO      executar no PC após confirmação\n  /quit             sair\n`); break;
    case '/models': {
      const models = demo ? [{ name: 'scarlett', size: 0 }] : await api.models();
      if (!models.length) out('Nenhum modelo. Instale um pelo Ollama; consulte README.md.');
      for (const item of models) out(`  ${item.name === model ? red('●') : '○'} ${clean(item.name)} ${muted(`${(item.size / 1e9).toFixed(1)} GB`)}  → /model ${clean(item.name)}`);
      break;
    }
    case '/model':
      if (!arg || !/^[a-zA-Z0-9_./:@-]+$/.test(arg)) throw new Error('Uso: /model NOME');
      model = arg; messages = []; out(`Modelo: ${model}. Nova conversa iniciada.`); break;
    case '/new': messages = []; out('Nova conversa.'); break;
    case '/system': out(systemPrompt(simulation)); break;
    case '/sim': case '/fast':
      if (!['on', 'off'].includes(arg)) throw new Error(`Uso: ${name} on|off`);
      if (name === '/sim') simulation = arg === 'on'; else fast = arg === 'on';
      out(`${name}: ${arg}`); break;
    case '/save': {
      if (!arg) throw new Error('Uso: /save caminho.json');
      const target = resolve(arg);
      await mkdir(resolve(target, '..'), { recursive: true });
      await writeFile(target, JSON.stringify(messages, null, 2), { flag: 'wx', mode: 0o600 });
      out(`Conversa salva: ${target}`); break;
    }
    case '/load':
      if (!arg) throw new Error('Uso: /load caminho.json');
      messages = validateSession(JSON.parse(await readFile(resolve(arg), 'utf8')));
      out(`${messages.length} mensagens carregadas.`); break;
    case '/run':
      if (!arg) throw new Error('Uso: /run COMANDO');
      confirmation = arg;
      out(red(`\n  Executar no computador em ${process.cwd()}:`));
      out(`  ${clean(arg)}\n  Shell: ${process.platform === 'win32' ? 'cmd.exe' : '/bin/sh'} · limite: 30s`);
      out('  Digite EXECUTAR para confirmar; qualquer outra resposta cancela.'); break;
    case '/quit': rl.close(); break;
    default: out('Comando desconhecido. Digite /help.');
  }
}

rl.on('line', async raw => {
  if (busy) { out(muted('Aguarde a resposta ou pressione Esc.')); return; }
  const line = raw.trim();
  if (!line) { prompt(); return; }
  busy = true;
  try {
    if (confirmation) {
      const pending = confirmation; confirmation = undefined;
      if (line === 'EXECUTAR') {
        const result = await runCommand(pending, chunk => process.stdout.write(chunk));
        out(`\nCódigo: ${result.code}${result.timedOut ? ' · tempo esgotado' : ''}`);
      } else out('Execução cancelada.');
    } else if (line.startsWith('/')) await command(line);
    else {
      out(red('\n  ✦ Scarlett\n'));
      controller = new AbortController();
      const started = performance.now();
      let answer = '', stats;
      const emit = text => { answer += text; process.stdout.write(clean(text)); };
      if (demo) emit(`${IDENTITY}\nModo demonstração: use npm start para conversar com um modelo local.`);
      else {
        for await (const event of api.chat(model, [{ role: 'system', content: systemPrompt(simulation) }, ...messages, { role: 'user', content: line }], controller.signal, fast)) {
          if (event.message?.content) emit(event.message.content);
          if (event.done) stats = event;
        }
      }
      if (answer) messages.push({ role: 'user', content: line }, { role: 'assistant', content: answer });
      const speed = stats?.eval_duration > 0 ? ` · ${(stats.eval_count / (stats.eval_duration / 1e9)).toFixed(1)} tok/s` : '';
      out(muted(`\n\n  ${((performance.now() - started) / 1000).toFixed(1)}s${speed} · ${model}\n`));
    }
  } catch (error) {
    if (controller?.signal.aborted) out(muted('\nResposta interrompida.'));
    else out(red(`\nErro: ${clean(error.message)}\nVerifique se o Ollama está rodando (ollama serve) e se o modelo está instalado (/models).`));
  } finally { controller = undefined; busy = false; prompt(); }
});
prompt();
