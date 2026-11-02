# Scarlett ✦

Assistente local de terminal criada por **mark.code, um dev solo**, para Linux e Windows. Interface escura com detalhes em vermelho, streaming, comandos com Tab, modelos locais e execução de comandos confirmada pelo usuário. O terminal não tem dependências npm.

Scarlett é um aplicativo que utiliza pesos existentes através do Ollama. O repositório inclui personalidade e ferramentas de ajuste LoRA; não inclui pesos próprios treinados. O crédito de mark.code refere-se ao aplicativo Scarlett, não à autoria dos modelos base.

## Começar

Instale [Node.js 22 ou superior](https://nodejs.org/) e [Ollama](https://ollama.com/download) para seu sistema. Dentro desta pasta:

```sh
npm start
```

Scarlett verifica a conexão e tenta iniciar `ollama serve` automaticamente. Na primeira execução, digite **`/setup`** dentro da Scarlett: isso baixa `qwen2.5:3b` e cria o modelo `scarlett`, mostrando progresso na barra de status. O download pode ocupar alguns GB e levar vários minutos. Esc cancela; `/setup` permite tentar novamente. Se já houver modelos instalados, você pode selecioná-los sem baixar outro.

Se o serviço não puder iniciar, abra outro terminal e execute `ollama serve`; depois use `/connect` dentro da Scarlett. Não é necessário executar `ollama pull` antes de iniciar o servidor. O download inicial precisa de internet. Depois disso, a conversa usa somente o Ollama local. O aplicativo aceita apenas endereços de loopback e não contém telemetria. Instalação, downloads e comandos executados manualmente podem acessar a rede.

Para testar só a interface sem baixar modelos:

```sh
npm run demo
```

Digite uma mensagem; nesse modo a resposta é uma demonstração identificada, não inferência real.

## Comandos

| Comando | Ação |
| --- | --- |
| `/models` | Listar modelos instalados |
| `/setup` | Baixar modelo base e preparar Scarlett |
| `/connect` | Iniciar Ollama se necessário e reconectar |
| `/model nome` | Trocar modelo e iniciar conversa nova |
| `/new` | Limpar histórico em memória |
| `/save conversa.json` | Salvar mensagens, sem sobrescrever arquivo existente |
| `/load conversa.json` | Carregar mensagens de uma sessão |
| `/sim on` ou `/sim off` | Ativar/desativar premissas de ficção |
| `/fast on` ou `/fast off` | Alternar contexto de 4096/8192 e limite de 1024/4096 tokens |
| `/system` | Mostrar personalidade |
| `/run comando` | Mostrar comando e solicitar confirmação |
| `/quit` | Sair |

A interface ocupa a tela inteira, com cabeçalho, conversa rolável, entrada fixa e indicador de status. Digite `/` para abrir o menu: use setas ou Tab para escolher e Enter para executar. `/models` abre um seletor navegável. Comandos que recebem argumentos, como `/run`, preenchem a entrada para você completar. PgUp/PgDn percorrem a conversa, e setas recuperam mensagens anteriores quando o menu está fechado. Esc interrompe geração ou download; Ctrl+C sai e restaura o terminal.

A conversa fica em memória até você usar `/save`. Arquivos de conversa são texto simples; evite publicar informações pessoais. As últimas 40 mensagens são enviadas ao modelo; o contexto também pode ser truncado por ele. Use `/new` para começar de novo.

## Controle do computador

Use `/run` para comandos de arquivos, processos, diagnósticos ou abertura de aplicativos. Exemplos: `/run ls -lah` no Linux, `/run dir` no Windows, `/run start notepad` no Windows. Depois revise o comando e digite exatamente `EXECUTAR`. Qualquer outra resposta cancela. O shell é `/bin/sh` no Linux e `cmd.exe` no Windows; para PowerShell, invoque `powershell -Command ...` explicitamente.

O comando usa as permissões do processo Scarlett e tem limite de 30 segundos. Isso não é uma sandbox: execute somente comandos que entende. Saída de comandos não é enviada automaticamente ao modelo. Esta versão não tem navegação visual, clique automático ou ciclo autônomo de ferramentas; o modelo pode sugerir comandos e você pode executá-los via `/run`.

## Personalidade, respostas e desempenho

O prompt identifica Scarlett como criação de mark.code. Modelos podem não seguir instruções perfeitamente: valide a identidade no modelo que escolher. A interface não aplica um filtro de palavras às respostas; o comportamento é determinado pelos pesos, pelo prompt e pelos dados de treinamento. Um prompt não garante comportamento irrestrito. `/sim on` aceita premissas como “a grama é azul” dentro de um cenário fictício, sem converter isso em fato real.

O preset usa `qwen2.5:3b` como ponto de partida configurável. Não foi feito benchmark neste computador. Para reduzir memória e latência, escolha um modelo menor já instalado com `/model nome` e mantenha `/fast on`. O Ollama mantém o modelo carregado por dez minutos após solicitações. A primeira resposta pode demorar por carregamento; GPU, RAM, contexto e quantização influenciam a velocidade. Streaming mostra os tokens conforme chegam, sem prometer respostas instantâneas. A interface mostra tok/s quando o backend fornece métricas.

`SCARLETT_MODEL` escolhe o modelo inicial e `OLLAMA_HOST` escolhe o endereço local. Exemplo no Linux: `SCARLETT_MODEL=scarlett npm start`. No PowerShell: `$env:SCARLETT_MODEL='scarlett'; npm start`.

## Personalizar sem treinamento

Edite `Modelfile`, preserve o `FROM` de um modelo instalado e execute novamente `ollama create scarlett -f Modelfile`. Isso configura personalidade e parâmetros; **não altera pesos**.

## Treinar com LoRA

Use preferencialmente um ambiente separado em Linux ou WSL2 com GPU compatível. A instalação do PyTorch depende da GPU: siga o [seletor oficial](https://pytorch.org/get-started/locally/). Treinar em CPU é possível para alguns modelos, mas pode ser muito lento. Sem conhecer seu hardware, não há garantia de memória ou tempo suficientes.

1. Crie um ambiente Python compatível com PyTorch, TRL e PEFT; Python 3.11 é uma escolha conservadora.
2. Instale as dependências de treinamento, separadas do terminal.
3. Prepare conversas revisadas em JSONL, uma por linha, no formato de `training/example.jsonl`. Esse arquivo de quatro exemplos ilustra o formato e não é suficiente para ajuste útil. Crie um conjunto variado e mantenha avaliação separada, incluindo identidade, Linux, Windows, factualidade e simulações.

```sh
python -m venv .venv
# Linux: source .venv/bin/activate
# PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -r training/requirements.txt
python training/train.py --model Qwen/Qwen2.5-0.5B-Instruct --data training/data.jsonl --output training/output --merge
```

O script faz ajuste supervisionado com LoRA, reserva 10% para avaliação e salva adaptadores. `--merge` também salva pesos mesclados em `training/output/merged`. O exemplo usa um modelo pequeno para experimentar o fluxo; não implica a mesma capacidade do preset 3B. Downloads precisam de internet e estão sujeitos à licença do modelo escolhido. Verifique o split e avaliações antes de um treino de produção; perda menor não prova que o modelo funciona melhor.

Para usar os pesos resultantes no Ollama, confirme a arquitetura na documentação de importação. Se suportada, crie um novo Modelfile apontando `FROM` para a pasta de pesos mesclados; alternativamente converta para GGUF com as ferramentas compatíveis do llama.cpp e use `FROM ./modelo.gguf`. Preserve a personalidade de Scarlett no arquivo e execute `ollama create scarlett-tuned -f Modelfile.tuned`. Selecione com `/model scarlett-tuned`. Conversão e treinamento não foram executados ou validados neste ambiente.

Referências: [API de chat do Ollama](https://docs.ollama.com/api/chat), [importação de modelos](https://docs.ollama.com/import), [SFTTrainer](https://huggingface.co/docs/trl/sft_trainer).

## Desenvolvimento e GitHub

```sh
npm test
```

Os testes verificam streaming, mensagens de sessão, proteção contra escapes de terminal, execução de comandos, restrição ao host local, inicialização do backend, erros de conexão e navegação do menu. Backend e streaming usam simulações para funcionar sem serviço Ollama ou portas abertas. GitHub Actions está configurado para Linux e Windows; execução local no Linux não equivale a validação no Windows.

Para publicar se o repositório remoto ainda não existir, dentro desta pasta:

```sh
gh repo create Scarlett --private --source=. --remote=origin --push
```

O comando cria um repositório privado na conta autenticada. A publicação exige conexão de rede com GitHub. Pesos, datasets privados e sessões não entram no Git por padrão.
