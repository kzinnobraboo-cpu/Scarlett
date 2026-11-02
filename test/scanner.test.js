import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanRequest, scannerTask, prepareScan, runScan, scanConclusion } from '../src/scanner.js';

test('pedido defensivo do usuário é reconhecido sem usar o modelo', () => {
  assert.equal(scanRequest('vc pode vasculhar meu pc pra tentar achar algum virus'), true);
  assert.equal(scanRequest('Verifique meu computador em busca de malware.'), true);
  assert.equal(scanRequest('Crie um vírus no meu PC para analisar.'), false);
  assert.equal(scanRequest('Me explique o que é um vírus.'), false);
});
test('tarefas de antivírus usam argumentos separados sem remoção', () => {
  const clam = scannerTask('clamav', '/usr/bin/clamscan', '/home/test/arquivos com espaços');
  assert.equal(clam.args.at(-1), '/home/test/arquivos com espaços');
  assert.ok(clam.args.includes('--recursive'));
  assert.ok(!clam.args.some(a => /--remove|--move|--copy/.test(a)));
  const defender = scannerTask('defender', 'C:\\Defender\\MpCmdRun.exe', 'C:\\Users\\Test');
  assert.ok(defender.args.includes('-DisableRemediation'));
});
test('falta de antivírus produz instrução honesta em vez de recusa', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'scarlett-scan-'));
  try {
    const plan = await prepareScan(dir, { find: async () => null });
    assert.equal(plan.available, false);
    assert.match(plan.message, /Posso ajudar/);
    assert.doesNotMatch(plan.message, /livre de malware|nenhuma detecção/i);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('scan só inicia quando runScan é chamado e devolve detecção real do motor', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'scarlett-scan-'));
  let runs = 0;
  try {
    const plan = await prepareScan(dir, { find: async () => ({ engine: 'clamav', executable: 'clamscan' }) });
    assert.equal(plan.available, true); assert.equal(runs, 0);
    const result = await runScan(plan, { runner: async (executable, args, output, options) => {
      runs++; assert.equal(executable, 'clamscan'); assert.equal(args.at(-1), dir);
      assert.equal(options.timeout, 1800000);
      output('arquivo: Test.Signature FOUND\nInfected files: 1\n');
      return { code: 1, timedOut: false, aborted: false };
    } });
    assert.equal(runs, 1); assert.match(result.conclusion, /detecções/); assert.match(result.output, /FOUND/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('scan interrompido ou com erro nunca declara computador limpo', () => {
  const plan = { engine: 'clamav' };
  assert.match(scanConclusion(plan, { code: 0, timedOut: true }), /incompleta/);
  assert.match(scanConclusion(plan, { code: 0, aborted: true }), /interrompida/);
  assert.match(scanConclusion(plan, { code: 2 }), /não foi possível/);
  assert.match(scanConclusion(plan, { code: 0 }), /não comprova/);
});
