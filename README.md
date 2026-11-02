<div align="center">

<img src="docs/assets/hero.svg" alt="Scarlett 1.1 — Seu terminal. Sua inteligência. Criada por mark.code." width="100%" />

**Uma assistente local para conversar, programar e personalizar.**

[![Versão](https://img.shields.io/badge/versão-1.1_beta-ff6f9b?style=flat-square)](RELEASE_NOTES.md)
[![Node](https://img.shields.io/badge/Node.js-22%2B-64e1d5?style=flat-square)](https://nodejs.org/)
[![Ollama](https://img.shields.io/badge/inferência-Ollama-b5a3ff?style=flat-square)](https://ollama.com/)
[![Tests](https://github.com/kzinnobraboo-cpu/Scarlett/actions/workflows/test.yml/badge.svg)](https://github.com/kzinnobraboo-cpu/Scarlett/actions/workflows/test.yml)

[Começar](#começar-em-dois-passos) · [Comandos](#seu-terminal-seu-fluxo) · [Treinar](docs/TRAINING.md) · [Desempenho](docs/PERFORMANCE.md) · [Contribuir](CONTRIBUTING.md)

</div>

---

## Conheça a Scarlett

Criada por **mark.code, um dev solo**, Scarlett combina uma interface de terminal com modelos executados no seu computador. Você escolhe os pesos, ajusta o perfil de desempenho e personaliza a personalidade. Conversas ficam em memória até você decidir salvá-las.

<img src="docs/assets/terminal.svg" alt="Interface real da Scarlett 1.1, gerada em modo demonstração, com painel lateral e atalhos" width="100%" />

<p align="center"><sub>Prévia gerada pelo renderizador do aplicativo em modo demonstração. Não representa inferência ou benchmark.</sub></p>

<table>
<tr><td width="33%"><strong>✦ Converse</strong><br>Streaming, seleção de modelos, contexto ajustável e métricas da resposta.</td><td width="33%"><strong>⌘ Crie</strong><br>Código para Linux e Windows, mods, depuração e comandos executados com sua confirmação.</td><td width="33%"><strong>◆ Personalize</strong><br>Exporte exemplos, valide datasets e inicie ajustes LoRA pelo terminal.</td></tr>
</table>

## O que chegou na 1.1

- **Turbo opcional com modelo 1.5B**, além da instalação equilibrada 3B. Não substitui os modelos da beta anterior.
- **Três perfis de desempenho** e `/warmup` para pré-carregar o modelo.
- **Interface com painel lateral**, cartões, blocos de código e atualização apenas das linhas alteradas.
- **Training Studio**: `/train export`, `/train check` e `/train start`.
- **Benchmark reproduzível** para medir latência e tokens por segundo no seu hardware.

## Começar em dois passos

Instale [Node.js 22+](https://nodejs.org/) e [Ollama](https://ollama.com/download). Abra a pasta do projeto no terminal:

```sh
npm start
```

Scarlett tenta iniciar o serviço Ollama automaticamente. Dentro dela, prepare o modelo:

```text
/setup
```

Isso baixa `qwen2.5:1.5b` e cria `scarlett:turbo`. O download inicial ocupa aproximadamente 1 GB, além do armazenamento de runtime/cache, e precisa de internet. Após o download, a conversa usa o serviço local. Para instalar a opção 3B, use `/setup balanced`.

**Já tem a beta 1.0?** Seus modelos continuam disponíveis em `/models`. Para experimentar o novo modelo, execute `/setup`. O modelo e o perfil de desempenho são escolhas independentes; `/speed turbo` não troca os pesos de um modelo 3B por 1.5B.

Se Ollama não responder, execute `ollama serve` em outro terminal e use `/connect`. Veja [solução de problemas](docs/TROUBLESHOOTING.md).

<details>
<summary><strong>Quero ver a interface sem baixar um modelo</strong></summary>

```sh
npm run demo
```

A demo identifica suas respostas como demonstração e não executa inferência. Para conversar com um modelo real, use `npm start`.

</details>

## Seu terminal, seu fluxo

Digite `/` e navegue com **↑ ↓**, **Tab** e **Enter**. **Esc** interrompe geração, download ou treinamento. **PgUp/PgDn** percorrem o histórico. **Ctrl+C** sai.

| Comando | O que faz |
| --- | --- |
| `/models` | Abre o seletor de modelos locais |
| `/model NOME` | Seleciona um modelo e começa uma conversa nova |
| `/setup` · `/setup balanced` | Instala Scarlett Turbo 1.5B ou Equilibrada 3B |
| `/speed` | Abre os perfis Turbo, Equilibrado e Completo |
| `/warmup` | Carrega o modelo na memória antes da conversa |
| `/stats` | Mostra as métricas reais da última inferência |
| `/train` | Mostra o fluxo de treinamento |
| `/train export CAMINHO` | Adiciona a conversa a um dataset JSONL |
| `/train check CAMINHO` | Valida o dataset, sem importar bibliotecas de ML |
| `/train start CAMINHO` | Prepara um treinamento LoRA para sua confirmação |
| `/run COMANDO` | Pede confirmação para executar um comando no computador |
| `/save CAMINHO` · `/load CAMINHO` | Salva ou abre uma conversa JSON |
| `/new` | Limpa a conversa em memória |
| `/sim on` · `/sim off` | Ativa ou desativa premissas fictícias |
| `/system` · `/help` · `/connect` | Personalidade, ajuda e reconexão |

`/fast on` e `/fast off` continuam disponíveis como atalhos para Turbo e Completo.

## Desempenho com escolhas claras

| Perfil | Contexto solicitado | Limite de geração | Histórico anterior |
| --- | ---: | ---: | --- |
| Turbo | 2.048 tokens | 512 tokens | Até 4 turnos, orçamento de 1.800 caracteres |
| Equilibrado | 4.096 tokens | 1.536 tokens | Até 12 turnos, orçamento de 6.500 caracteres |
| Completo | 8.192 tokens | 4.096 tokens | Até 20 turnos, orçamento de 14.000 caracteres |

Turnos completos são preservados; a pergunta atual e a personalidade não são cortadas pelo aplicativo. O orçamento em caracteres é uma aproximação, não uma contagem de tokens. O backend pode truncar entradas maiores do que seu contexto.

O perfil Turbo reduz trabalho de contexto e limite de saída. Um modelo menor costuma exigir menos recursos, com possível perda de qualidade. A velocidade real depende de CPU/GPU, memória, modelo e carregamento; **não prometemos respostas instantâneas**. Se a resposta atingir o limite, use `/speed quality` para mais espaço em uma nova solicitação.

Leia [como medir e comparar](docs/PERFORMANCE.md).

## Treinamento que altera pesos

Editar o `Modelfile` muda instruções e parâmetros. **Treinamento LoRA é outra etapa**, com exemplos revisados e dependências Python próprias.

```text
/train export training/data.jsonl
/train check training/data.jsonl
/train start training/data.jsonl
```

O início do treino exige confirmação por `TREINAR`. Ele pode baixar pesos, ocupar muita memória e levar horas. O resultado é salvo em uma pasta nova, sem substituir treinamentos anteriores. O aplicativo não instala bibliotecas de ML automaticamente.

**[Guia completo: ambiente, dados, LoRA e importação →](docs/TRAINING.md)**

## Personalidade e controle

Perguntas diretas como “quem te criou?” e “quem é seu criador?” recebem uma resposta fixa do aplicativo: **“Sou Scarlett, criada por mark.code, um dev solo.”** Essa resposta funciona sem inferência, independentemente do modelo selecionado. Perguntas abertas ou compostas continuam usando o modelo, orientado pela mesma identidade no prompt.

As respostas são orientadas para implementação prática, incluindo cheats em jogos locais, mods e pesquisa técnica. A interface não aplica um filtro de palavras. O comportamento final depende dos pesos, das instruções e do treinamento; não existe garantia de que qualquer modelo responderá a qualquer solicitação. `/sim on` trata premissas inventadas como ficção.

O crédito de mark.code refere-se ao aplicativo e à personalização Scarlett. Os modelos base pertencem aos respectivos autores. Esta beta não distribui pesos próprios treinados.

`/run` executa no shell do sistema com suas permissões após você digitar `EXECUTAR`. Ele tem limite de 30 segundos e não é uma sandbox. O aplicativo não possui automação visual de mouse/teclado nem um agente autônomo de ferramentas. Saída de comandos não é enviada automaticamente ao modelo.

## Configuração

| Variável | Padrão | Uso |
| --- | --- | --- |
| `SCARLETT_MODEL` | `scarlett:turbo`, com fallback para modelo instalado | Modelo inicial |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Apenas HTTP em loopback |
| `SCARLETT_PYTHON` | `python3` no Linux; `python` no Windows | Python do ambiente de treinamento |
| `SCARLETT_TRAIN_MODEL` | `Qwen/Qwen2.5-0.5B-Instruct` | Modelo base do LoRA |

A inferência não tem dependências npm ou telemetria. Downloads, dependências de treinamento e comandos que você executar podem usar a rede. Conversas e datasets são texto simples: revise antes de compartilhar. Dados privados e pesos são ignorados pelo Git nos caminhos padrão.

## Desenvolvimento

Com Node.js e Python instalados:

```sh
npm test
python -m unittest discover -s training -p "test_*.py"
npm run preview
```

No Linux, use `python3` se `python` não existir. A suíte cobre streaming, contexto, perfis, navegação, renderização, exportação e validação. CI está configurado para Linux e Windows; isso não equivale a um resultado de CI que ainda não foi observado.

O terminal e o benchmark foram implementados, mas a inferência real e o treinamento completo ainda não foram validados neste ambiente, que bloqueia sockets. Consulte [notas da versão](RELEASE_NOTES.md) e [como contribuir](CONTRIBUTING.md).

---

<div align="center">

**Scarlett 1.1 Beta** · Criada por **mark.code**, um dev solo.

Modelos locais. Um terminal que acompanha suas ideias.

</div>
