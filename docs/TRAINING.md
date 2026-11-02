# Treinar Scarlett

Scarlett utiliza modelos existentes. Editar um prompt personaliza instruções; LoRA ajusta pesos. O processo abaixo produz adaptadores e, opcionalmente, pesos mesclados. Nenhum treinamento completo foi executado durante o desenvolvimento desta beta.

## 1. Preparar o Python

Use um ambiente separado, preferencialmente Python 3.11 e Linux/WSL2. Instale [PyTorch para sua GPU](https://pytorch.org/get-started/locally/) e depois as dependências. Em máquinas com GPU integrada, não presuma suporte de aceleração ou memória suficiente. CPU pode ser muito lenta.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r training/requirements.txt
```

No Windows/PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r training/requirements.txt
$env:SCARLETT_PYTHON = "$PWD\.venv\Scripts\python.exe"
npm start
```

No fish, usado no Garuda:

```fish
set -gx SCARLETT_PYTHON "$PWD/.venv/bin/python"
npm start
```

Em bash:

```sh
SCARLETT_PYTHON="$PWD/.venv/bin/python" npm start
```

O terminal Scarlett não precisa dessas bibliotecas para conversar; somente o treino precisa. As versões das dependências permitem atualizações dentro das faixas documentadas, mas não foram fixadas em um ambiente ML validado. Verifique compatibilidade antes de um treino longo.

## 2. Criar exemplos

Cada linha do JSONL é uma conversa completa. Ela precisa alternar `user` e `assistant`, terminar com `assistant` e pode ter uma mensagem `system` inicial.

```json
{"messages":[{"role":"user","content":"Quem criou Scarlett?"},{"role":"assistant","content":"Scarlett foi criada por mark.code, um dev solo."}]}
```

Você pode exportar a conversa atual dentro do terminal:

```text
/train export training/data.jsonl
```

Isso adiciona **uma conversa completa**, preservando o contexto das perguntas seguintes. `/new` começa outra conversa, que pode ser exportada como outro exemplo. Exportar duas vezes a mesma conversa gera duplicatas; a validação as identifica e o treino as remove antes do split.

Revise respostas antes de treinar: exemplos gerados pelo próprio modelo podem reproduzir erros dele. Inclua identidade, Linux, Windows, código, mods, cheats locais e cenários fictícios com contexto claro. O arquivo `training/example.jsonl` é apenas uma amostra de formato. Poucos exemplos não demonstram qualidade. Dados e pesos padrão não são versionados.

## 3. Validar sem GPU ou bibliotecas ML

```text
/train check training/data.jsonl
```

Ou diretamente:

```sh
python3 training/train.py --data training/data.jsonl --validate-only
```

A validação usa somente a biblioteca padrão. Ela verifica JSON, papéis, alternância, respostas ausentes, conteúdo vazio e tamanho. Também conta conversas únicas e duplicadas. Validação estrutural não avalia se uma resposta é correta.

## 4. Treinar

Dentro da Scarlett:

```text
/train start training/data.jsonl
```

Revise a configuração mostrada e digite `TREINAR`. O processo usa `SCARLETT_PYTHON` e, por padrão, `Qwen/Qwen2.5-0.5B-Instruct`, diferente do modelo Ollama de inferência. Configure `SCARLETT_TRAIN_MODEL` antes de abrir o aplicativo para usar outra base compatível. Esc pede interrupção do processo Python.

Para escolher mais parâmetros, execute diretamente:

```sh
python3 training/train.py \
  --model Qwen/Qwen2.5-0.5B-Instruct \
  --data training/data.jsonl \
  --output training/output/meu-ajuste \
  --epochs 1 \
  --max-length 1024 \
  --merge
```

O script usa SFT com LoRA, remove duplicatas exatas e reserva 10% dos exemplos únicos para avaliação com seed 42. Conversas parecidas continuam podendo vazar entre splits; para avaliação rigorosa, prepare um conjunto externo independente. O treino usa a sequência completa de conversação; não configura perda exclusivamente em respostas do assistente. Conversas maiores que `--max-length` podem ser truncadas no processamento do treino.

O código recusa uma pasta de saída existente e não vazia. Dentro da interface, cada execução ganha uma pasta com data/hora. Há mínimo técnico de duas conversas únicas; isso serve para testar o fluxo, não para treinar um modelo de qualidade.

## 5. Avaliar e importar

Teste identidade, correção de código, respostas em português e tarefas novas que não apareçam nos dados. Compare com a base; perda de treino menor não comprova melhoria. Verifique licença e arquitetura dos pesos.

Com `--merge`, os pesos mesclados ficam em `PASTA-DE-SAIDA/merged`. Se sua arquitetura estiver na lista suportada do Ollama, crie um Modelfile com `FROM` apontando para essa pasta e copie o bloco `SYSTEM` de Scarlett. Outra opção é converter com ferramentas compatíveis do llama.cpp para GGUF e usar `FROM ./modelo.gguf`.

```sh
ollama create scarlett:tuned -f Modelfile.tuned
```

Depois selecione `/model scarlett:tuned`. Adaptadores LoRA isolados não são automaticamente um modelo executável no Ollama. A importação não é automatizada pela interface.

Referências: [SFTTrainer](https://huggingface.co/docs/trl/sft_trainer), [PEFT](https://huggingface.co/docs/peft/), [importação no Ollama](https://docs.ollama.com/import).
