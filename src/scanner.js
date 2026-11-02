import { access, stat, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, join, delimiter } from 'node:path';
import { homedir } from 'node:os';
import { runProcess } from './core.js';

export function scanRequest(input) {
  const text = input.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /virus|malware|trojan|cavalo de troia|ransomware/.test(text)
    && /vasculh|verific|procur|busc|rastre|varr|scan|analis|achar/.test(text)
    && /meu (?:pc|computador|notebook|sistema|hd)|minha maquina|meus arquivos|este (?:pc|computador)/.test(text)
    && !/\b(?:crie|criar|desenvolva|infecte|infectar|burlar|desativar)\b/.test(text);
}
export function scannerTask(engine, executable, path) {
  if (engine === 'clamav') return { executable, args: ['--recursive', '--infected', '--follow-dir-symlinks=0', '--follow-file-symlinks=0', '--', path] };
  if (engine === 'defender') return { executable, args: ['-Scan', '-ScanType', '3', '-File', path, '-DisableRemediation'] };
  throw new Error('Motor de antivírus desconhecido.');
}
export async function findScanner({ platform = process.platform, env = process.env } = {}) {
  for (const dir of (env.PATH || '').split(delimiter).filter(Boolean)) {
    const executable = join(dir, platform === 'win32' ? 'clamscan.exe' : 'clamscan');
    try { await access(executable, platform === 'win32' ? constants.F_OK : constants.X_OK); if ((await stat(executable)).isFile()) return { engine: 'clamav', executable }; } catch {}
  }
  if (platform === 'win32') {
    const root = join(env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows Defender', 'Platform');
    const versions = await readdir(root, { withFileTypes: true }).catch(() => []);
    const candidates = versions.filter(v => v.isDirectory()).map(v => v.name).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).map(v => join(root, v, 'MpCmdRun.exe'));
    candidates.push(join(env.ProgramFiles || 'C:\\Program Files', 'Windows Defender', 'MpCmdRun.exe'));
    for (const executable of candidates) { try { if ((await stat(executable)).isFile()) return { engine: 'defender', executable }; } catch {} }
  }
  return null;
}
export function scannerMissing(platform = process.platform) {
  if (platform === 'win32') return 'Posso ajudar a procurar malware, mas não localizei ClamAV nem Microsoft Defender neste computador. Confira se o Defender está disponível e ativado, ou instale ClamAV. Depois tente /scan novamente.';
  return 'Posso ajudar a procurar malware, mas ClamAV não está instalado ou não aparece no PATH. No Garuda/Arch: sudo pacman -S clamav. Depois atualize as assinaturas com sudo freshclam e use /scan. A instalação não foi executada automaticamente.';
}
export async function prepareScan(path = homedir(), { find = findScanner, cwd = process.cwd() } = {}) {
  if (typeof path !== 'string' || !path.trim() || path.includes('\0')) throw new Error('Informe um caminho válido para verificar.');
  const expanded = path === '~' ? homedir() : path.startsWith('~/') || path.startsWith('~\\') ? join(homedir(), path.slice(2)) : path;
  const target = resolve(cwd, expanded);
  const info = await stat(target);
  if (!info.isFile() && !info.isDirectory()) throw new Error('Escolha arquivo ou pasta regular para verificar.');
  const scanner = await find();
  if (!scanner) return { available: false, message: scannerMissing() };
  return { available: true, ...scanner, target, task: scannerTask(scanner.engine, scanner.executable, target), preview: `VERIFICAÇÃO DE MALWARE\nMotor: ${scanner.engine === 'clamav' ? 'ClamAV' : 'Microsoft Defender'}\nAlvo: ${target}\nModo: detecção, sem solicitar exclusão ou quarentena.\nLimite: 30 minutos. Pastas grandes podem demorar. Arquivos sem permissão e limites do motor podem tornar a análise incompleta.\n${scanner.engine === 'defender' ? 'Defender pode exigir executar o terminal como administrador.\n' : ''}Nenhum resultado de varredura foi produzido ainda.` };
}
export function scanConclusion(plan, result) {
  if (result.aborted) return 'Verificação interrompida. Não é possível concluir sobre o alvo.';
  if (result.timedOut) return 'Tempo limite atingido. A verificação ficou incompleta.';
  if (result.code === 0) return 'O motor não relatou detecções nesta execução. Isso não comprova que o computador inteiro está livre de malware; confira os arquivos analisados, ignorados e as assinaturas no relatório.';
  if (plan.engine === 'clamav' && result.code === 1) return 'ClamAV relatou uma ou mais detecções. Revise os caminhos e assinaturas no relatório. Nenhum arquivo foi removido por Scarlett.';
  return `O motor retornou código ${result.code}. Confira erros e possíveis detecções no relatório; não foi possível concluir a verificação com sucesso.`;
}
export async function runScan(plan, { signal, onOutput = () => {}, runner = runProcess } = {}) {
  if (!plan.available) throw new Error(plan.message);
  let output = '';
  const result = await runner(plan.task.executable, plan.task.args, chunk => { output = (output + chunk).slice(-60000); onOutput(chunk); }, { signal, timeout: 30 * 60 * 1000 });
  return { ...result, output, conclusion: scanConclusion(plan, result) };
}
