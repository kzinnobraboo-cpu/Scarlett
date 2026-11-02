#!/usr/bin/env node
import { readFile, writeFile, mkdir, stat, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Ollama, IDENTITY, systemPrompt, validateSession, runCommand } from './core.js';
import { TerminalUI, COMMANDS } from './ui.js';
import { ensureBackend, setupModel } from './backend.js';
import { PROFILES, profileFor, contextMessages } from './profiles.js';
import { exportExamples, trainingTask, runTraining } from './training.js';
import { identityReply } from './identity.js';
import { PcTools, toolDisplay } from './pc-tools.js';
import { agentTurn, agentInstructions } from './agent.js';
import { scanRequest, prepareScan, runScan } from './scanner.js';
import { folderRequest, createFolder } from './folder-actions.js';
import { PreferenceStore, DEFAULT_PREFERENCES, nicknameRequest, personalizationPrompt, addressedReply } from './preferences.js';

const demo = process.argv.includes('--demo');
const api = new Ollama();
let model = process.env.SCARLETT_MODEL || 'scarlett:turbo';
let messages = [], simulation = false, speed = 'turbo', agentMode = true, busy = false, controller, confirmation, pendingFolder, connected = false, installed = [];
const pc = new PcTools();
const preferenceStore = new PreferenceStore();
let preferences = { ...DEFAULT_PREFERENCES }, preferenceWarning;
try { preferences = await preferenceStore.load(); } catch (error) { preferenceWarning = error.message; }
const ui = new TerminalUI(submit, () => { controller?.abort(); if (pendingFolder) { pendingFolder = undefined; ui.notice = 'Criação cancelada.'; } cancelPending(); });
ui.agent = agentMode; ui.workspace = process.cwd(); ui.nickname = preferences.nickname;
ui.model = model;
ui.status = demo ? 'DEMONSTRAÇÃO' : 'PRONTA';
ui.notice = 'Pastas e atalhos prontos. O modelo conecta quando você precisar.';
function status(value, notice = ui.notice) { ui.status = value; ui.notice = notice; ui.render(); }
function stop() { controller?.abort(); confirmation?.state?.controller.abort(); ui.close(); process.exit(0); }
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
process.on('uncaughtException', error => { ui.close(); console.error(error); process.exit(1); });
async function connect() {
  status('CONECTANDO', 'Iniciando Ollama local, se necessário…');
  installed = demo ? [{ name: 'scarlett:turbo', size: 986000000 }, { name: 'scarlett:balanced', size: 1900000000 }] : await ensureBackend(api);
  connected = true;
  const current = installed.find(m => m.name === model || m.name === `${model}:latest`);
  if (!current && !process.env.SCARLETT_MODEL && installed.length) {
    model = installed.find(m => m.name === 'scarlett:turbo')?.name || installed.find(m => m.name === 'scarlett:latest')?.name || installed.find(m => m.name === 'qwen2.5:1.5b')?.name || installed[0].name;
    ui.model = model;
  }
  status(installed.length ? (demo ? 'DEMONSTRAÇÃO' : 'ONLINE') : 'SEM MODELO', installed.length ? 'Tudo pronto. Seus dados ficam no computador.' : 'Digite /setup para baixar e preparar Scarlett. O download inicial usa internet.');
}

function finishAgent(state, ending = '') {
  if (state.finished) return;
  state.finished = true;
  const summary = [state.answer.trim(), state.results.length ? `Resultados das ferramentas:\n${state.results.join('\n')}` : '', ending].filter(Boolean).join('\n\n');
  if (summary) messages.push({ role: 'user', content: state.user }, { role: 'assistant', content: summary.slice(-100000) });
}
function cancelPending() {
  if (!confirmation) return;
  if (confirmation.type === 'agent') {
    const state = confirmation.state;
    state.controller.abort();
    state.iterator.return().catch(() => {});
    finishAgent(state, 'A próxima ação foi cancelada pelo usuário.');
  }
  confirmation = undefined;
  ui.notice = 'Execução cancelada.';
  ui.status = connected ? (demo ? 'DEMONSTRAÇÃO' : 'ONLINE') : 'OFFLINE';
}
async function quickFolder(request, userText) {
  if (!request.name) {
    pendingFolder = request;
    ui.add('Scarlett', addressedReply('Qual nome você quer dar à pasta?', preferences));
    ui.notice = 'Digite apenas o nome da pasta. Esc cancela.';
    return;
  }
  const started = performance.now();
  const result = await createFolder(request);
  const answer = `${result.created ? 'Pasta criada' : 'Essa pasta já existe'}: ${result.path}`;
  ui.add('Scarlett', addressedReply(answer, preferences));
  messages.push({ role: 'user', content: userText }, { role: 'assistant', content: answer });
  ui.lastAction = { title: result.created ? 'PASTA CRIADA' : 'PASTA EXISTENTE', detail: result.path };
  ui.notice = `Concluído em ${(performance.now() - started).toFixed(0)} ms · sem inferência.`;
}
async function offerScan(path) {
  const plan = await prepareScan(path);
  if (!plan.available) {
    ui.add('Scarlett', addressedReply(plan.message, preferences));
    ui.notice = 'Instale/ative um motor de antivírus e tente /scan novamente.';
    return;
  }
  confirmation = { type: 'scan', plan };
  ui.add('Confirmar verificação', `${plan.preview}\n\nDigite EXECUTAR para iniciar. Esc cancela.`);
  status('AGUARDANDO', 'Revise o alvo da verificação e confirme com EXECUTAR.');
}
async function localTool(name, args) {
  const proposal = await pc.prepare(name, args);
  if (proposal.requiresApproval ?? proposal.mutates) {
    confirmation = { type: 'pc', proposal };
    ui.add('Confirmar ação', `${proposal.preview}\n\nDigite EXECUTAR para aplicar. Esc cancela.`);
    status('AGUARDANDO', 'Revise a ação e confirme com EXECUTAR.');
  } else {
    const result = await pc.execute(proposal);
    ui.add('Computador', toolDisplay(name, result));
  }
}
async function pumpAgent(state, approval) {
  if (state.waitStart) { state.waitMs += performance.now() - state.waitStart; state.waitStart = undefined; }
  try {
    let step = await state.iterator.next(approval);
    while (!step.done) {
      const event = step.value;
      if (event.type === 'approval') {
        state.waitStart = performance.now();
        confirmation = { type: 'agent', state };
        ui.add('Confirmar ação do agente', `${event.proposal.preview}\n\nDigite EXECUTAR para aplicar e continuar a tarefa. Esc cancela.`);
        status('AGUARDANDO', 'O agente aguarda sua confirmação. Nenhuma ação pendente foi executada.');
        return;
      }
      if (event.type === 'round') status('AGENTE', `Etapa ${event.round}/8 · ${model} · Esc interrompe.`);
      if (event.type === 'token') {
        state.first ??= (performance.now() - state.started - state.waitMs) / 1000;
        if (!state.item) {
          const greeting = state.addressed ? '' : addressedReply('', preferences);
          state.item = ui.add('Scarlett', greeting); state.answer += greeting; state.addressed = true;
        }
        state.item.text += event.text; state.answer += event.text;
        ui.scheduleRender();
      }
      if (event.type === 'stats') {
        state.tokens += event.stats.eval_count || 0;
        state.duration += event.stats.eval_duration || 0;
      }
      if (event.type === 'tool_start') {
        state.item = undefined;
        state.outputItem = ui.add(`Ferramenta · ${event.name}`, '');
        status('EXECUTANDO', event.name);
      }
      if (event.type === 'tool_result') {
        const text = JSON.stringify(event.result, null, 2);
        if (state.outputItem) { state.outputItem.text = toolDisplay(event.name, event.result); state.outputItem = undefined; ui.render(); }
        else ui.add(`Ferramenta · ${event.name}`, toolDisplay(event.name, event.result));
        state.results.push(`${event.name}: ${text.slice(0, 1800)}`);
      }
      if (event.type === 'limit') ui.add('Agente', event.text);
      step = await state.iterator.next();
    }
    finishAgent(state, step.value?.completed === false ? 'Limite de etapas atingido; tarefa pode estar incompleta.' : '');
    const elapsed = (performance.now() - state.started - state.waitMs) / 1000;
    ui.metrics = { tps: state.duration > 0 ? state.tokens / (state.duration / 1e9) : 0, first: state.first ?? 0, elapsed, tokens: state.tokens, profile: `agente/${speed}`, model };
    status('ONLINE', `Agente finalizado · ${state.results.length} resultados · ${elapsed.toFixed(1)}s sem tempo de confirmação.`);
  } catch (error) {
    finishAgent(state, state.controller.signal.aborted ? 'Tarefa interrompida.' : `Tarefa interrompida por erro: ${error.message}`);
    throw error;
  }
}

async function command(line) {
  const space = line.indexOf(' ');
  const name = space < 0 ? line : line.slice(0, space);
  const arg = space < 0 ? '' : line.slice(space + 1).trim();
  switch (name) {
    case '/help': ui.add('Comandos', COMMANDS.map(([c, d]) => `${c.padEnd(16)} ${d}`).join('\n')); break;
    case '/connect': await connect(); break;
    case '/name':
      if (!arg) { ui.add('Personalização', preferences.nickname ? `Estou te chamando de ${preferences.nickname}. Use /name NOVO_APELIDO ou /name reset.` : 'Use /name Chefia para escolher como quer ser chamado.'); break; }
      preferences = await preferenceStore.save({ ...preferences, nickname: arg === 'reset' ? '' : arg });
      ui.nickname = preferences.nickname;
      ui.add('Scarlett', preferences.nickname ? `Combinado, ${preferences.nickname}. Vou guardar esse apelido para as próximas conversas.` : 'Apelido removido.'); break;
    case '/personality':
      if (!arg) { ui.add('Personalidade', `Apelido: ${preferences.nickname || 'não definido'}\nEstilo: ${preferences.instructions || 'padrão'}\n\n/name Chefia\n/personality Responda de forma curta, em português.\n/personality reset\n\nPreferências são salvas neste computador. O estilo orienta o modelo; não treina pesos. O criador de Scarlett continua sendo mark.code.`); break; }
      preferences = await preferenceStore.save({ ...preferences, instructions: arg === 'reset' ? '' : arg });
      ui.add('Scarlett', 'Estilo salvo para as próximas conversas.'); break;
    case '/scan': await offerScan(arg || undefined); break;
    case '/agent':
      if (!['on', 'off'].includes(arg)) throw new Error('Uso: /agent on|off');
      agentMode = arg === 'on'; ui.agent = agentMode;
      ui.notice = agentMode ? 'Agente ativo: ferramentas reais com confirmação para alterações.' : 'Modo conversa: sem ferramentas automáticas.'; break;
    case '/cd': {
      if (!arg) { ui.add('Pasta atual', process.cwd()); break; }
      const target = await realpath(pc.path(arg));
      if (!(await stat(target)).isDirectory()) throw new Error('O caminho precisa ser uma pasta.');
      process.chdir(target); ui.workspace = target;
      ui.notice = `Pasta de trabalho: ${target}`; break;
    }
    case '/ls': await localTool('list_directory', { path: arg || '.' }); break;
    case '/read': await localTool('read_file', { path: arg }); break;
    case '/mkdir': await quickFolder({ name: arg.replace(/^([\"'])(.*)\1$/, '$2'), location: 'cwd' }, line); break;
    case '/write':
      if (!arg) throw new Error('Uso: /write {"path":"arquivo.txt","content":"texto","overwrite":false}');
      await localTool('write_file', JSON.parse(arg)); break;
    case '/build':
      if (!arg) throw new Error('Uso: /build {"source":"main.c","target":"windows","output":"main.exe"}');
      await localTool('build_program', JSON.parse(arg)); break;
    case '/setup': {
      const variant = arg || 'turbo';
      if (!['turbo', 'balanced'].includes(variant)) throw new Error('Use /setup turbo ou /setup balanced.');
      controller = new AbortController();
      if (!connected) await connect();
      status('INSTALANDO', `Baixando ${variant === 'turbo' ? '1.5B' : '3B'} e preparando Scarlett. Esc cancela.`);
      if (!demo) await setupModel(api, progress => {
        if (progress) { ui.notice = progress.split(/[\r\n]/).filter(Boolean).at(-1) || ui.notice; ui.render(); }
      }, controller.signal, variant);
      model = `scarlett:${variant}`; ui.model = model; messages = []; speed = variant; ui.speed = speed;
      await connect(); ui.add('Pronto', 'Scarlett preparada. Use /warmup para pré-carregar ou envie sua mensagem.'); break;
    }
    case '/models': {
      if (!connected) await connect();
      installed = demo ? installed : await api.models();
      if (!installed.length) { status('SEM MODELO', 'Nenhum modelo instalado. Digite /setup para preparar Scarlett.'); break; }
      if (ui.tty) { ui.selected = 0; ui.modal = { title: 'MODELOS LOCAIS', options: installed.map(m => [m.name, `${(m.size / 1e9).toFixed(1)} GB${m.name === model ? ' · ativo' : ''}`]) }; }
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
    case '/speed':
      if (!arg && ui.tty) {
        ui.selected = 0; ui.modal = { title: 'PERFIL DE DESEMPENHO', action: '/speed', options: Object.entries(PROFILES).map(([key, p]) => [key, `${p.num_ctx} contexto · ${p.num_predict} tokens`]) };
        break;
      }
      profileFor(arg || 'turbo'); speed = arg || 'turbo'; ui.speed = speed;
      ui.notice = `Perfil ${profileFor(speed).label}. O tamanho do modelo também influencia a velocidade.`; break;
    case '/warmup':
      if (!connected) await connect();
      if (!installed.length) throw new Error('Instale um modelo com /setup primeiro.');
      controller = new AbortController();
      status('CARREGANDO', 'Pré-carregando modelo na memória… Esc cancela.');
      if (!demo) await api.warmup(model, controller.signal, speed);
      status(demo ? 'DEMONSTRAÇÃO' : 'ONLINE', 'Modelo pré-carregado. Mantido em memória por até 30 minutos de inatividade.'); break;
    case '/stats':
      ui.add('Desempenho', ui.metrics ? `${ui.metrics.tps.toFixed(1)} tokens/s\nPrimeiro token: ${ui.metrics.first.toFixed(2)}s\nTotal: ${ui.metrics.elapsed.toFixed(2)}s\nTokens gerados: ${ui.metrics.tokens}\nPerfil medido: ${ui.metrics.profile}\nModelo medido: ${ui.metrics.model}` : 'Nenhuma inferência real medida ainda. O modo demo não produz benchmarks.'); break;
    case '/train': {
      if (!arg) {
        ui.add('Training studio', '1. Prepare o ambiente Python (docs/TRAINING.md).\n2. Converse com Scarlett e revise as respostas.\n3. /train export training/data.jsonl\n4. /train check training/data.jsonl\n5. /train start training/data.jsonl\n\nExportar cria exemplos; somente start treina pesos. O treino usa Python, TRL e LoRA, pode baixar pesos e exige memória e tempo. SCARLETT_PYTHON seleciona seu ambiente.');
        break;
      }
      const index = arg.indexOf(' '), action = index < 0 ? arg : arg.slice(0, index), path = index < 0 ? '' : arg.slice(index + 1).trim();
      if (!path || !['export', 'check', 'start'].includes(action)) throw new Error('Uso: /train export|check|start CAMINHO.jsonl');
      if (action === 'export') {
        const result = await exportExamples(messages, path);
        ui.add('Dataset exportado', `${result.count} conversa adicionada a ${result.target}. Revise o conteúdo e preserve contexto antes de treinar.`);
      } else if (action === 'check') {
        controller = new AbortController();
        const item = ui.add('Validação do dataset', '');
        await runTraining(trainingTask(path, true), chunk => { item.text = (item.text + chunk).slice(-100000); ui.scheduleRender(); }, controller.signal);
      } else {
        const task = trainingTask(path);
        confirmation = { type: 'training', task };
        ui.add('Confirmar treinamento', `Python: ${task.executable}\n${task.args.map(a => JSON.stringify(a)).join(' ')}\n\nPode baixar pesos, usar bastante memória e levar horas. Confira o ambiente em docs/TRAINING.md.\nDigite TREINAR para iniciar. Esc cancela.`);
      }
      break;
    }
    case '/new': messages = []; ui.items = []; ui.notice = 'Nova conversa. O que vamos construir?'; break;
    case '/system': ui.add('Personalidade', systemPrompt(simulation) + '\n' + personalizationPrompt(preferences)); break;
    case '/sim': case '/fast':
      if (!['on', 'off'].includes(arg)) throw new Error(`Uso: ${name} on|off`);
      if (name === '/sim') { simulation = arg === 'on'; ui.sim = simulation; }
      else { speed = arg === 'on' ? 'turbo' : 'quality'; ui.speed = speed; }
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
      confirmation = { type: 'shell', command: arg };
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
      const pending = confirmation;
      if (pending.type === 'agent') {
        if (line === 'EXECUTAR') {
          confirmation = undefined; controller = pending.state.controller;
          await pumpAgent(pending.state, true);
        } else cancelPending();
        return;
      }
      confirmation = undefined;
      if (pending.type === 'scan') {
        if (line === 'EXECUTAR') {
          controller = new AbortController();
          const item = ui.add('Antivírus', `Motor: ${pending.plan.engine}\nAlvo: ${pending.plan.target}\n\n`);
          status('VERIFICANDO', 'Varredura em andamento… pode demorar. Esc pede interrupção.');
          const result = await runScan(pending.plan, { signal: controller.signal, onOutput: text => { item.text = (item.text + text).slice(-60000); ui.scheduleRender(); } });
          item.text += '\n\n' + result.conclusion;
          status(connected ? (demo ? 'DEMONSTRAÇÃO' : 'ONLINE') : 'OFFLINE', result.conclusion);
        } else ui.notice = 'Verificação cancelada.';
        return;
      }
      if (pending.type === 'pc') {
        if (line === 'EXECUTAR') {
          controller = new AbortController();
          const item = ui.add('Computador', '');
          status('EXECUTANDO', pending.proposal.name);
          const result = await pc.execute(pending.proposal, { signal: controller.signal, onOutput: chunk => { item.text = (item.text + chunk).slice(-12000); ui.scheduleRender(); } });
          item.text = toolDisplay(pending.proposal.name, result);
          status(connected ? (demo ? 'DEMONSTRAÇÃO' : 'ONLINE') : 'OFFLINE', 'Ação finalizada. Consulte o resultado.');
        } else ui.notice = 'Execução cancelada.';
        return;
      }
      if (pending.type === 'training' && line === 'TREINAR') {
        controller = new AbortController();
        const item = ui.add('Treinamento LoRA', '');
        status('TREINANDO', 'Treinando localmente… Esc interrompe.');
        await runTraining(pending.task, chunk => { item.text = (item.text + chunk).slice(-100000); ui.scheduleRender(); }, controller.signal);
        status(connected ? 'ONLINE' : 'OFFLINE', 'Treino concluído. Consulte a saída para localizar os pesos.');
      } else if (pending.type === 'shell' && line === 'EXECUTAR') {
        controller = new AbortController();
        const item = ui.add('Terminal', '');
        status('EXECUTANDO', pending.command);
        const result = await runCommand(pending.command, chunk => { item.text = (item.text + chunk).slice(-100000); ui.scheduleRender(); }, { signal: controller.signal });
        item.text += `\nCódigo: ${result.code}${result.timedOut ? ' · tempo esgotado' : ''}`;
        status(connected ? 'ONLINE' : 'OFFLINE', result.aborted ? 'Comando interrompido.' : 'Comando finalizado.');
      } else ui.notice = 'Execução cancelada.';
    } else if (line.startsWith('/')) { pendingFolder = undefined; await command(line); }
    else {
      if (pendingFolder) {
        const request = pendingFolder; pendingFolder = undefined;
        ui.add('Você', line);
        await quickFolder({ ...request, name: line }, `Crie uma pasta ${line} em ${request.location}.`);
        return;
      }
      const folder = folderRequest(line);
      if (folder) { ui.add('Você', line); await quickFolder(folder, line); return; }
      if (scanRequest(line)) { ui.add('Você', line); await offerScan(); return; }
      const nickname = nicknameRequest(line);
      if (nickname) {
        preferences = await preferenceStore.save({ ...preferences, nickname }); ui.nickname = nickname;
        ui.add('Você', line);
        const answer = `Combinado, ${nickname}. Vou te chamar assim e guardar para as próximas conversas.`;
        ui.add('Scarlett', answer);
        messages.push({ role: 'user', content: line }, { role: 'assistant', content: answer });
        ui.notice = 'Apelido salvo. Personalização sem inferência ou treinamento.';
        return;
      }
      const identity = identityReply(line);
      if (identity) {
        ui.add('Você', line);
        ui.add('Scarlett', addressedReply(identity, preferences));
        messages.push({ role: 'user', content: line }, { role: 'assistant', content: identity });
        ui.notice = 'Identidade da Scarlett · resposta do aplicativo, sem inferência.';
        return;
      }
      if (!connected) await connect();
      if (!installed.length) throw new Error('Ainda não há modelo instalado. Use /setup para baixar e preparar Scarlett.');
      ui.add('Você', line);
      if (agentMode && !demo) {
        controller = new AbortController();
        const state = { user: line, controller, started: performance.now(), waitMs: 0, tokens: 0, duration: 0, answer: '', results: [] };
        state.iterator = agentTurn({ api, model, messages: contextMessages(systemPrompt(simulation) + '\n' + personalizationPrompt(preferences) + '\n' + agentInstructions(process.cwd()), messages, line, speed), tools: pc, signal: controller.signal, speed, onOutput: (_, text) => { if (state.outputItem) { state.outputItem.text = (state.outputItem.text + text).slice(-12000); ui.scheduleRender(); } } });
        await pumpAgent(state);
        return;
      }
      const item = ui.add('Scarlett', addressedReply('', preferences));
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
        } else for await (const event of api.chat(model, contextMessages(systemPrompt(simulation) + '\n' + personalizationPrompt(preferences), messages, line, speed), controller.signal, speed)) {
          if (event.message?.content) {
            firstToken ??= performance.now();
            item.text += event.message.content;
            ui.notice = 'Respondendo localmente… Esc interrompe.';
            ui.scheduleRender();
          }
          if (event.done) stats = event;
        }
      } finally {
        if (item.text) messages.push({ role: 'user', content: line }, { role: 'assistant', content: item.text });
      }
      const rate = stats?.eval_duration > 0 ? ` · ${(stats.eval_count / (stats.eval_duration / 1e9)).toFixed(1)} tok/s` : '';
      const latency = firstToken ? ` · primeiro token ${((firstToken - started) / 1000).toFixed(1)}s` : '';
      if (!demo && stats) ui.metrics = { tps: stats.eval_duration > 0 ? stats.eval_count / (stats.eval_duration / 1e9) : 0, first: firstToken ? (firstToken - started) / 1000 : 0, elapsed: (performance.now() - started) / 1000, tokens: stats.eval_count || 0, profile: speed, model };
      status(demo ? 'DEMONSTRAÇÃO' : 'ONLINE', `${((performance.now() - started) / 1000).toFixed(1)}s${latency}${rate}${stats?.done_reason === 'length' ? ' · limite atingido; use /speed quality' : ''}`);
    }
  } catch (error) {
    if (controller?.signal.aborted) status(connected ? 'ONLINE' : 'OFFLINE', 'Operação interrompida.');
    else {
      const network = error.message === 'fetch failed' || /Ollama não|sockets|Ollama: HTTP/.test(error.message);
      if (network) connected = false;
      ui.status = connected ? (demo ? 'DEMONSTRAÇÃO' : 'ONLINE') : 'OFFLINE';
      const message = /does not support tools|doesn't support tools/i.test(error.message) ? 'Este modelo não suporta ferramentas. Escolha um modelo compatível em /models ou use /agent off e os comandos diretos /mkdir, /write, /build e /run.' : error.message === 'fetch failed' ? 'Não consegui acessar Ollama. Use /connect para iniciar e reconectar; se persistir, execute ollama serve em outro terminal.' : error.message;
      ui.add('Atenção', message);
      ui.notice = network ? 'Use /connect para reconectar ao Ollama.' : message;
    }
  } finally { if (confirmation?.type !== 'agent') controller = undefined; busy = false; ui.busy = false; ui.render(); }
}
ui.start();
if (preferenceWarning) ui.add('Preferências', `Não consegui carregar suas preferências: ${preferenceWarning}. Use /name ou /personality para salvar uma configuração nova.`);
