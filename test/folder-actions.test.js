import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { folderRequest, createFolder, specialDirectory } from '../src/folder-actions.js';
import { PcTools } from '../src/pc-tools.js';
async function fixture(fn) {
  const home = await mkdtemp(join(tmpdir(), 'scarlett-folder-'));
  try { await fn(home); } finally { await rm(home, { recursive: true, force: true }); }
}

test('pedido natural aceita nome, espaço e destino nas duas ordens', () => {
  for (const [input, expected] of [
    ['crie uma pasta chamada MeuProjeto', { name: 'MeuProjeto', location: 'cwd' }],
    ['cria a pasta Meu Projeto na área de trabalho', { name: 'Meu Projeto', location: 'desktop' }],
    ['crie uma pasta na minha área de trabalho chamada Teste', { name: 'Teste', location: 'desktop' }],
    ['pode criar uma pasta com nome Teste nos downloads', { name: 'Teste', location: 'downloads' }],
    ['quero que você crie uma pasta chamada Teste no Desktop.', { name: 'Teste', location: 'desktop' }],
    ['crie uma pasta chamada "Pesquisa e Desenvolvimento" em Documentos', { name: 'Pesquisa e Desenvolvimento', location: 'documents' }]
  ]) {
    assert.deepEqual(folderRequest(input), expected, input);
  }
});
test('pedido sem nome oferece continuação e não confunde perguntas ou tarefas compostas', () => {
  assert.deepEqual(folderRequest('crie uma pasta'), { name: '', location: 'cwd' });
  assert.deepEqual(folderRequest('crie uma pasta na área de trabalho'), { name: '', location: 'desktop' });
  for (const text of ['como criar uma pasta?', 'não crie uma pasta Teste', 'crie uma pasta Teste e escreva main.c', 'crie uma pasta Teste depois execute algo']) assert.equal(folderRequest(text), null, text);
});
test('criação direta preserva pasta existente e recusa substituir arquivo', async () => fixture(async home => {
  const options = { home, cwd: home };
  const first = await createFolder({ name: 'Meu Projeto', location: 'cwd' }, options);
  assert.equal(first.created, true);
  await writeFile(join(first.path, 'preservar.txt'), 'original');
  assert.equal((await createFolder({ name: 'Meu Projeto', location: 'cwd' }, options)).created, false);
  assert.equal(await readFile(join(first.path, 'preservar.txt'), 'utf8'), 'original');
  await writeFile(join(home, 'conflito'), 'não apagar');
  await assert.rejects(createFolder({ name: 'conflito', location: 'cwd' }, options));
  assert.equal(await readFile(join(home, 'conflito'), 'utf8'), 'não apagar');
}));
test('destino XDG da Área de Trabalho é respeitado sem executar shell', async () => fixture(async home => {
  const config = join(home, 'config'); await mkdir(config);
  await writeFile(join(config, 'user-dirs.dirs'), 'XDG_DESKTOP_DIR="$HOME/Minha Mesa"\n');
  const options = { home, cwd: home, platform: 'linux', env: { XDG_CONFIG_HOME: config } };
  assert.equal(await specialDirectory('desktop', options), join(home, 'Minha Mesa'));
  const result = await createFolder(folderRequest('crie uma pasta chamada Teste na área de trabalho'), options);
  assert.equal(result.path, join(home, 'Minha Mesa', 'Teste'));
  assert.equal((await stat(result.path)).isDirectory(), true);
}));
test('pastas dispensam confirmação; gravação de arquivo continua com prévia', async () => fixture(async home => {
  const tools = new PcTools({ cwd: () => home });
  const folder = await tools.prepare('make_directory', { path: 'Direto' });
  assert.equal(folder.mutates, true); assert.equal(folder.requiresApproval, false);
  await tools.execute(folder);
  const file = await tools.prepare('write_file', { path: 'Direto/main.txt', content: 'teste' });
  assert.equal(file.requiresApproval, true);
}));
