# Resolver problemas

## “Could not connect to ollama server”

Abra Scarlett com `npm start`; ao conversar ou usar `/connect`, ela tenta iniciar o serviço. Se falhar, abra outro terminal, execute `ollama serve` e deixe-o aberto. Volte à Scarlett e use `/connect`. Somente depois disso execute `/setup` para baixar o modelo.

## “Operation not permitted” ou sockets bloqueados

Ambientes isolados podem bloquear a API local, mesmo com autenticação ou serviço corretos no seu computador. Abra Scarlett diretamente no Konsole/Windows Terminal normal. Essa falha não prova que seus modelos estão corrompidos. A beta foi desenvolvida em um ambiente com esse bloqueio; inferência e treino completos ainda não foram validados nele.

## Não aparece modelo

Use `/setup` para instalar `scarlett:turbo`, ou `/setup balanced` para a opção 3B. Se houver modelos antigos, eles continuam em `/models`. `ollama list` no terminal também mostra os instalados no serviço ativo. Serviços iniciados com usuários diferentes podem usar pastas de modelos diferentes.

## Resposta lenta

Use `/model scarlett:turbo` após instalá-lo e `/speed turbo`. `/warmup` ajuda a antecipar o custo de carregamento; não elimina esse custo. Confira `/stats` após uma resposta. Evite treinamento e outros programas pesados ao mesmo tempo. Para perguntas que exigem código longo, pode ser necessário `/speed quality`, mesmo com maior tempo de resposta.

## Resposta termina no meio

O perfil Turbo limita geração a 512 tokens. Escolha `/speed balanced` ou `/speed quality` e repita a solicitação com o contexto necessário. A barra informa quando o backend relata limite de comprimento. Aumentar o limite não garante correção do código.

## Terminal estreito ou fonte

A interface oculta o painel lateral abaixo de 116 colunas e reduz a tela inicial em janelas menores. Use uma fonte monoespaçada com Unicode no Konsole/Windows Terminal. Janelas com menos de 20 colunas ou 10 linhas ficam abaixo do layout mínimo suportado. Redimensionar limpa e recompõe a tela.

## “Python não encontrado” ou bibliotecas ausentes

Configure `SCARLETT_PYTHON` para o executável dentro de `.venv`. No fish: `set -gx SCARLETT_PYTHON "$PWD/.venv/bin/python"`, antes de `npm start`. Instale `training/requirements.txt` com esse mesmo Python. `/train check` não precisa de PyTorch; `/train start` precisa.

## Esc durante treinamento

Esc solicita interrupção do Python. Checkpoints completos já gravados são preservados; arquivos em gravação podem ficar incompletos. Inicie outro treino com uma pasta nova. Esse mecanismo não é um gerenciador de processos distribuídos de treinamento.

## GitHub indisponível

O acesso à API do GitHub pode ser bloqueado no ambiente do assistente, enquanto funciona no terminal normal do usuário. Para publicar a versão preparada, rode `npm run publish:beta` na pasta do projeto. O script exige Git e GitHub CLI autenticado, não força sobrescrita de histórico e usa `RELEASE_NOTES.md` na prerelease.
