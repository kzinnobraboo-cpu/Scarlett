import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PcTools, PC_TOOLS, buildTask } from '../src/pc-tools.js';
import { agentTurn } from '../src/agent.js';
import { Ollama } from '../src/core.js';
const exists = path => access(path).then(() => true, () => false);
async function fixture(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'scarlett-pc-'));
  try { await fn(dir, new PcTools({ cwd: () => dir })); }
  finally { await rm(dir, { recursive: true, force: true }); }
}
const call = (name, args) => ({ message: { tool_calls: [{ function: { name, arguments: args } }] }, done: true });

test('preparação mostra conteúdo sem criar pastas ou arquivos', async () => fixture(async (dir, pc) => {
  const proposal = await pc.prepare('write_file', { path: 'pasta nova/hello.txt', content: 'Olá\nScarlett' });
  assert.equal(proposal.mutates, true);
  assert.match(proposal.preview, /Olá/);
  assert.equal(await exists(join(dir, 'pasta nova')), false);
  const result = await pc.execute(proposal);
  assert.equal(result.written, true);
  assert.equal(await readFile(join(dir, 'pasta nova/hello.txt'), 'utf8'), 'Olá\nScarlett');
}));
test('substituição exige opção e detecta mudanças depois da prévia', async () => fixture(async (dir, pc) => {
  const path = join(dir, 'arquivo.txt'); await writeFile(path, 'primeiro');
  await assert.rejects(pc.prepare('write_file', { path, content: 'novo' }), /overwrite/);
  const proposal = await pc.prepare('write_file', { path, content: 'novo', overwrite: true });
  await writeFile(path, 'mudança externa');
  await assert.rejects(pc.execute(proposal), /mudou/);
  assert.equal(await readFile(path, 'utf8'), 'mudança externa');
  const updated = await pc.prepare('write_file', { path, content: 'curto', overwrite: true });
  await pc.execute(updated);
  assert.equal(await readFile(path, 'utf8'), 'curto');
}));
test('leituras são paginadas e ferramentas validam argumentos', async () => fixture(async (dir, pc) => {
  await writeFile(join(dir, 'a.txt'), 'um\ndois\ntrês\nquatro');
  const read = await pc.execute(await pc.prepare('read_file', { path: 'a.txt', start_line: 2, max_lines: 2 }));
  assert.equal(read.content, 'dois\ntrês'); assert.equal(read.truncated, true);
  const listing = await pc.execute(await pc.prepare('list_directory'));
  assert.equal(listing.entries[0].name, 'a.txt');
  await assert.rejects(pc.prepare('execute_command', { command: 'echo ok', timeout_seconds: 0 }));
  await assert.rejects(pc.prepare('write_file', { path: 'x', content: 'x', extra: true }));
  await assert.rejects(pc.prepare('unknown_tool', {}));
}));
test('comando devolve falha real e limita saída enviada ao modelo', async () => fixture(async (dir) => {
  const pc = new PcTools({ cwd: () => dir, shell: async (command, emit, options) => {
    assert.equal(command, 'literal comando'); assert.equal(options.cwd, dir);
    assert.equal(options.timeout, 2000); emit('x'.repeat(20000));
    return { code: 7, timedOut: false, aborted: false };
  } });
  const result = await pc.execute(await pc.prepare('execute_command', { command: 'literal comando', timeout_seconds: 2 }));
  assert.equal(result.code, 7); assert.equal(result.output.length, 12000);
}));
test('build separa argumentos, exige toolchain e não finge .exe de Python no Linux', () => {
  assert.deepEqual(buildTask('/tmp/a b.c', 'windows', '/tmp/a b.exe', 'linux'), { executable: 'x86_64-w64-mingw32-gcc', args: ['/tmp/a b.c', '-O2', '-o', '/tmp/a b.exe'] });
  assert.throws(() => buildTask('app.py', 'windows', 'app.exe', 'linux'), /PyInstaller/);
  assert.throws(() => buildTask('app.c', 'native', 'app.c', 'linux'), /substituir/);
  assert.throws(() => buildTask('app.js', 'native', 'app', 'linux'), /suporta/);
});
test('agente cria pastas diretamente, confirma escrita e envia resultados reais ao modelo', async () => fixture(async (dir, tools) => {
  let requests = 0;
  const api = { async *chat(model, messages, signal, speed, schemas) {
    assert.equal(schemas, PC_TOOLS);
    requests++;
    if (requests === 1) yield call('make_directory', { path: 'app' });
    else if (requests === 2) {
      assert.equal(messages.at(-1).role, 'tool');
      assert.equal(messages.at(-1).tool_name, 'make_directory');
      yield call('write_file', { path: 'app/main.c', content: 'int main(void) { return 0; }' });
    } else if (requests === 3) yield call('read_file', { path: 'app/main.c' });
    else { assert.match(messages.at(-1).content, /int main/); yield { message: { content: 'Arquivo criado e conferido.' }, done: true }; }
  } };
  const iterator = agentTurn({ api, model: 'mock', messages: [{ role: 'user', content: 'Crie app/main.c' }], tools });
  let step = await iterator.next(), approvals = 0, answer = '';
  while (!step.done) {
    if (step.value.type === 'approval') {
      approvals++;
      assert.equal(await exists(join(dir, 'app')), true);
      assert.equal(await exists(join(dir, 'app/main.c')), false);
      step = await iterator.next(true);
    } else {
      if (step.value.type === 'token') answer += step.value.text;
      step = await iterator.next();
    }
  }
  assert.equal(approvals, 1); assert.equal(requests, 4);
  assert.match(answer, /conferido/);
  assert.match(await readFile(join(dir, 'app/main.c'), 'utf8'), /int main/);
}));
test('recusar ação impede escrita e informa recusa ao modelo', async () => fixture(async (dir, tools) => {
  let requests = 0;
  const api = { async *chat(model, messages) {
    if (++requests === 1) yield call('write_file', { path: 'nao.txt', content: 'não gravar' });
    else { assert.match(messages.at(-1).content, /recusou/); yield { message: { content: 'Cancelado.' }, done: true }; }
  } };
  const iterator = agentTurn({ api, model: 'mock', messages: [], tools });
  let step = await iterator.next();
  while (!step.done) step = await iterator.next(step.value.type === 'approval' ? false : undefined);
  assert.equal(await exists(join(dir, 'nao.txt')), false);
}));
test('agente não fica em ciclo infinito e rejeita ferramenta desconhecida', async () => {
  let requests = 0;
  const tools = { prepare: async () => { throw new Error('Ferramenta desconhecida'); } };
  const api = { async *chat() { requests++; yield call('unknown', {}); } };
  const events = [];
  for await (const event of agentTurn({ api, model: 'mock', messages: [], tools, maxRounds: 2 })) events.push(event);
  assert.equal(requests, 2);
  assert.ok(events.some(e => e.type === 'tool_result' && /desconhecida/.test(e.result.error)));
  assert.ok(events.some(e => e.type === 'limit'));
});
test('cliente envia ferramentas e reserva contexto para a execução', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.tools[0].function.name, 'list_directory');
    assert.equal(body.options.num_ctx, 4096); assert.equal(body.options.num_predict, 1536);
    return new Response(JSON.stringify(call('list_directory', { path: '.' })) + '\n');
  });
  const events = [];
  for await (const event of new Ollama().chat('mock', [], undefined, 'turbo', PC_TOOLS)) events.push(event);
  assert.equal(events[0].message.tool_calls[0].function.name, 'list_directory');
});

test('streaming acumula chamadas distintas recebidas em chunks separados', async () => fixture(async (dir, tools) => {
  let requests = 0;
  const api = { async *chat(model, messages) {
    if (++requests === 1) {
      yield { message: { thinking: 'Preparando duas leituras.' } };
      yield call('list_directory', { path: '.' });
      yield call('list_directory', { path: '.' });
    } else {
      assert.equal(messages.filter(m => m.role === 'tool').length, 2);
      assert.equal(messages.find(m => m.role === 'assistant').thinking, 'Preparando duas leituras.');
      yield { message: { content: 'Leituras concluídas.' }, done: true };
    }
  } };
  const results = [];
  for await (const event of agentTurn({ api, model: 'mock', messages: [], tools })) if (event.type === 'tool_result') results.push(event.result);
  assert.equal(results.length, 2);
}));
