import readline from 'node:readline';
import { clean } from './core.js';

const codes = { bg: '48;2;15;17;26', panel: '48;2;24;27;40', fg: '38;2;220;224;240', dim: '38;2;117;126;155', red: '38;2;255;102;142', cyan: '38;2;108;222;215', purple: '38;2;176;155;255' };
const strip = s => s.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
const width = s => [...strip(s)].length;
const cut = (s, n) => [...clean(s)].slice(0, Math.max(0, n)).join('');
const paint = (s, tone = 'fg') => `\x1b[${codes[tone]}m${s}\x1b[${codes.fg}m`;
export const COMMANDS = [
  ['/models', 'Escolher um modelo local'], ['/setup', 'Instalar e preparar Scarlett · download inicial'],
  ['/connect', 'Reconectar e iniciar Ollama'], ['/new', 'Começar uma conversa nova'],
  ['/fast on', 'Ativar respostas mais curtas'], ['/fast off', 'Usar contexto maior'],
  ['/sim on', 'Ativar cenário fictício'], ['/sim off', 'Voltar ao modo factual'],
  ['/save ', 'Salvar conversa em arquivo JSON'], ['/load ', 'Abrir conversa JSON'],
  ['/run ', 'Executar comando com confirmação'], ['/system', 'Ver personalidade'],
  ['/help', 'Ver todos os comandos'], ['/quit', 'Sair da Scarlett']
];
export function wrap(text, size) {
  return clean(text).split('\n').flatMap(line => {
    const chars = [...line.replace(/\t/g, '    ')];
    const rows = [];
    while (chars.length > size) rows.push(chars.splice(0, size).join(''));
    rows.push(chars.join('')); return rows;
  });
}
export class TerminalUI {
  constructor(onSubmit, onStop) {
    this.onSubmit = onSubmit; this.onStop = onStop;
    this.input = ''; this.cursor = 0; this.items = []; this.history = []; this.historyIndex = 0;
    this.selected = 0; this.scroll = 0; this.modal = null; this.busy = false;
    this.status = 'CONECTANDO'; this.model = 'scarlett'; this.fast = true; this.sim = false;
    this.notice = 'Verificando Ollama local…'; this.frame = 0;
    this.tty = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  }
  start() {
    if (!this.tty) {
      console.log('Scarlett · criada por mark.code · dev solo\nAbra em um terminal interativo para a interface completa.');
      this.rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
      this.rl.on('line', line => this.onSubmit(line));
      return;
    }
    process.stdout.write('\x1b[?1049h\x1b[?25l');
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true); process.stdin.resume();
    this.keyHandler = (text, key) => this.key(text, key || {});
    process.stdin.on('keypress', this.keyHandler);
    this.resizeHandler = () => this.render();
    process.stdout.on('resize', this.resizeHandler);
    this.timer = setInterval(() => { if (this.busy) { this.frame++; this.render(); } }, 100);
    this.render();
  }
  close() {
    clearInterval(this.timer); this.rl?.close();
    if (this.tty) {
      process.stdin.removeListener('keypress', this.keyHandler);
      process.stdout.removeListener('resize', this.resizeHandler);
      process.stdin.setRawMode(false);
      process.stdout.write('\x1b[0m\x1b[?25h\x1b[?1049l');
    }
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
    const options = this.modal?.options || this.choices();
    if (options.length && ['up', 'down', 'tab'].includes(key.name)) {
      this.selected = (this.selected + (key.name === 'up' ? -1 : 1) + options.length) % options.length;
    } else if (key.name === 'return') {
      if (this.modal) {
        const choice = this.modal.options[this.selected]; this.modal = null;
        if (choice) this.onSubmit(`/model ${choice[0]}`);
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
  render() {
    if (!this.tty) return;
    const w = Math.max(20, process.stdout.columns || 80), h = Math.max(10, process.stdout.rows || 24), inner = w - 6;
    const rows = [];
    const row = (s = '') => rows.push(s);
    const line = (s, tone = 'fg') => '  ' + paint(cut(s, w - 4), tone);
    row(line('✦  S C A R L E T T   /   BETA 1.0', 'red'));
    row(line(`LOCAL INTELLIGENCE  /  ${process.platform === 'win32' ? 'WINDOWS' : 'LINUX'}                      mark.code · dev solo`, 'dim'));
    row(line('─'.repeat(w - 4), 'dim'));
    const content = [];
    const add = (s, tone = 'fg') => content.push(line(s, tone));
    if (!this.items.length) {
      add(''); add('');
      const logo = ['███████╗ ██████╗ █████╗ ██████╗ ██╗     ███████╗████████╗████████╗', '██╔════╝██╔════╝██╔══██╗██╔══██╗██║     ██╔════╝╚══██╔══╝╚══██╔══╝', '███████╗██║     ███████║██████╔╝██║     █████╗     ██║      ██║', '╚════██║██║     ██╔══██║██╔══██╗██║     ██╔══╝     ██║      ██║', '███████║╚██████╗██║  ██║██║  ██║███████╗███████╗   ██║      ██║', '╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝      ╚═╝'];
      if (w >= 76 && h >= 27) for (const l of logo) add(l, 'red'); else add('S C A R L E T T  ✦', 'red');
      add(''); add('O que vamos construir hoje?', 'fg');
      add('Uma ideia, um comando ou uma conversa. Comece por aqui.', 'dim'); add('');
      add('  /models   Escolher sua inteligência local', 'cyan');
      add('  /setup    Preparar modelo na primeira execução', 'purple');
      add('  /run      Seu computador, sob seu comando', 'dim');
    } else for (const item of this.items) {
      add(''); add(`${item.role === 'Você' ? '›' : item.role === 'Scarlett' ? '✦' : '◆'} ${item.role.toUpperCase()}`, item.role === 'Scarlett' ? 'red' : item.role === 'Você' ? 'purple' : 'cyan');
      for (const l of wrap(item.text, inner)) add('  ' + l);
    }
    const options = this.modal?.options || this.choices();
    const showMenu = options.length > 0 && h >= 16;
    const menuHeight = showMenu ? Math.min(options.length, 6, h - 13) : 0;
    const available = Math.max(1, h - 10 - (showMenu ? menuHeight + 2 : 0));
    const bottom = Math.max(available, content.length - this.scroll);
    for (const l of content.slice(Math.max(0, bottom - available), bottom)) row(l);
    while (rows.length < available + 3) row('');
    if (showMenu) {
      row(line(this.modal ? 'MODELOS LOCAIS  ·  ↑ ↓ escolher  ·  Enter selecionar  ·  Esc fechar' : 'COMANDOS  ·  ↑ ↓ escolher  ·  Enter executar', 'dim'));
      const offset = Math.max(0, this.selected - menuHeight + 1);
      for (let i = offset; i < Math.min(options.length, offset + menuHeight); i++) {
        const [name, desc] = options[i];
        row(line(`${i === this.selected ? '❯' : ' '} ${name.padEnd(Math.min(18, Math.floor(w / 3)))}  ${desc}`, i === this.selected ? 'red' : 'dim'));
      }
      row('');
    }
    const spinner = ['◐', '◓', '◑', '◒'][this.frame % 4];
    row(line(`${this.busy ? spinner : '●'} ${this.status}  ·  ${this.model}  ·  ${this.fast ? 'RÁPIDO' : 'COMPLETO'}${this.sim ? '  ·  SIMULAÇÃO' : ''}`, this.status === 'OFFLINE' ? 'red' : 'cyan'));
    row(line(this.notice, 'dim'));
    row(line('╭' + '─'.repeat(Math.max(0, w - 6)) + '╮', 'dim'));
    const maxInput = w - 9, offset = Math.max(0, this.cursor - maxInput + 1);
    const visible = cut(this.input.slice(offset), maxInput);
    const caret = Math.max(0, this.cursor - offset);
    const editor = visible ? paint(visible.slice(0, caret)) + '\x1b[7m' + (visible[caret] || ' ') + '\x1b[27m' + paint(visible.slice(caret + 1)) : paint(this.busy ? 'Aguarde… Esc para interromper' : 'Pergunte algo ou digite / para começar', 'dim');
    const inputText = cut(this.busy ? 'Aguarde… Esc para interromper' : 'Pergunte algo ou digite / para começar', maxInput);
    const field = visible ? editor : paint(inputText, 'dim');
    row('  ' + paint('│ ', 'dim') + paint('❯ ', 'red') + field + ' '.repeat(Math.max(0, w - 9 - (visible ? Math.max(visible.length, caret + 1) : inputText.length))) + paint(' │', 'dim'));
    row(line('╰' + '─'.repeat(Math.max(0, w - 6)) + '╯', 'dim'));
    row(line('Enter enviar   / comandos   PgUp/PgDn histórico   Esc parar   Ctrl+C sair', 'dim'));
    const screen = rows.slice(0, h);
    while (screen.length < h) screen.push('');
    const frame = screen.map(s => `\x1b[${codes.bg}m${s}${' '.repeat(Math.max(0, w - width(s)))}\x1b[0m`).join('\r\n');
    process.stdout.write('\x1b[?25l\x1b[H' + frame);
  }
}
