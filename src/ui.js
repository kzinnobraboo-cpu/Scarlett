import readline from 'node:readline';
import { clean } from './core.js';
import { profileFor } from './profiles.js';

const codes = { bg: '48;2;12;15;24', panel: '48;2;25;30;46', fg: '38;2;219;225;244', dim: '38;2;120;132;160', red: '38;2;255;111;155', cyan: '38;2;100;225;213', purple: '38;2;181;163;255', gold: '38;2;242;201;126' };
export const strip = s => s.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
const width = s => [...strip(s)].length;
const cut = (s, n) => [...clean(s)].slice(0, Math.max(0, n)).join('');
const paint = (s, tone = 'fg') => `\x1b[${codes[tone]}m${s}\x1b[${codes.fg}m`;
const fit = (s, size) => s + ' '.repeat(Math.max(0, size - width(s)));
export const COMMANDS = [
  ['/models', 'Escolher um modelo local'], ['/setup', 'Instalar Scarlett Turbo · 1.5B'],
  ['/setup balanced', 'Instalar Scarlett Equilibrada · 3B'], ['/speed', 'Escolher perfil de velocidade'],
  ['/name ', 'Escolher seu apelido e salvar'], ['/personality', 'Ver personalização salva'], ['/personality ', 'Definir estilo das respostas'],
  ['/scan', 'Verificar malware na pasta pessoal'], ['/scan ', 'Verificar arquivo ou pasta específica'],
  ['/agent on', 'Agente com ferramentas e confirmações'], ['/agent off', 'Conversa sem ferramentas automáticas'],
  ['/cd ', 'Trocar pasta de trabalho'], ['/ls', 'Listar pasta atual'], ['/read ', 'Ler um arquivo de texto'],
  ['/mkdir ', 'Criar pasta imediatamente'], ['/write ', 'Criar/editar arquivo com argumentos JSON'],
  ['/build ', 'Compilar C/C++ ou empacotar Python (JSON)'],
  ['/warmup', 'Carregar o modelo antes de conversar'], ['/stats', 'Ver métricas da última resposta'],
  ['/train', 'Abrir o guia de treinamento LoRA'], ['/train export ', 'Exportar conversa para dataset JSONL'],
  ['/train check ', 'Validar dataset sem dependências de ML'], ['/train start ', 'Iniciar LoRA após confirmação'],
  ['/connect', 'Reconectar e iniciar Ollama'], ['/new', 'Começar uma conversa nova'],
  ['/fast on', 'Atalho para perfil Turbo'], ['/fast off', 'Atalho para perfil Completo'],
  ['/sim on', 'Ativar cenário fictício'], ['/sim off', 'Voltar ao modo factual'],
  ['/save ', 'Salvar conversa em arquivo JSON'], ['/load ', 'Abrir conversa JSON'],
  ['/run ', 'Executar comando com confirmação'], ['/system', 'Ver personalidade'],
  ['/help', 'Ver todos os comandos'], ['/quit', 'Sair da Scarlett']
];
export function wrap(text, size) {
  size = Math.max(1, size);
  return clean(text).split('\n').flatMap(line => {
    const chars = [...line.replace(/\t/g, '    ')], rows = [];
    while (chars.length > size) rows.push(chars.splice(0, size).join(''));
    rows.push(chars.join('')); return rows;
  });
}
export class TerminalUI {
  constructor(onSubmit, onStop) {
    this.onSubmit = onSubmit; this.onStop = onStop;
    this.input = ''; this.cursor = 0; this.items = []; this.history = []; this.historyIndex = 0;
    this.selected = 0; this.scroll = 0; this.modal = null; this.busy = false;
    this.status = 'CONECTANDO'; this.model = 'scarlett:turbo'; this.speed = 'turbo'; this.fast = true; this.sim = false;
    this.notice = 'Verificando Ollama local…'; this.frame = 0; this.metrics = null; this.agent = true; this.workspace = process.cwd();
    this.tty = Boolean(process.stdin.isTTY && process.stdout.isTTY);
    this.cache = new WeakMap(); this.lastScreen = [];
  }
  start() {
    if (!this.tty) {
      console.log('Scarlett 1.3 · criada por mark.code · dev solo\nAbra em um terminal interativo para a interface completa.');
      this.rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
      this.rl.on('line', line => this.onSubmit(line));
      return;
    }
    process.stdout.write('\x1b[?1049h\x1b[?25l');
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true); process.stdin.resume();
    this.keyHandler = (text, key) => this.key(text, key || {});
    process.stdin.on('keypress', this.keyHandler);
    this.resizeHandler = () => { this.lastScreen = []; this.render(); };
    process.stdout.on('resize', this.resizeHandler);
    this.timer = setInterval(() => { if (this.busy) { this.frame++; this.render(); } }, 100);
    this.render();
  }
  close() {
    clearInterval(this.timer); clearTimeout(this.renderTimer); this.rl?.close();
    if (this.tty) {
      process.stdin.removeListener('keypress', this.keyHandler);
      process.stdout.removeListener('resize', this.resizeHandler);
      process.stdin.setRawMode(false);
      process.stdout.write('\x1b[0m\x1b[?25h\x1b[?1049l');
    }
  }
  scheduleRender() {
    if (this.renderTimer) return;
    this.renderTimer = setTimeout(() => { this.renderTimer = null; this.render(); }, 33);
  }
  add(role, text) {
    const item = { role, text }; this.items.push(item); this.scroll = 0;
    if (!this.tty) console.log(`${role}: ${clean(text)}`);
    this.render(); return item;
  }
  choices() { return this.input.startsWith('/') ? COMMANDS.filter(c => c[0].startsWith(this.input)) : []; }
  key(text, key) {
    if (key.ctrl && ['c', 'd'].includes(key.name)) return this.onSubmit('/quit');
    if (key.name === 'escape') { this.modal = null; this.input = ''; this.cursor = 0; this.onStop(); this.render(); return; }
    if (key.name === 'pageup') { this.scroll += 8; this.render(); return; }
    if (key.name === 'pagedown') { this.scroll = Math.max(0, this.scroll - 8); this.render(); return; }
    if (this.busy) return;
    if (key.ctrl && key.name === 'k') { this.input = '/'; this.cursor = 1; this.selected = 0; this.render(); return; }
    if (key.name === 'f1') return this.onSubmit('/help');
    const options = this.modal?.options || this.choices();
    if (options.length && ['up', 'down', 'tab'].includes(key.name)) {
      this.selected = (this.selected + (key.name === 'up' ? -1 : 1) + options.length) % options.length;
    } else if (key.name === 'return') {
      if (this.modal) {
        const choice = this.modal.options[this.selected], action = this.modal.action || '/model'; this.modal = null;
        if (choice) this.onSubmit(`${action} ${choice[0]}`);
      } else if (options.length) {
        const choice = options[this.selected % options.length][0];
        if (choice.endsWith(' ')) { this.input = choice; this.cursor = choice.length; }
        else { this.input = ''; this.cursor = 0; this.onSubmit(choice); }
      } else if (this.input.trim()) {
        const value = this.input.trim(); this.history.push(value); this.historyIndex = this.history.length;
        this.input = ''; this.cursor = 0; this.scroll = 0; this.onSubmit(value);
      }
      this.selected = 0;
    } else if (key.name === 'backspace') {
      if (this.cursor) { this.input = this.input.slice(0, this.cursor - 1) + this.input.slice(this.cursor); this.cursor--; }
    } else if (key.name === 'delete') this.input = this.input.slice(0, this.cursor) + this.input.slice(this.cursor + 1);
    else if (key.name === 'left') this.cursor = Math.max(0, this.cursor - 1);
    else if (key.name === 'right') this.cursor = Math.min(this.input.length, this.cursor + 1);
    else if (key.name === 'home' || (key.ctrl && key.name === 'a')) this.cursor = 0;
    else if (key.name === 'end' || (key.ctrl && key.name === 'e')) this.cursor = this.input.length;
    else if (['up', 'down'].includes(key.name)) {
      this.historyIndex = Math.max(0, Math.min(this.history.length, this.historyIndex + (key.name === 'up' ? -1 : 1)));
      this.input = this.history[this.historyIndex] || ''; this.cursor = this.input.length;
    } else if (text && !key.ctrl && !key.meta) {
      const safe = clean(text).replace(/\n/g, ' ');
      this.input = this.input.slice(0, this.cursor) + safe + this.input.slice(this.cursor); this.cursor += safe.length;
    }
    this.selected = Math.min(this.selected, Math.max(0, (this.modal?.options || this.choices()).length - 1));
    this.render();
  }
  messageLines(item, inner) {
    const cached = this.cache.get(item);
    if (cached?.text === item.text && cached.size === inner) return cached.lines;
    const lines = [];
    let code = false;
    for (const raw of clean(item.text).split('\n')) {
      if (raw.trim().startsWith('```')) {
        code = !code;
        lines.push([code ? `┌ CODE  ${raw.trim().slice(3)}` : '└ END', 'dim']);
      } else for (const l of wrap(raw, inner - 2)) lines.push([`${code ? '│ ' : '  '}${l}`, code ? 'cyan' : raw.startsWith('#') ? 'purple' : 'fg']);
    }
    this.cache.set(item, { text: item.text, size: inner, lines });
    return lines;
  }
  render() {
    if (!this.tty) return;
    const w = Math.max(20, process.stdout.columns || 80), h = Math.max(10, process.stdout.rows || 24);
    const sidebar = w >= 116 && h >= 26, mainWidth = sidebar ? w - 29 : w, inner = mainWidth - 6;
    const rows = [], row = (s = '') => rows.push(s);
    const line = (s, tone = 'fg', size = w) => '  ' + paint(cut(s, size - 4), tone);
    row(line('✦  S C A R L E T T   /   1.3                    LOCAL · PESSOAL · DIRETA', 'red'));
    row(line(`${process.platform === 'win32' ? 'WINDOWS' : 'LINUX'}  /  ${this.workspace}  ·  mark.code`, 'dim'));
    row(line('─'.repeat(w - 4), 'dim'));
    const content = [], add = (s = '', tone = 'fg') => content.push(line(s, tone, mainWidth));
    const centered = (s, tone = 'fg') => add(' '.repeat(Math.max(0, Math.floor((inner - [...s].length) / 2))) + s, tone);
    if (!this.items.length) {
      add('');
      if (h >= 30) {
        centered('·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·', 'dim');
        centered('S C A R L E T T', 'red');
        centered('───────  1 . 3  ───────', 'purple');
      } else centered('S C A R L E T T  /  1.3', 'red');
      add('');
      centered(this.nickname ? `O que vamos criar, ${this.nickname}?` : 'Peça uma ideia. Crie alguma coisa.', 'fg');
      centered('Menos etapas. Mais coisas prontas.', 'dim');
      add('');
      const boxWidth = Math.min(inner - 2, 68), margin = ' '.repeat(Math.max(0, Math.floor((inner - boxWidth) / 2)));
      const card = (title, detail, tone) => {
        add(margin + '╭' + '─'.repeat(boxWidth - 2) + '╮', 'dim');
        add(margin + '│ ' + cut(title, boxWidth - 4).padEnd(boxWidth - 4) + ' │', tone);
        add(margin + '│ ' + cut(detail, boxWidth - 4).padEnd(boxWidth - 4) + ' │', 'dim');
        add(margin + '╰' + '─'.repeat(boxWidth - 2) + '╯', 'dim');
      };
      if (h >= 32) {
        card('01  PEÇA E ESTÁ FEITO', 'Crie uma pasta chamada MeuProjeto na Área de Trabalho', 'cyan');
        card('02  DO SEU JEITO', '/name Chefia   ·   /personality Direta, com exemplos', 'purple');
        card('03  SUA INTELIGÊNCIA LOCAL', '/models escolher   ·   /train personalizar pesos', 'gold');
      } else {
        centered('Crie uma pasta chamada MeuProjeto', 'cyan');
        centered('/models  ·  /personality  ·  /train', 'purple');
      }
      add('');
      centered('Ctrl+K abre comandos  ·  F1 mostra ajuda', 'dim');
    } else for (const item of this.items) {
      add(''); add(`╭─ ${item.role === 'Você' ? '›' : item.role === 'Scarlett' ? '✦' : '◆'} ${item.role.toUpperCase()}`, item.role === 'Scarlett' ? 'red' : item.role === 'Você' ? 'purple' : 'cyan');
      for (const [text, tone] of this.messageLines(item, inner)) add(text, tone);
      add('╰─', 'dim');
    }
    const options = this.modal?.options || this.choices(), showMenu = options.length > 0 && h >= 16;
    const menuHeight = showMenu ? Math.min(options.length, 6, h - 13) : 0;
    const available = Math.max(1, h - 10 - (showMenu ? menuHeight + 2 : 0));
    this.scroll = Math.min(this.scroll, Math.max(0, content.length - available));
    const bottom = Math.max(available, content.length - this.scroll);
    const visibleContent = content.slice(Math.max(0, bottom - available), bottom);
    const side = [
      ['SEU ESPAÇO', 'dim'], ['', 'dim'], ['✦ SCARLETT 1.3', 'red'], [this.nickname || 'Do seu jeito.', 'fg'], ['mark.code · dev solo', 'dim'], ['', 'dim'],
      ['MODELO LOCAL', 'dim'], [this.model, 'cyan'], [`${profileFor(this.speed).label} · ${this.agent ? 'AGENTE' : 'CHAT'}`, 'purple'], [this.status, this.status === 'OFFLINE' ? 'red' : 'cyan'], ['', 'dim'],
      [this.lastAction?.title || 'AÇÕES DIRETAS', 'gold'], [this.lastAction?.detail ? cut(this.lastAction.detail, 25) : 'Pastas sem espera.', 'fg'], ['/mkdir ou pedido natural', 'dim'], ['', 'dim'],
      ['PERSONALIZE', 'dim'], ['/name    seu apelido', 'fg'], ['/personality  seu estilo', 'fg'], ['/train   seus exemplos', 'fg'], ['', 'dim'],
      ['DESEMPENHO', 'dim'], [this.metrics ? `${this.metrics.tps.toFixed(1)} tok/s` : 'Métricas após inferência.', 'cyan'], ['', 'dim'],
      ['Ctrl+K  comandos', 'dim'], ['F1  ajuda', 'dim']
    ];
    for (let i = 0; i < available; i++) {
      let l = fit(visibleContent[i] || '', mainWidth);
      if (sidebar) { const [s, tone] = side[i] || ['', 'dim']; l += paint('│ ', 'dim') + paint(cut(s, 25).padEnd(27), tone); }
      row(l);
    }
    if (showMenu) {
      row(line(`${this.modal?.title || (this.modal ? 'MODELOS LOCAIS' : 'COMANDOS')}  ·  ↑ ↓ escolher  ·  Enter selecionar  ·  Esc fechar`, 'dim'));
      const offset = Math.max(0, this.selected - menuHeight + 1);
      for (let i = offset; i < Math.min(options.length, offset + menuHeight); i++) {
        const [name, desc] = options[i];
        row((i === this.selected ? `\x1b[${codes.panel}m` : '') + line(`${i === this.selected ? '❯' : ' '} ${name.padEnd(Math.min(23, Math.floor(w / 3)))}  ${desc}`, i === this.selected ? 'red' : 'dim'));
      }
      row('');
    }
    const spinner = ['◐', '◓', '◑', '◒'][this.frame % 4];
    row(line(`${this.busy ? spinner : '●'} ${this.status}  ·  ${this.model}  ·  ${profileFor(this.speed).label}${this.agent ? '  ·  AGENTE' : ''}${this.sim ? '  ·  SIMULAÇÃO' : ''}${this.scroll ? `  ·  ↑ ${this.scroll} linhas` : ''}`, this.status === 'OFFLINE' ? 'red' : 'cyan'));
    row(line(this.notice, 'dim'));
    row(line('╭' + '─'.repeat(Math.max(0, w - 6)) + '╮', 'dim'));
    const maxInput = w - 10, offset = Math.max(0, this.cursor - maxInput + 2);
    const visible = cut(this.input.slice(offset), maxInput - 1), caret = Math.max(0, this.cursor - offset);
    const editor = paint(visible.slice(0, caret)) + '\x1b[7m' + (visible[caret] || ' ') + '\x1b[27m' + paint(visible.slice(caret + 1));
    const placeholder = cut(this.busy ? 'Aguarde… Esc para interromper' : 'Crie uma pasta chamada Projeto…   / comandos', maxInput);
    const field = visible ? editor : paint(placeholder, 'dim');
    row('  ' + paint('│ ', 'dim') + paint('❯ ', 'red') + field + ' '.repeat(Math.max(0, w - 10 - (visible ? Math.max(visible.length, caret + 1) : placeholder.length))) + paint(' │', 'dim'));
    row(line('╰' + '─'.repeat(Math.max(0, w - 6)) + '╯', 'dim'));
    row(line('Enter enviar   Ctrl+K comandos   F1 ajuda   PgUp/PgDn histórico   Esc parar', 'dim'));
    const screen = rows.slice(0, h);
    while (screen.length < h) screen.push('');
    const size = `${w}x${h}`, resized = this.lastSize !== size;
    let output = resized ? '\x1b[?25l\x1b[2J' : '\x1b[?25l';
    for (let i = 0; i < screen.length; i++) if (resized || screen[i] !== this.lastScreen[i]) {
      output += `\x1b[${i + 1};1H\x1b[${codes.bg}m${fit(screen[i], w)}\x1b[0m`;
    }
    this.lastSize = size; this.lastScreen = screen;
    process.stdout.write(output);
  }
}
