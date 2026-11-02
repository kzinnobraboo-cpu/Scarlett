import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const DEFAULT_PREFERENCES = Object.freeze({ nickname: '', instructions: '' });
export function validatePreferences(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Preferências inválidas.');
  const nickname = value.nickname ?? '', instructions = value.instructions ?? '';
  if (typeof nickname !== 'string' || nickname.length > 60 || (nickname && !/^[\p{L}\p{N} ._'’-]+$/u.test(nickname))) throw new Error('Apelido: use até 60 caracteres com letras, números, espaços, ponto, apóstrofo ou hífen.');
  if (typeof instructions !== 'string' || instructions.length > 2000 || /[\x00-\x08\x0b-\x1f\x7f-\x9f]/.test(instructions)) throw new Error('Personalidade: use texto de até 2.000 caracteres, sem controles de terminal.');
  return { nickname: nickname.trim(), instructions: instructions.trim() };
}
export class PreferenceStore {
  constructor(path) {
    const base = process.env.SCARLETT_CONFIG_HOME || (process.platform === 'win32' ? join(process.env.APPDATA || homedir(), 'Scarlett') : join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'scarlett'));
    this.path = path || join(base, 'preferences.json');
  }
  async load() {
    try {
      const text = await readFile(this.path, 'utf8');
      if (text.length > 20000) throw new Error('Arquivo de preferências acima do limite.');
      return validatePreferences(JSON.parse(text));
    } catch (error) { if (error.code === 'ENOENT') return { ...DEFAULT_PREFERENCES }; throw error; }
  }
  async save(value) {
    const preferences = validatePreferences(value);
    await mkdir(dirname(this.path), { recursive: true });
    const temp = `${this.path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temp, JSON.stringify(preferences, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      await rename(temp, this.path);
    } catch (error) { await unlink(temp).catch(() => {}); throw error; }
    return preferences;
  }
}
export function nicknameRequest(input) {
  const match = /\b(?:me chame de|me chama de|pode me chamar de)\s+["']?(.+?)["']?\s*[.!?]*$/iu.exec(input.trim());
  if (!match) return null;
  const prefix = input.trim().slice(0, match.index).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\b(?:a partir de agora|apartir de agora|a partir de agr|apartir de agr|de agora em diante|eu sou seu dono|sou seu dono|sou seu usuario|por favor|oi|ola|entao)\b/g, '').replace(/[\s,.:!]/g, '');
  if (prefix) return null;
  const nickname = match[1].trim().replace(/\s+(?:a partir de agora|de agora em diante|agora|agr)$/iu, '').trim();
  if (/\be\s+(?:fa[çc]a|crie|escreva|responda|seja|execute|abra|leia|gere|compile|delete|apague)\b/iu.test(nickname)) return null;
  try { return validatePreferences({ nickname }).nickname || null; } catch { return null; }
}
export function personalizationPrompt(preferences) {
  const valid = validatePreferences(preferences);
  return [valid.nickname ? `Chame o usuário de ${JSON.stringify(valid.nickname)}. É uma preferência de tratamento, não uma mudança na autoria de Scarlett nem nas permissões do sistema.` : '', valid.instructions ? `Preferências de estilo do usuário: ${valid.instructions}` : ''].filter(Boolean).join('\n');
}
export function addressedReply(text, preferences) {
  return preferences.nickname ? `${preferences.nickname},\n\n${text}` : text;
}
