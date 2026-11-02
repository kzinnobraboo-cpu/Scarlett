import { mkdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const places = '(?:[aá]rea de trabalho|desktop|downloads|documentos|documents|pasta atual|pasta pessoal|home)';
const placeKey = text => ({ 'area de trabalho': 'desktop', desktop: 'desktop', downloads: 'downloads', documentos: 'documents', documents: 'documents', 'pasta atual': 'cwd', 'pasta pessoal': 'home', home: 'home' })[normalize(text)];
export function folderRequest(input) {
  const text = input.trim().replace(/[.!?]+$/g, '').replace(/[, ]+(?:por favor|pra mim|para mim)\.?$/i, '').trim();
  const start = /^(?:(?:oi|ol[aá]|scarlett)[, ]+)?(?:por favor[, ]+)?(?:(?:quero|gostaria de|pode|poderia)(?: que (?:voc[eê]|vc))?\s+)?(?:crie|cria|criar|fa[çc]a|faz|fazer)\s+(?:(?:uma|a)\s+)?pasta(?:\s+|$)(.*)$/iu.exec(text);
  if (!start) return null;
  let name = start[1].trim(), location = 'cwd';
  const first = new RegExp(`^(?:na|no|nas|nos|em)\\s+(?:(?:minha|meu|a|o)\\s+)?(${places})(?:\\s+|$)(.*)$`, 'iu').exec(name);
  if (first) { location = placeKey(first[1]); name = first[2].trim(); }
  const suffix = new RegExp(`(?:^|\\s+)(?:na|no|nas|nos|em)\\s+(?:(?:minha|meu|a|o)\\s+)?(${places})$`, 'iu').exec(name);
  if (suffix) { if (first) return null; location = placeKey(suffix[1]); name = name.slice(0, suffix.index).trim(); }
  name = name.replace(/^(?:chamada|com (?:o )?nome(?: de)?|de nome|nomeada(?: como)?)(?:\s+|$)/iu, '').trim();
  const quoted = /^(?:"([^"]+)"|'([^']+)'|“([^”]+)”)$/.exec(name);
  if (quoted) name = quoted[1] || quoted[2] || quoted[3];
  else {
    if (/["“”]/.test(name) || /\b(?:e|depois|entao)\s+(?:crie|fa[çc]a|escreva|execute|apague|delete|instale|abra|compile|gere)\b/iu.test(name)) return null;
    name = name.replace(/\.$/, '').trim();
  }
  if (name.length > 1000 || /[\x00-\x1f\x7f-\x9f]/.test(name)) return null;
  return { name, location };
}
async function isDirectory(path) { return stat(path).then(info => info.isDirectory(), () => false); }
export async function specialDirectory(location, { home = homedir(), cwd = process.cwd(), env = process.env, platform = process.platform } = {}) {
  if (location === 'cwd') return cwd;
  if (location === 'home') return home;
  if (!['desktop', 'downloads', 'documents'].includes(location)) throw new Error('Local da pasta inválido.');
  const key = { desktop: 'DESKTOP', downloads: 'DOWNLOAD', documents: 'DOCUMENTS' }[location];
  if (platform !== 'win32') {
    const config = await readFile(join(env.XDG_CONFIG_HOME || join(home, '.config'), 'user-dirs.dirs'), 'utf8').catch(() => '');
    const value = new RegExp(`^XDG_${key}_DIR="([^"]+)"`, 'm').exec(config)?.[1];
    // Parse only a literal path and $HOME. Never execute shell expressions in XDG config.
    if (value && !/\$\(|`|\$\{(?!HOME\})/.test(value)) return resolve(home, value.replace(/\$\{HOME\}|\$HOME/g, home));
  }
  const names = { desktop: ['Área de trabalho', 'Área de Trabalho', 'Desktop'], downloads: ['Downloads'], documents: ['Documentos', 'Documents'] }[location];
  const candidates = [...(platform === 'win32' && env.OneDrive ? [join(env.OneDrive, { desktop: 'Desktop', downloads: 'Downloads', documents: 'Documents' }[location])] : []), ...names.map(name => join(home, name))];
  for (const path of candidates) if (await isDirectory(path)) return path;
  return join(home, { desktop: 'Desktop', downloads: 'Downloads', documents: platform === 'win32' ? 'Documents' : 'Documentos' }[location]);
}
export async function createFolder(request, options = {}) {
  if (!request || typeof request.name !== 'string' || !request.name.trim() || request.name.includes('\0')) throw new Error('Qual nome você quer dar à pasta?');
  const base = await specialDirectory(request.location || 'cwd', options);
  const home = options.home || homedir();
  const expanded = request.name === '~' ? home : request.name.startsWith('~/') || request.name.startsWith('~\\') ? join(home, request.name.slice(2)) : request.name;
  const path = resolve(base, expanded);
  const created = await mkdir(path, { recursive: true });
  if (!(await stat(path)).isDirectory()) throw new Error('O caminho existe, mas não é uma pasta.');
  return { path, created: created !== undefined };
}
