// Capture actual UI rows, then serialize their foreground colors to a static SVG.
import { mkdir, writeFile } from 'node:fs/promises';
import { TerminalUI } from '../src/ui.js';
const esc = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const ui = new TerminalUI(() => {}, () => {});
ui.tty = true; ui.status = 'DEMONSTRAÇÃO'; ui.notice = 'Prévia visual · nenhuma inferência ou benchmark executado';
const oldWrite = process.stdout.write, oldColumns = process.stdout.columns, oldRows = process.stdout.rows;
try {
  process.stdout.columns = 120; process.stdout.rows = 40;
  process.stdout.write = () => true;
  ui.render();
} finally {
  process.stdout.write = oldWrite;
  if (oldColumns === undefined) delete process.stdout.columns; else process.stdout.columns = oldColumns;
  if (oldRows === undefined) delete process.stdout.rows; else process.stdout.rows = oldRows;
}
function spans(row) {
  let color = '#dbe1f4', inverse = false, offset = 0, svg = '', start = 0;
  const expression = /\x1b\[([0-9;]*)m/g;
  function flush(text) {
    if (!text) return;
    if (inverse) svg += `<rect x="${28 + offset * 9}" y="${-14}" width="${[...text].length * 9}" height="19" fill="${color}"/>`;
    svg += `<tspan x="${28 + offset * 9}" fill="${inverse ? '#0d0f17' : color}">${esc(text)}</tspan>`;
    offset += [...text].length;
  }
  for (const match of row.matchAll(expression)) {
    flush(row.slice(start, match.index));
    const code = match[1].split(';').map(Number);
    if (code[0] === 38 && code[1] === 2) color = `rgb(${code.slice(2).join(',')})`;
    if (code[0] === 7) inverse = true;
    if (code[0] === 27) inverse = false;
    start = match.index + match[0].length;
  }
  flush(row.slice(start)); return svg;
}
const rows = ui.lastScreen.map((row, index) => `<text y="${82 + index * 20}">${spans(row)}</text>`).join('\n');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1136" height="914" viewBox="0 0 1136 914"><title>Scarlett 1.1 — prévia real da interface em modo demonstração</title><rect width="1136" height="914" rx="20" fill="#080a10"/><rect x="12" y="12" width="1112" height="890" rx="14" fill="#0d0f17" stroke="#292d40"/><path d="M12 56H1124" stroke="#292d40"/><circle cx="36" cy="34" r="5" fill="#ff6f9b"/><circle cx="54" cy="34" r="5" fill="#f2c97e"/><circle cx="72" cy="34" r="5" fill="#64e1d5"/><text x="568" y="39" text-anchor="middle" fill="#7884a0" font-family="monospace" font-size="12">Scarlett 1.1 · demo · mark.code</text><g font-family="'DejaVu Sans Mono',monospace" font-size="15" xml:space="preserve">${rows}</g><text x="28" y="889" font-family="monospace" font-size="12" fill="#7884a0">Prévia gerada pelo renderizador do aplicativo. Não representa uma sessão de inferência.</text></svg>`;
await mkdir(new URL('../docs/assets/', import.meta.url), { recursive: true });
await writeFile(new URL('../docs/assets/terminal.svg', import.meta.url), svg);
console.log('docs/assets/terminal.svg atualizado.');
